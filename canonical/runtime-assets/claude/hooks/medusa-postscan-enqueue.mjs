#!/usr/bin/env node
/**
 * Meta_Kim PostToolUse hook — medusa AI-context scan, enqueue path.
 *
 * Cheap and synchronous. Reads tool_input.file_path from stdin, applies the
 * AIContextScanner trigger surface as a coarse filter, computes file hash +
 * mtime for dedup, and appends a single record to
 * `.meta-kim/state/<profile>/medusa/queue.jsonl`. Then it spawns the worker
 * runner detached + unref so the user-facing tool call returns immediately.
 *
 * It never blocks the user. Any unexpected state — missing file, hash failure,
 * worker spawn error — exits 0 and writes nothing.
 *
 * Modes (META_KIM_MEDUSA_SCAN, default "warn"):
 *   off    — bypass entirely, exit 0
 *   warn   — enqueue + start worker, surfacing hooks emit hints only
 *   block  — RESERVED. Same enqueue path; surfacing hooks may render findings
 *            more loudly in future. PostToolUse cannot deny a write that has
 *            already happened, so block does NOT mean "veto the edit". Today
 *            this value is treated identically to warn at the enqueue stage;
 *            a stricter surface treatment is on the open-questions list.
 */

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = process.env.META_KIM_PROFILE || "default";

// Opt-in diagnostic bypass log (META_KIM_MEDUSA_DEBUG=1). Records ONLY that the
// hook was invoked plus the payload's top-level + tool_input key NAMES — never
// any file content or values — so we can tell "PostToolUse never fired" apart
// from "fired but extractFilePath found no path" (e.g. Codex apply_patch with
// no per-file file_path). Writes one JSONL line to ~/.meta-kim/medusa-debug.log.
function debugLog(stage, payload, extra) {
  if (process.env.META_KIM_MEDUSA_DEBUG !== "1") return;
  try {
    const home = process.env.USERPROFILE || process.env.HOME || HOOK_DIR;
    const logPath = path.join(home, ".meta-kim", "medusa-debug.log");
    mkdirSync(path.dirname(logPath), { recursive: true });
    const tin = payload?.tool_input ?? payload?.input ?? {};
    const rec = {
      ts: new Date().toISOString(),
      stage,
      argvLength: process.argv.length - 2,
      tool_name: payload?.tool_name ?? payload?.tool ?? null,
      topLevelKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
      toolInputKeys: tin && typeof tin === "object" ? Object.keys(tin) : [],
      toolInputShapes: describeShapes(tin),
      ...(extra || {}),
    };
    appendFileSync(logPath, `${JSON.stringify(rec)}\n`);
  } catch {
    // fail-open: diagnostics must never break the hook
  }
}

// Per-field STRUCTURE summary (never values) so a live payload that only shows
// `toolInputKeys:["changes"]` still tells us whether `changes` is a string, an
// array, or a path-keyed map — the distinction extractApplyPatchPaths branches
// on. Records type, array length, or (for objects) key count and value-type set
// only. No keys-as-paths, no string contents, no field values.
function describeShapes(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      out[key] = { type: "array", length: value.length };
    } else if (value && typeof value === "object") {
      const valTypes = new Set();
      for (const v of Object.values(value)) {
        valTypes.add(Array.isArray(v) ? "array" : typeof v);
      }
      out[key] = { type: "object", keyCount: Object.keys(value).length, valueTypes: [...valTypes] };
    } else {
      out[key] = { type: typeof value };
    }
  }
  return out;
}

// AIContextScanner.AI_CONTEXT_FILES (lowercased basename match) snapshot.
// Mirrored from medusa/scanners/ai_context_scanner.py:98 — over-matches on
// purpose; the Python worker calls scanner.can_scan() for the authoritative
// decision, so we never maintain two copies of the rule.
const AI_CONTEXT_FILE_NAMES = new Set([
  ".cursorrules",
  "cursorrules",
  "claude.md",
  ".claude.md",
  "agents.md",
  "skill.md",
  "gemini.md",
  "conventions.md",
  "copilot-instructions.md",
  "ai-instructions.md",
  "system-prompt.md",
  "system-prompt.txt",
  "prompt.md",
  "assistant.md",
  "rules.md",
  ".rules",
  "context.md",
]);

// AIContextScanner.AI_CONTEXT_DIRS — coarse path-segment trigger.
const AI_CONTEXT_DIR_SEGMENTS = [
  "/.claude/",
  "/.cursor/",
  "/.codex/",
  "/.github/",
  "/.ai/",
  "/.prompts/",
  "/prompts/",
  "/.agents/",
];

