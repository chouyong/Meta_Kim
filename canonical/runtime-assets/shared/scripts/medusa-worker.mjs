#!/usr/bin/env node
/**
 * Meta_Kim medusa scan worker.
 *
 * Single long-lived Python helper drains the pending queue. Pays the ~150s
 * AIContextScanner cold start once per worker run, then ~0.16s per file.
 *
 * Lifecycle (all paths under .meta-kim/state/<profile>/medusa/):
 *   queue.jsonl       — append-only enqueue log (one record per intent)
 *   findings.jsonl    — append-only scan results (one record per scanned file)
 *   worker.pid        — exclusive lock; second instance exits immediately
 *   worker.log        — short progress trace, mainly for debugging
 *
 * Run modes:
 *   default     — fork-and-drain. Reads queue.jsonl tail for pending entries,
 *                 streams paths into Python batch helper, writes findings,
 *                 marks records scanned/failed, exits when idle.
 *   --once      — drain a single batch and exit (used by tests).
 *
 * fail-open: any exception or Python crash logs and exits 0. The next
 * PostToolUse / Stop hook is free to retry.
 */

import { spawn } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const PROFILE = process.env.META_KIM_PROFILE || "default";
// Default 240s — long enough that consecutive edits to AI-context files reuse
// the same warm worker (avoiding a fresh 150-220s cold start), short enough
// that a quiet session frees the process. Override with
// META_KIM_MEDUSA_WORKER_IDLE_MS for tuning.
const IDLE_EXIT_MS = (() => {
  const raw = parseInt(process.env.META_KIM_MEDUSA_WORKER_IDLE_MS || "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 240_000;
})();
const QUEUE_POLL_MS = 750;

function stateDir(root) {
  return path.join(root, ".meta-kim", "state", PROFILE, "medusa");
}

// Single canonical form for file paths used as queue/findings/ack keys.
// Mirrored across enqueue, worker, surface, classifications. Posix slashes;
// lowercased on Windows because the platform is case-insensitive.
function canonicalFileKey(filePath) {
  if (!filePath || typeof filePath !== "string") return "";
  const resolved = path.resolve(filePath).replace(/\\/g, "/");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function ensureDir(dir) {
  try { mkdirSync(dir, { recursive: true }); } catch {}
}

function logLine(dir, msg) {
  try {
    appendFileSync(
      path.join(dir, "worker.log"),
      `${new Date().toISOString()} ${msg}\n`,
      "utf8",
    );
  } catch {}
}

function acquirePidLock(dir) {
  const pidPath = path.join(dir, "worker.pid");
  // Atomic create: if the pidfile already exists, openSync throws EEXIST
  // instead of clobbering. This closes the race where two enqueue hooks both
  // see "no pidfile" and both try to start a worker.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let fd;
    try {
      fd = openSync(pidPath, "wx");
    } catch (err) {
      if (err && err.code !== "EEXIST") return null;
      // Existing pidfile: check whether it points at a live process.
      let existing = NaN;
      try {
        existing = parseInt(readFileSync(pidPath, "utf8").trim(), 10);
      } catch {
        // Unreadable pidfile counts as stale.
      }
      if (Number.isFinite(existing) && existing > 0 && existing !== process.pid && isAlive(existing)) {
        return null;
      }
      // Stale or self-owned pidfile — drop it and retry the atomic create.
      try { unlinkSync(pidPath); } catch {}
      continue;
    }
    try {
      writeFileSync(fd, String(process.pid));
    } finally {
      closeSync(fd);
    }
    return pidPath;
  }
  return null;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

function releasePidLock(pidPath) {
  if (!pidPath) return;
  try { unlinkSync(pidPath); } catch {}
}

function readQueue(queuePath) {
  if (!existsSync(queuePath)) return [];
  try {
    return readFileSync(queuePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function rewriteQueue(queuePath, records) {
  const tmp = `${queuePath}.tmp`;
  const body = records.map((r) => JSON.stringify(r)).join("\n");
  try {
    writeFileSync(tmp, body ? body + "\n" : "", "utf8");
    renameSync(tmp, queuePath);
  } catch {
    // best-effort; queue stays as-is and the next run re-processes
  }
}

function appendFinding(findingsPath, record) {
  try {
    appendFileSync(findingsPath, JSON.stringify(record) + "\n", "utf8");
  } catch {}
}

function selectPending(records) {
  const seen = new Set();
  const pending = [];
  for (const r of records) {
    if (r.status && r.status !== "pending") continue;
    const key = `${r.file}::${r.sha256}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pending.push(r);
  }
  return pending;
}

async function drainOnce(root, dir) {
  const queuePath = path.join(dir, "queue.jsonl");
  const findingsPath = path.join(dir, "findings.jsonl");
  const records = readQueue(queuePath);
  if (records.length === 0) return { processed: 0 };

  const pending = selectPending(records);
  if (pending.length === 0) return { processed: 0 };

  logLine(dir, `drain start pending=${pending.length}`);

  // Preferred: helper sibling next to this script (production = runtime
  // projected dir; dev = canonical/runtime-assets/shared/scripts/).
  const fallbackHelper = (() => {
    try {
      const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
      return path.join(here, "medusa_batch_scan.py");
    } catch { return null; }
  })();
  const helper = fallbackHelper && existsSync(fallbackHelper) ? fallbackHelper : null;
  if (!helper) {
    logLine(dir, "helper script missing, abort drain");
    return { processed: 0, error: "helper-missing" };
  }

  const py = process.env.META_KIM_MEDUSA_PYTHON || "python";
  const child = spawn(py, [helper], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  const stdoutBuf = [];
  let stderr = "";
  child.stdout.on("data", (b) => stdoutBuf.push(b));
  child.stderr.on("data", (b) => { stderr += b.toString("utf8"); });

  for (const r of pending) {
    try { child.stdin.write(`${r.file}\n`); } catch {}
  }
  try { child.stdin.end(); } catch {}

  const exitCode = await new Promise((resolve) => {
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code));
  });

  if (exitCode !== 0) {
    logLine(dir, `helper exit ${exitCode}; stderr=${stderr.slice(0, 200)}`);
  }

  const stdout = Buffer.concat(stdoutBuf).toString("utf8");
  const resultsByFile = new Map();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      const key = canonicalFileKey(obj.file);
      if (key) resultsByFile.set(key, obj);
    } catch {}
  }

  const finishedAt = new Date().toISOString();
  for (const r of pending) {
    const result = resultsByFile.get(canonicalFileKey(r.file));
    if (!result) {
      r.status = "failed";
      r.lastError = "no result";
      r.lastAttemptAt = finishedAt;
      continue;
    }
    r.status = result.ok && !result.skipped ? "scanned"
             : result.skipped ? "skipped"
             : "failed";
    r.scannerVersion = result.scanner_version;
    r.lastAttemptAt = finishedAt;
    if (!result.ok) r.lastError = result.error || "scan failed";
    if (result.skipped) r.skipped = result.skipped;

    if (result.ok && !result.skipped) {
      appendFinding(findingsPath, {
        id: r.id,
        file: r.file,
        sha256: r.sha256,
        scannedAt: finishedAt,
        scannerVersion: result.scanner_version,
        scanMs: result.scan_ms,
        summary: result.summary,
        issues: result.issues,
        issuesTruncated: result.issues_truncated || 0,
        sessionId: r.sessionId || null,
        hasFullArtifact: Boolean(result.issues_full && result.issues_full.length > 0),
      });
      // Write the unbounded issue list to a per-record JSON sidecar so
      // findings.jsonl stays compact while the full audit trail is
      // preserved at .meta-kim/state/<profile>/medusa/findings-full/<id>.json
      if (result.issues_full && result.issues_full.length > 0) {
        try {
          const fullDir = path.join(dir, "findings-full");
          mkdirSync(fullDir, { recursive: true });
          writeFileSync(
            path.join(fullDir, `${r.id}.json`),
            JSON.stringify({
              id: r.id,
              file: r.file,
              sha256: r.sha256,
              scannedAt: finishedAt,
              scannerVersion: result.scanner_version,
              issues: result.issues_full,
            }, null, 2),
            "utf8",
          );
        } catch (err) {
          logLine(dir, `findings-full write failed for ${r.id}: ${err && err.message}`);
        }
      }
    }
  }

  rewriteQueue(queuePath, records);
  logLine(dir, `drain done processed=${pending.length}`);
  return { processed: pending.length };
}

function pruneFindingsFull(dir) {
  const fullDir = path.join(dir, "findings-full");
  if (!existsSync(fullDir)) return;

  const retentionDays = (() => {
    const raw = parseInt(process.env.META_KIM_MEDUSA_FULL_RETENTION_DAYS || "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 14;
  })();
  const maxFiles = (() => {
    const raw = parseInt(process.env.META_KIM_MEDUSA_FULL_MAX_FILES || "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 500;
  })();
  const maxBytes = (() => {
    const raw = parseInt(process.env.META_KIM_MEDUSA_FULL_MAX_MB || "", 10);
    const mb = Number.isFinite(raw) && raw > 0 ? raw : 50;
    return mb * 1024 * 1024;
  })();

  let entries;
  try {
    entries = readdirSync(fullDir).map((name) => {
      const full = path.join(fullDir, name);
      try {
        const st = statSync(full);
        return st.isFile() ? { full, name, mtimeMs: st.mtimeMs, size: st.size } : null;
      } catch { return null; }
    }).filter(Boolean);
  } catch { return; }

  // Oldest first so we drop the right ones when over caps.
  entries.sort((a, b) => a.mtimeMs - b.mtimeMs);
  const cutoffMs = Date.now() - retentionDays * 24 * 3600 * 1000;
  let pruned = 0;

  // 1. Age cap.
  for (const e of entries) {
    if (e.mtimeMs >= cutoffMs) break;
    try { unlinkSync(e.full); pruned += 1; e.deleted = true; } catch {}
  }
  let live = entries.filter((e) => !e.deleted);

  // 2. File-count cap.
  while (live.length > maxFiles) {
    const drop = live.shift();
    try { unlinkSync(drop.full); pruned += 1; } catch {}
  }

  // 3. Total-size cap.
  let totalBytes = live.reduce((sum, e) => sum + e.size, 0);
  while (totalBytes > maxBytes && live.length > 0) {
    const drop = live.shift();
    totalBytes -= drop.size;
    try { unlinkSync(drop.full); pruned += 1; } catch {}
  }

  if (pruned > 0) logLine(dir, `findings-full prune dropped=${pruned} retained=${live.length}`);
}

async function workerLoop(root, dir, once) {
  let lastProgress = Date.now();
  while (true) {
    const { processed } = await drainOnce(root, dir);
    if (processed > 0) {
      lastProgress = Date.now();
      if (once) return;
      continue;
    }
    if (once) return;
    if (Date.now() - lastProgress > IDLE_EXIT_MS) return;
    await new Promise((r) => setTimeout(r, QUEUE_POLL_MS));
  }
}

async function main() {
  const root = process.cwd();
  const dir = stateDir(root);
  ensureDir(dir);

  const pidPath = acquirePidLock(dir);
  if (!pidPath) {
    logLine(dir, `another worker pid alive, exit`);
    return;
  }

  const once = process.argv.includes("--once");
  logLine(dir, `worker start pid=${process.pid} once=${once}`);

  let exitCleanup = () => releasePidLock(pidPath);
  process.on("exit", exitCleanup);
  process.on("SIGINT", () => { exitCleanup(); process.exit(0); });
  process.on("SIGTERM", () => { exitCleanup(); process.exit(0); });

  try {
    pruneFindingsFull(dir);
    await workerLoop(root, dir, once);
  } catch (err) {
    logLine(dir, `worker error ${err && err.message}`);
  } finally {
    pruneFindingsFull(dir);
    releasePidLock(pidPath);
    logLine(dir, `worker exit`);
  }
}

main().catch((err) => {
  // last-resort fail-open
  try {
    const dir = stateDir(process.cwd());
    ensureDir(dir);
    logLine(dir, `fatal ${err && err.message}`);
  } catch {}
  process.exit(0);
});
