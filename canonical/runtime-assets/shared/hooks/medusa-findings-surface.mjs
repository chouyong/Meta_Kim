#!/usr/bin/env node
/**
 * Meta_Kim medusa findings surface — SessionStart / UserPromptSubmit / Stop.
 *
 * Reads `.meta-kim/state/<profile>/medusa/findings.jsonl`, formats a short
 * unresolved-findings summary, and emits it to the host runtime via the
 * appropriate channel:
 *
 *   --event session-start   one-shot summary on session boot
 *   --event user-prompt     summary only when findings changed since last surface
 *   --event stop            session-close roll-up; also notes pending queue depth
 *
 * Output channel by runtime is auto-detected; both Claude Code and Codex CLI
 * accept the `hookSpecificOutput.additionalContext` JSON shape, while Cursor
 * uses a `prompt`-shaped JSON. fail-open: any error exits 0 with no output.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PROFILE = process.env.META_KIM_PROFILE || "default";
const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));

function cliArgValue(name) {
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) return process.argv[i + 1];
  }
  return null;
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function detectRuntime() {
  const override = (process.env.META_KIM_HOOK_RUNTIME || "").trim().toLowerCase();
  if (override === "claude" || override === "codex" || override === "cursor") return override;
  const sep = process.platform === "win32" ? "\\" : "/";
  const lowered = HOOK_DIR.toLowerCase();
  if (lowered.includes(`${sep}.codex${sep}`) || lowered.includes("/.codex/")) return "codex";
  if (lowered.includes(`${sep}.cursor${sep}`) || lowered.includes("/.cursor/")) return "cursor";
  if (lowered.includes(`${sep}.claude${sep}`) || lowered.includes("/.claude/")) return "claude";
  return "claude";
}

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

function readFindings(findingsPath) {
  if (!existsSync(findingsPath)) return [];
  try {
    return readFileSync(findingsPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function readQueue(queuePath) {
  if (!existsSync(queuePath)) return [];
  try {
    return readFileSync(queuePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function readNotice(noticePath) {
  if (!existsSync(noticePath)) return { lastFingerprint: "", lastSurfacedAt: null };
  try { return JSON.parse(readFileSync(noticePath, "utf8")); } catch { return { lastFingerprint: "" }; }
}

function writeNotice(noticePath, payload) {
  try {
    mkdirSync(path.dirname(noticePath), { recursive: true });
    writeFileSync(noticePath, JSON.stringify(payload, null, 2), "utf8");
  } catch {}
}

function readClassifications(classPath) {
  if (!existsSync(classPath)) return new Map();
  try {
    const acks = new Map();
    for (const line of readFileSync(classPath, "utf8").split("\n").filter(Boolean)) {
      try {
        const r = JSON.parse(line);
        if (r.file && r.sha256) {
          // sha-bound ack: when file content changes, the new sha auto-invalidates
          // any prior classification. Tombstone (revoked: true) un-acks even
          // an existing sha.
          const key = `${canonicalFileKey(r.file)}|${r.sha256}`;
          if (r.revoked) acks.delete(key);
          else acks.set(key, r);
        }
      } catch {}
    }
    return acks;
  } catch { return new Map(); }
}

function summarizeFindings(findings, acks = new Map()) {
  // Per-file latest scan wins. A file's state is fully determined by its most
  // recent finding record (latest scannedAt). If that record has zero issues,
  // the file is "clean" — older sha findings for the same file are closed,
  // not summed. This prevents the "I fixed it and the count doubled" bug
  // where modifying a file generated a fresh sha while the prior sha's
  // findings remained alive.
  const latestByFile = new Map();
  for (const f of findings) {
    const fileKey = canonicalFileKey(f.file);
    if (!fileKey) continue;
    const prior = latestByFile.get(fileKey);
    if (!prior || (f.scannedAt || "") > (prior.scannedAt || "")) {
      latestByFile.set(fileKey, f);
    }
  }
  // Drop findings the user has explicitly classified as expected for this
  // exact (file, sha256) pair. The ack is sha-bound: a file edit produces a
  // new sha and the ack stops applying automatically.
  const ackedCount = { files: 0 };
  for (const [fileKey, f] of [...latestByFile.entries()]) {
    if (f && f.sha256 && acks.has(`${fileKey}|${f.sha256}`)) {
      latestByFile.delete(fileKey);
      ackedCount.files += 1;
    }
  }
  const live = [...latestByFile.values()].filter((f) => {
    const s = f.summary || {};
    return (s.CRITICAL || 0) + (s.HIGH || 0) + (s.MEDIUM || 0) > 0;
  });
  const totals = { CRITICAL: 0, HIGH: 0, MEDIUM: 0 };
  const byFile = new Map();
  for (const f of live) {
    const s = f.summary || {};
    totals.CRITICAL += s.CRITICAL || 0;
    totals.HIGH += s.HIGH || 0;
    totals.MEDIUM += s.MEDIUM || 0;
    byFile.set(f.file, {
      CRITICAL: s.CRITICAL || 0,
      HIGH: s.HIGH || 0,
      MEDIUM: s.MEDIUM || 0,
      scannedAt: f.scannedAt || null,
      sha256: f.sha256 || null,
    });
  }
  const fingerprint = JSON.stringify({
    files: [...byFile.entries()].sort().map(([k, v]) => [k, v.sha256, v.CRITICAL, v.HIGH, v.MEDIUM]),
  });
  return { totals, byFile, fingerprint, ackedFiles: ackedCount.files };
}

function formatSummary({ totals, byFile }, options = {}) {
  const limit = options.fileLimit ?? 8;
  const ranked = [...byFile.entries()].sort((a, b) => {
    const sa = a[1], sb = b[1];
    if ((sb.CRITICAL || 0) !== (sa.CRITICAL || 0)) return (sb.CRITICAL || 0) - (sa.CRITICAL || 0);
    if ((sb.HIGH || 0) !== (sa.HIGH || 0)) return (sb.HIGH || 0) - (sa.HIGH || 0);
    return (sb.MEDIUM || 0) - (sa.MEDIUM || 0);
  });
  const head = `[Meta_Kim/medusa] AI-context findings: ${totals.CRITICAL} CRITICAL, ${totals.HIGH} HIGH, ${totals.MEDIUM} MEDIUM`;
  const lines = [head];
  for (const [file, s] of ranked.slice(0, limit)) {
    const parts = [];
    if (s.CRITICAL) parts.push(`${s.CRITICAL}C`);
    if (s.HIGH) parts.push(`${s.HIGH}H`);
    if (s.MEDIUM) parts.push(`${s.MEDIUM}M`);
    lines.push(`  ${file} — ${parts.join(" ")}`);
  }
  if (ranked.length > limit) lines.push(`  … ${ranked.length - limit} more file(s)`);
  return lines.join("\n");
}

function emitAdditionalContext(text) {
  const runtime = detectRuntime();
  if (runtime === "cursor") {
    process.stdout.write(JSON.stringify({ prompt: text }));
    return;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: process.env.META_KIM_SURFACE_EVENT_NAME || "UserPromptSubmit",
      additionalContext: text,
    },
  }));
}

// AIContextScanner trigger surface (mirrored from medusa-postscan-enqueue.mjs).
// Used by the Stop git-diff fallback so changes that bypass PostToolUse
// (e.g. Codex apply_patch with no per-file payload) still get scanned.
const AI_CONTEXT_FILE_NAMES = new Set([
  ".cursorrules", "cursorrules", "claude.md", ".claude.md", "agents.md",
  "skill.md", "gemini.md", "conventions.md", "copilot-instructions.md",
  "ai-instructions.md", "system-prompt.md", "system-prompt.txt", "prompt.md",
  "assistant.md", "rules.md", ".rules", "context.md",
]);
const AI_CONTEXT_DIR_SEGMENTS = [
  "/.claude/", "/.cursor/", "/.codex/", "/.github/",
  "/.ai/", "/.prompts/", "/prompts/", "/.agents/",
];

function shouldEnqueuePath(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  const base = path.basename(norm);
  if (AI_CONTEXT_FILE_NAMES.has(base)) return true;
  if (base.endsWith(".md") || base.endsWith(".txt")) {
    for (const seg of AI_CONTEXT_DIR_SEGMENTS) {
      if (norm.includes(seg)) return true;
    }
  }
  if (norm.includes("copilot") && norm.includes("instruction")) return true;
  if (norm.includes("cursorrule") || norm.includes("cursor-rule")) return true;
  return false;
}

function fingerprintFile(absPath) {
  try {
    const st = statSync(absPath);
    if (!st.isFile()) return null;
    const buf = readFileSync(absPath);
    return {
      sha256: createHash("sha256").update(buf).digest("hex"),
      mtimeMs: st.mtimeMs,
      size: st.size,
    };
  } catch { return null; }
}

function gitListChangedFiles(root) {
  // Each git invocation gets a hard timeout so a slow repo can't make Stop
  // hook synchronously block the host on the git layer (the budget on the
  // enqueue loop covers the *iteration* but not the git probes themselves).
  const cmd = (args, timeoutMs = 500) => {
    try {
      const r = spawnSync("git", args, {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        timeout: timeoutMs,
      });
      if (r.error || r.status !== 0 || r.signal) return [];
      return (r.stdout || "").split("\n").map((l) => l.trim()).filter(Boolean);
    } catch { return []; }
  };
  const tracked = cmd(["diff", "--name-only", "HEAD"]);
  const staged = cmd(["diff", "--name-only", "--cached"]);
  const untracked = cmd(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...staged, ...untracked])];
}

function startStopFallbackWorker(root) {
  const sibling = path.join(HOOK_DIR, "medusa-worker.mjs");
  const canonical = path.join(
    HOOK_DIR, "..", "..", "shared", "scripts", "medusa-worker.mjs",
  );
  const target = existsSync(sibling) ? sibling : canonical;
  if (!existsSync(target)) return;
  try {
    const child = spawn(process.execPath, [target], {
      cwd: root,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, META_KIM_MEDUSA_WORKER_TRIGGER: "stop-fallback" },
    });
    child.unref();
  } catch {
    // fail-open: a missing worker is recoverable on the next session
  }
}

function fallbackEnqueueDiff(root, dir, queueRecords, findingsRecords) {
  const budgetMs = (() => {
    const raw = parseInt(process.env.META_KIM_MEDUSA_STOP_FALLBACK_BUDGET_MS || "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1500;
  })();
  const maxFiles = (() => {
    const raw = parseInt(process.env.META_KIM_MEDUSA_STOP_FALLBACK_MAX_FILES || "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 200;
  })();

  const startedAt = Date.now();
  const knownSha = new Set();
  for (const r of queueRecords) {
    if (r.file && r.sha256) knownSha.add(`${canonicalFileKey(r.file)}|${r.sha256}`);
  }
  for (const f of findingsRecords) {
    if (f.file && f.sha256) knownSha.add(`${canonicalFileKey(f.file)}|${f.sha256}`);
  }
  const queuePath = path.join(dir, "queue.jsonl");
  let added = 0;
  let truncated = false;
  let timedOut = false;
  for (const rel of gitListChangedFiles(root)) {
    if (Date.now() - startedAt > budgetMs) { timedOut = true; break; }
    if (added >= maxFiles) { truncated = true; break; }
    const abs = path.resolve(root, rel);
    if (!shouldEnqueuePath(abs)) continue;
    const fp = fingerprintFile(abs);
    if (!fp) continue;
    const fileKey = canonicalFileKey(abs);
    if (knownSha.has(`${fileKey}|${fp.sha256}`)) continue;
    const record = {
      id: `stop-fallback-${Date.now()}-${added}`,
      file: fileKey,
      sha256: fp.sha256,
      mtimeMs: fp.mtimeMs,
      size: fp.size,
      status: "pending",
      enqueuedAt: new Date().toISOString(),
      origin: "stop-diff-fallback",
    };
    try {
      mkdirSync(dir, { recursive: true });
      appendFileSync(queuePath, JSON.stringify(record) + "\n", "utf8");
      added += 1;
      knownSha.add(`${fileKey}|${fp.sha256}`);
    } catch {}
  }
  return { added, truncated, timedOut, budgetMs, maxFiles };
}

async function run() {
  const event = (cliArgValue("--event") || "").toLowerCase();
  if (!event) return;

  const payload = await readStdinJson();
  const root = (typeof payload?.cwd === "string" && payload.cwd) ? payload.cwd : process.cwd();
  const dir = stateDir(root);
  const findings = readFindings(path.join(dir, "findings.jsonl"));
  const queue = readQueue(path.join(dir, "queue.jsonl"));
  const acks = readClassifications(path.join(dir, "classifications.jsonl"));
  const noticePath = path.join(dir, "last-notice.json");

  const summary = summarizeFindings(findings, acks);
  const { totals, fingerprint, ackedFiles } = summary;
  const hasFindings = (totals.CRITICAL + totals.HIGH + totals.MEDIUM) > 0;
  const pending = queue.filter((r) => r.status === "pending" || !r.status).length;

  if (event === "session-start") {
    if (!hasFindings && pending === 0) return;
    process.env.META_KIM_SURFACE_EVENT_NAME = "SessionStart";
    let text = hasFindings ? formatSummary(summary) : "[Meta_Kim/medusa]";
    if (pending > 0) text += `\n  (${pending} file${pending === 1 ? "" : "s"} pending scan; results surface here when ready)`;
    if (hasFindings) writeNotice(noticePath, { lastFingerprint: fingerprint, lastSurfacedAt: new Date().toISOString(), event });
    emitAdditionalContext(text);
    return;
  }

  if (event === "user-prompt") {
    if (!hasFindings) return;
    const prior = readNotice(noticePath);
    if (prior.lastFingerprint === fingerprint) return;
    process.env.META_KIM_SURFACE_EVENT_NAME = "UserPromptSubmit";
    const text = formatSummary(summary);
    writeNotice(noticePath, { lastFingerprint: fingerprint, lastSurfacedAt: new Date().toISOString(), event });
    emitAdditionalContext(text);
    return;
  }

  if (event === "stop") {
    const fallbackResult = fallbackEnqueueDiff(root, dir, queue, findings);
    const fallbackAdded = fallbackResult.added;
    const totalPending = pending + fallbackAdded;
    if (fallbackAdded > 0) startStopFallbackWorker(root);
    if (!hasFindings && totalPending === 0 && ackedFiles === 0
        && !fallbackResult.truncated && !fallbackResult.timedOut) {
      return;
    }
    const lines = [];
    if (hasFindings) lines.push(formatSummary(summary, { fileLimit: 5 }));
    if (ackedFiles > 0) {
      lines.push(`[Meta_Kim/medusa] ${ackedFiles} file(s) suppressed via classifications.jsonl ack.`);
    }
    if (totalPending > 0) {
      const newly = fallbackAdded > 0 ? ` (+${fallbackAdded} via git diff fallback)` : "";
      lines.push(`[Meta_Kim/medusa] ${totalPending} file(s) pending scan at session close${newly}.`);
    }
    if (fallbackResult.truncated) {
      lines.push(`[Meta_Kim/medusa] git-diff fallback hit max-files=${fallbackResult.maxFiles}; remaining files were skipped (META_KIM_MEDUSA_STOP_FALLBACK_MAX_FILES).`);
    }
    if (fallbackResult.timedOut) {
      lines.push(`[Meta_Kim/medusa] git-diff fallback hit time budget=${fallbackResult.budgetMs}ms; remaining files were skipped (META_KIM_MEDUSA_STOP_FALLBACK_BUDGET_MS).`);
    }
    process.stderr.write(`${lines.join("\n")}\n`);
    return;
  }
}

run().catch(() => {});