function shouldEnqueue(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  const base = path.basename(norm);
  if (AI_CONTEXT_FILE_NAMES.has(base)) return true;
  if (base.endsWith(".md") || base.endsWith(".txt")) {
    for (const seg of AI_CONTEXT_DIR_SEGMENTS) {
      if (norm.includes(seg)) return true;
    }
  }
  // Fall through to "copilot" / "cursor-rule" patterns the scanner accepts.
  if (norm.includes("copilot") && norm.includes("instruction")) return true;
  if (norm.includes("cursorrule") || norm.includes("cursor-rule")) return true;
  return false;
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function extractFilePath(payload) {
  const tin = payload?.tool_input ?? payload?.input ?? {};
  return tin.file_path ?? tin.filePath ?? tin.path ?? tin.notebook_path ?? null;
}

// apply_patch carries no per-file file_path; the touched files live either in
// the patch TEXT (`*** Add/Update/Delete File: <path>`) or in a STRUCTURED
// container. Codex's real apply_patch tool_input uses `changes` keyed BY path
// (`{changes: {"AGENTS.md": {...}}}`) — the dynamic-key shape — while other
// runtimes embed the raw patch string. The wrapper key is not contractually
// fixed, so we cover all three: (1) scan every string value for patch-text
// markers, (2) collect KEYS of known path-keyed containers, (3) collect `path`/
// `file_path` fields from nested change objects. One call can touch many files,
// so this returns an array of all referenced paths.
const APPLY_PATCH_FILE_RE = /^\*\*\*\s+(?:Add|Update|Delete) File:\s+(.+?)\s*$/gm;
// Container fields whose KEYS are file paths (Codex apply_patch `changes` map).
const PATH_KEYED_CONTAINERS = new Set(["changes", "files"]);
// Object fields that directly name a path inside a change/edit object.
const PATH_VALUE_FIELDS = ["path", "file_path", "filePath", "notebook_path"];

function extractApplyPatchPaths(payload) {
  const tin = payload?.tool_input ?? payload?.input ?? {};
  const paths = new Set();

  // (1) Patch-text markers, anywhere a string value appears.
  const textCandidates = [];
  if (tin && typeof tin === "object") {
    for (const v of Object.values(tin)) {
      if (typeof v === "string") textCandidates.push(v);
    }
  }
  if (typeof payload?.input === "string") textCandidates.push(payload.input);
  if (typeof payload?.patch === "string") textCandidates.push(payload.patch);
  for (const text of textCandidates) {
    if (!text.includes("*** ") || !text.includes("File:")) continue;
    APPLY_PATCH_FILE_RE.lastIndex = 0;
    let m;
    while ((m = APPLY_PATCH_FILE_RE.exec(text)) !== null) {
      const p = m[1].trim();
      if (p) paths.add(p);
    }
  }

  // (2)+(3) Structured shapes: path-keyed containers and nested path fields.
  if (tin && typeof tin === "object") {
    for (const [key, value] of Object.entries(tin)) {
      if (
        PATH_KEYED_CONTAINERS.has(key) &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        // `changes: {"<path>": {...}}` — the object keys ARE the file paths.
        for (const candidate of Object.keys(value)) {
          if (candidate) paths.add(candidate);
        }
      }
      for (const found of collectPathFields(value)) paths.add(found);
    }
  }

  return [...paths];
}

// Recursively pull `path`/`file_path`/... string fields out of nested change
// objects (e.g. `changes: [{path: "...", type: "update"}]`). Bounded depth so a
// pathological payload can't spin; apply_patch structures are shallow.
function collectPathFields(node, depth = 0, out = []) {
  if (depth > 5 || !node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectPathFields(item, depth + 1, out);
    return out;
  }
  for (const field of PATH_VALUE_FIELDS) {
    if (typeof node[field] === "string" && node[field]) out.push(node[field]);
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      collectPathFields(value, depth + 1, out);
    }
  }
  return out;
}

function repoRoot(payload) {
  const fromPayload = typeof payload?.cwd === "string" && payload.cwd ? payload.cwd : null;
  return fromPayload || process.cwd();
}

