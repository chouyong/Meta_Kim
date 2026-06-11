#!/usr/bin/env node
/**
 * ⚠️ CANDIDATE — NOT REGISTERED. DO NOT MOUNT TO PreToolUse.
 *
 * v2 PreToolUse-synchronous design that hit a hard performance wall:
 * AIContextScanner.scan_file's first call costs ~150s in a fresh Python
 * process (YAML rule packs lazy-load + all regexes compile on first scan).
 * Synchronous PreToolUse hooks cannot meet that budget.
 *
 * The v3 plan (PostToolUse enqueue + single batch worker + Stop reconcile)
 * lives in canonical/runtime-assets/claude/hooks/medusa-postscan-enqueue.mjs
 * and canonical/runtime-assets/shared/scripts/medusa-worker.mjs. This file is
 * retained only as a reference for the trigger surface and cross-runtime deny
 * payload shape. Do not register, do not sync, do not invoke.
 *
 * See .codex/NOTES_FROM_CLAUDE_CODE.md (v3) for context.
 */

/**
 * Meta_Kim PreToolUse hook — medusa AI-context content scan.
 *
 * Coarse-filters tool_input.file_path against the AIContextScanner's known
 * file/directory surface, then spawns the Python helper sibling
 * (`medusa_skill_scan.py`) which calls medusa's AIContextScanner.scan_file.
 *
 * Modes (META_KIM_MEDUSA_SCAN, default "warn"):
 *   off    — bypass entirely, exit 0
 *   warn   — block findings degrade to stderr hint, hint stays as hint
 *   block  — CRITICAL/HIGH findings emit a runtime-appropriate deny payload
 *
 * Python interpreter override: META_KIM_MEDUSA_PYTHON (defaults to "python").
 *
 * Fail-open contract: if Python is missing, the helper crashes, the subprocess
 * times out, or stdout is unparseable, this hook exits 0 silently. medusa is a
 * defense-in-depth layer, never a hard build dependency.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELPER = path.join(HOOK_DIR, "medusa_skill_scan.py");
const TIMEOUT_MS = 5_000;

// ── Trigger surface ──────────────────────────────────────────────────────────
// Mirrors AIContextScanner.AI_CONTEXT_FILES / AI_CONTEXT_DIRS at the time of
// writing. The Node side intentionally over-matches; the Python helper calls
// scanner.can_scan() for the authoritative decision so we never maintain two
// copies of the rule.
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

const AI_CONTEXT_DIR_SEGMENTS = [
  ".claude/skills/",
  ".claude/agents/",
  ".claude/",
  ".cursor/rules/",
  ".cursor/",
  ".codex/agents/",
  ".codex/",
  ".github/copilot-instructions",
  ".ai/",
  ".prompts/",
  "prompts/",
  ".agents/skills/",
];

function shouldScan(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  const base = path.basename(norm);
  if (AI_CONTEXT_FILE_NAMES.has(base)) return true;
  for (const seg of AI_CONTEXT_DIR_SEGMENTS) {
    if (norm.includes(seg)) return true;
  }
  return false;
}

// ── Stdin payload helpers ────────────────────────────────────────────────────
async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractFilePath(payload) {
  const tin = payload?.tool_input ?? payload?.input ?? {};
  return (
    tin.file_path ??
    tin.filePath ??
    tin.path ??
    tin.notebook_path ??
    null
  );
}

// ── Mode + runtime resolution ────────────────────────────────────────────────
function resolveMode() {
  const raw = (process.env.META_KIM_MEDUSA_SCAN || "warn").trim().toLowerCase();
  if (raw === "off" || raw === "0" || raw === "false") return "off";
  if (raw === "block") return "block";
  return "warn";
}

function detectHookRuntime() {
  const override = (process.env.META_KIM_HOOK_RUNTIME || "").trim().toLowerCase();
  if (override === "claude" || override === "codex" || override === "cursor") {
    return override;
  }
  const sep = process.platform === "win32" ? "\\" : "/";
  const lowered = fileURLToPath(import.meta.url).toLowerCase();
  const codexSeg = `${sep}.codex${sep}`.toLowerCase();
  const cursorSeg = `${sep}.cursor${sep}`.toLowerCase();
  const claudeSeg = `${sep}.claude${sep}`.toLowerCase();
  if (lowered.includes(codexSeg) || lowered.includes("/.codex/")) return "codex";
  if (lowered.includes(cursorSeg) || lowered.includes("/.cursor/")) return "cursor";
  if (lowered.includes(claudeSeg) || lowered.includes("/.claude/")) return "claude";
  return "claude";
}

// ── Decision emitters ────────────────────────────────────────────────────────
function emitDeny(reason) {
  const runtime = detectHookRuntime();
  const message = `[Meta_Kim/medusa] ${reason}`;
  if (runtime === "cursor") {
    process.stdout.write(JSON.stringify({
      permission: "deny",
      user_message: message,
      agent_message: message,
    }));
    process.stderr.write(`${message}\n`);
    process.exit(2);
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: message,
    },
  }));
  process.exit(0);
}

function emitHint(reason) {
  process.stderr.write(`[Meta_Kim/medusa] ${reason}\n`);
  process.exit(0);
}

// ── Python helper invocation ─────────────────────────────────────────────────
function runHelper(filePath) {
  return new Promise((resolve) => {
    const py = process.env.META_KIM_MEDUSA_PYTHON || "python";
    let child;
    try {
      child = spawn(py, [HELPER, filePath], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch {
      resolve({ decision: "none", error: "spawn failed" });
      return;
    }

    let stdout = "";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch {}
      resolve(value);
    };

    const timer = setTimeout(() => finish({ decision: "none", error: "timeout" }), TIMEOUT_MS);
    timer.unref?.();

    child.stdout.on("data", (b) => { stdout += b.toString("utf8"); });
    child.on("error", () => finish({ decision: "none", error: "spawn error" }));
    child.on("close", () => {
      clearTimeout(timer);
      const trimmed = stdout.trim();
      if (!trimmed) return finish({ decision: "none" });
      try {
        finish(JSON.parse(trimmed));
      } catch {
        finish({ decision: "none", error: "parse error" });
      }
    });
  });
}

// ── Entrypoint ───────────────────────────────────────────────────────────────
async function main() {
  const mode = resolveMode();
  if (mode === "off") return;

  if (!existsSync(HELPER)) return;

  const payload = await readStdinJson();
  const filePath = extractFilePath(payload);
  if (!filePath || !shouldScan(filePath)) return;

  const result = await runHelper(filePath);

  if (!result || typeof result !== "object") return;

  if (result.decision === "block") {
    if (mode === "block") emitDeny(result.reason || "blocked by medusa AI-context scan");
    if (mode === "warn") emitHint(result.reason || "medusa AI-context scan flagged this file");
    return;
  }

  if (result.decision === "hint") {
    emitHint(result.reason || "medusa AI-context scan emitted a hint");
    return;
  }
}

main().catch(() => {});