// Single canonical form for file paths used as queue/findings/ack keys.
// All entry points (PostToolUse enqueue, worker, surface, Stop fallback,
// classifications.jsonl) MUST run paths through this before persisting or
// comparing. Kept as a one-liner duplicated across hooks intentionally — these
// scripts are standalone and can't share a lib without sync-runtimes plumbing.
function canonicalFileKey(filePath) {
  if (!filePath || typeof filePath !== "string") return "";
  const resolved = path.resolve(filePath).replace(/\\/g, "/");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function fileFingerprint(absPath) {
  try {
    const st = statSync(absPath);
    if (!st.isFile()) return null;
    const h = createHash("sha256");
    h.update(readFileSync(absPath));
    return { sha256: h.digest("hex"), mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return null;
  }
}

function ensureStateDir(root) {
  const dir = path.join(root, ".meta-kim", "state", PROFILE, "medusa");
  try { mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function alreadyQueued(queuePath, absPath, sha256) {
  if (!existsSync(queuePath)) return false;
  try {
    const tail = readFileSync(queuePath, "utf8").split("\n").filter(Boolean).slice(-200);
    for (const line of tail) {
      try {
        const r = JSON.parse(line);
        if (r.file !== absPath || r.sha256 !== sha256) continue;
        // Skip when same content is still pending OR has already been scanned
        // successfully. Only "failed" records are eligible for re-enqueue.
        if (r.status === "pending" || r.status === "scanned" || r.status === "skipped") {
          return true;
        }
      } catch {}
    }
  } catch {}
  return false;
}

function alreadyScannedClean(findingsPath, absPath, sha256) {
  if (!existsSync(findingsPath)) return false;
  if (process.env.META_KIM_MEDUSA_FORCE_RESCAN === "1") return false;
  try {
    const tail = readFileSync(findingsPath, "utf8").split("\n").filter(Boolean).slice(-500);
    for (const line of tail) {
      try {
        const r = JSON.parse(line);
        if (r.file === absPath && r.sha256 === sha256) return true;
      } catch {}
    }
  } catch {}
  return false;
}

function startWorker(root) {
  // Preferred: runtime-projected location alongside this hook.
  const sibling = path.join(HOOK_DIR, "medusa-worker.mjs");
  // Fallback: canonical tree (running directly from the repo, e.g. tests).
  const canonical = path.join(
    HOOK_DIR,
    "..",
    "..",
    "shared",
    "scripts",
    "medusa-worker.mjs",
  );
  const target = existsSync(sibling) ? sibling : canonical;
  if (!existsSync(target)) return;
  try {
    const child = spawn(process.execPath, [target], {
      cwd: root,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, META_KIM_MEDUSA_WORKER_TRIGGER: "enqueue" },
    });
    child.unref();
  } catch {
    // fail-open: worker can be retried by the next PostToolUse or a Stop hook
  }
}

async function main() {
  const mode = (process.env.META_KIM_MEDUSA_SCAN || "warn").trim().toLowerCase();
  if (mode === "off" || mode === "0" || mode === "false") return;

  const payload = await readStdinJson();
  debugLog("invoked", payload);

  // Collect every file this tool call touched. Direct-key tools (Write/Edit/
  // MultiEdit/NotebookEdit) expose one path via extractFilePath. Only the
  // apply_patch tool hides 1..N paths inside patch text / a structured changes
  // container, so we ONLY run the broader (and looser) apply_patch extractor
  // when tool_name says so — otherwise an unrelated tool whose body happens to
  // contain `*** Update File:` text, or a business field literally named
  // `files`/`changes`, could trigger spurious enqueues.
  const filePaths = [];
  const direct = extractFilePath(payload);
  if (direct) filePaths.push(direct);
  const toolName = payload?.tool_name ?? payload?.tool ?? null;
  if (toolName === "apply_patch") {
    for (const p of extractApplyPatchPaths(payload)) filePaths.push(p);
  }

  if (filePaths.length === 0) {
    debugLog("no-filepath", payload);
    return;
  }

  const root = repoRoot(payload);
  let enqueuedAny = false;
  for (const filePath of filePaths) {
    if (enqueueOne(payload, root, filePath)) enqueuedAny = true;
  }
  if (enqueuedAny) startWorker(root);
}

// Enqueue a single file for medusa scan. Returns true if the worker should run
// (file is newly queued OR was already pending and just needs the worker
// kicked). Returns false when the file is filtered out, unreadable, or already
// scanned clean. No worker start here — the caller batches that once per call.
function enqueueOne(payload, root, filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  if (!shouldEnqueue(abs)) return false;

  const fp = fileFingerprint(abs);
  if (!fp) return false;

  // Single canonical form persisted everywhere: posix slashes, lowercased on
  // Windows. Both the file we write to disk for medusa to scan and every key
  // in queue/findings/classifications use this form.
  const fileKey = canonicalFileKey(abs);

  const dir = ensureStateDir(root);
  const queuePath = path.join(dir, "queue.jsonl");
  const findingsPath = path.join(dir, "findings.jsonl");

  if (alreadyQueued(queuePath, fileKey, fp.sha256)) {
    return true;
  }

  if (alreadyScannedClean(findingsPath, fileKey, fp.sha256)) {
    return false;
  }

  const record = {
    id: randomUUID(),
    file: fileKey,
    sha256: fp.sha256,
    mtimeMs: fp.mtimeMs,
    size: fp.size,
    status: "pending",
    enqueuedAt: new Date().toISOString(),
    sessionId: payload?.session_id || null,
    tool: payload?.tool_name || null,
  };

  try {
    appendFileSync(queuePath, JSON.stringify(record) + "\n", "utf8");
  } catch {
    return false;
  }

  return true;
}

main().catch(() => {});
