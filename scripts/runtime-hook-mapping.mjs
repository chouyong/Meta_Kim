/**
 * Runtime hook mapping helpers.
 *
 * The goal is explicit capability mapping, not pretending every runtime has
 * Claude Code's hook surface. Keep commands in the portable subset:
 * `node <script> ...` with JSON-quoted arguments when needed.
 */

export const RUNTIME_HOOK_CAPABILITIES = {
  claude: {
    configPath: ".claude/settings.json",
    hookDir: ".claude/hooks",
    projectHooks: true,
    globalHooks: true,
    events: {
      promptSubmit: "UserPromptSubmit",
      sessionStart: "SessionStart",
      preToolUse: "PreToolUse",
      postToolUse: "PostToolUse",
      subagentStart: "SubagentStart",
      stop: "Stop",
    },
  },
  codex: {
    configPath: ".codex/hooks.json",
    hookDir: ".codex/hooks",
    projectHooks: true,
    globalHooks: true,
    events: {
      promptSubmit: "UserPromptSubmit",
      sessionStart: "SessionStart",
      preToolUse: "PreToolUse",
      postToolUse: "PostToolUse",
      subagentStart: "SubagentStart",
      skill: "Skill",
      stop: "Stop",
    },
  },
  openclaw: {
    configPath: "openclaw/openclaw.template.json",
    hookDir: "openclaw/hooks",
    projectHooks: true,
    globalHooks: true,
    events: {
      promptSubmit: "command:new",
      sessionStart: "command:new",
      compactAfter: "session:compact:after",
      stop: "command:stop",
    },
  },
  cursor: {
    configPath: ".cursor/hooks.json",
    hookDir: ".cursor/hooks",
    projectHooks: true,
    globalHooks: true,
    events: {
      promptSubmit: "beforeSubmitPrompt",
      sessionStart: "sessionStart",
      preToolUse: "preToolUse",
      postToolUse: "postToolUse",
      subagentStart: "subagentStart",
      stop: "stop",
    },
  },
};

export const HOOKPROMPT_PLATFORM_SUPPORT = {
  claude: {
    status: "native",
    event: "UserPromptSubmit",
    adapter: "claude-settings-hook",
  },
  codex: {
    status: "adapter-required",
    event: "UserPromptSubmit",
    adapter: "codex-hookprompt-adapter",
  },
  cursor: {
    status: "adapter-required",
    event: "beforeSubmitPrompt",
    adapter: "cursor-hookprompt-adapter",
  },
  openclaw: {
    status: "degraded",
    event: "command:new",
    adapter: "openclaw-workspace-instruction",
  },
};

// Cross-runtime hook core. These files have exactly one canonical owner under
// shared/hooks; runtime sync must never prefer a same-named runtime copy.
export const SHARED_RUNTIME_HOOK_FILES = Object.freeze([
  "project-root.mjs",
  "utils.mjs",
  "skip-reminder.mjs",
  "spine-state-utils.mjs",
  "spine-state-gates.mjs",
  "spine-state.mjs",
  "activate-meta-theory-spine.mjs",
  "medusa-findings-surface.mjs",
]);

const CLAUDE_COMPATIBLE_HOOK_FILES = Object.freeze([
  "bash-readonly-whitelist.mjs",
  "block-dangerous-bash.mjs",
  "ecc-permission-cache-wrapper.mjs",
  "enforce-agent-dispatch.mjs",
  "graphify-context.mjs",
  "hook-i18n.mjs",
  "medusa-postscan-enqueue.mjs",
  "post-console-log-warn.mjs",
  "post-format.mjs",
  "post-typecheck.mjs",
  "stop-compaction.mjs",
  "stop-completion-guard.mjs",
  "stop-console-log-audit.mjs",
  "stop-memory-save.mjs",
  "stop-save-progress.mjs",
  "subagent-context.mjs",
]);

/**
 * Canonical source ownership for runtime-facing Hook entrypoints.
 *
 * A `claude` value for Codex/Cursor is an explicit compatibility declaration:
 * it never means "fall back to Claude when no owner is known". Runtime-neutral
 * state helpers remain in SHARED_RUNTIME_HOOK_FILES, while entrypoints that may
 * diverge keep an explicit per-runtime owner here.
 */
export const RUNTIME_HOOK_SOURCE_OWNERS = Object.freeze({
  ...Object.fromEntries(
    CLAUDE_COMPATIBLE_HOOK_FILES.map((fileName) => [
      fileName,
      Object.freeze({ claude: "claude", codex: "claude", cursor: "claude" }),
    ]),
  ),
  "meta-kim-memory-save.mjs": Object.freeze({
    claude: "claude",
    codex: "shared",
    cursor: "shared",
  }),
  "stop-spine-cleanup.mjs": Object.freeze({
    claude: "claude",
    codex: "shared",
    cursor: "shared",
  }),
  // OpenClaw currently consumes only this explicitly compatible entrypoint.
  "stop-save-progress.mjs": Object.freeze({
    claude: "claude",
    codex: "claude",
    cursor: "claude",
    openclaw: "claude",
  }),
});

export function runtimeHookSourceOwner(runtimeId, fileName) {
  if (SHARED_RUNTIME_HOOK_FILES.includes(fileName)) {
    if (!["claude", "codex", "cursor"].includes(runtimeId)) {
      return null;
    }
    return "shared";
  }
  const owner = RUNTIME_HOOK_SOURCE_OWNERS[fileName]?.[runtimeId];
  if (owner) return owner;
  return null;
}

export function commandToken(value) {
  const normalized = String(value).replace(/\\/gu, "/");
  return /[\s"]/u.test(normalized) ? JSON.stringify(normalized) : normalized;
}

export function nodeHookCommand(scriptPath, args = [], nodeExecutable = "node") {
  return [nodeExecutable, scriptPath, ...args].map(commandToken).join(" ");
}

export function hookCommand(command, timeout, extra = {}) {
  return {
    ...extra,
    type: "command",
    command,
    ...(timeout ? { timeout } : {}),
  };
}

const PROJECT_RUNTIME_ADAPTER_HOOK_FILES = Object.freeze([
  "codex_hook_adapter.py",
  "codex_hook_runner.mjs",
  "hookprompt-adapter.mjs",
  "permission_request.py",
  "planning-with-files-adapter.mjs",
  "post-tool-use.ps1",
  "post-tool-use.sh",
  "post_tool_use.py",
  "pre-compact.sh",
  "pre-git-push-confirm.mjs",
  "pre-tool-use.ps1",
  "pre-tool-use.sh",
  "pre_tool_use.py",
  "resolve-plan-dir.sh",
  "session-start.sh",
  "session_start.py",
  "stop.ps1",
  "stop.py",
  "stop.sh",
  "user-prompt-submit.sh",
  "user_prompt_submit.py",
]);

const PROJECT_META_KIM_HOOK_FILES = new Set([
  ...SHARED_RUNTIME_HOOK_FILES,
  ...Object.keys(RUNTIME_HOOK_SOURCE_OWNERS),
  ...PROJECT_RUNTIME_ADAPTER_HOOK_FILES,
]);

export function isProjectMetaKimHookCommand(command) {
  if (typeof command !== "string") return false;
  const normalized = command.replace(/\\\\/g, "\\").replace(/\\/g, "/");
  const hasProjectHookDir =
    normalized.includes(".claude/hooks/") ||
    normalized.includes(".codex/hooks/") ||
    normalized.includes(".cursor/hooks/") ||
    normalized.includes("openclaw/hooks/");
  if (!hasProjectHookDir) return false;
  return [...PROJECT_META_KIM_HOOK_FILES].some(
    (file) =>
      normalized.endsWith(file) ||
      normalized.includes(`/hooks/${file}`) ||
      normalized.includes(`/mcp-memory-service/${file}`),
  );
}

function stripProjectMetaKimHooksFromList(entries = []) {
  const kept = [];
  for (const entry of entries) {
    if (entry && Array.isArray(entry.hooks)) {
      const hooks = entry.hooks.filter(
        (hook) => !isProjectMetaKimHookCommand(hook?.command ?? ""),
      );
      if (hooks.length > 0) {
        kept.push({ ...entry, hooks });
      }
      continue;
    }
    if (isProjectMetaKimHookCommand(entry?.command ?? "")) {
      continue;
    }
    kept.push(entry);
  }
  return kept;
}

export function stripProjectMetaKimHooksFromHookConfig(config = {}) {
  const next = structuredClone(config && typeof config === "object" ? config : {});
  const hooks = {};
  for (const [event, entries] of Object.entries(next.hooks ?? {})) {
    const kept = Array.isArray(entries)
      ? stripProjectMetaKimHooksFromList(entries)
      : entries;
    if (!Array.isArray(kept) || kept.length > 0) {
      hooks[event] = kept;
    }
  }
  next.hooks = hooks;
  return next;
}

export function buildHookPromptAdapterSource(runtimeId) {
  return [
    'import { spawnSync } from "node:child_process";',
    'import { existsSync, readFileSync } from "node:fs";',
    'import path from "node:path";',
    'import process from "node:process";',
    'import { fileURLToPath } from "node:url";',
    "",
    "function readPayload() {",
    "  try {",
    '    const raw = readFileSync(0, "utf8");',
    '    return raw.trim() ? JSON.parse(raw) : {};',
    "  } catch {",
    "    return {};",
    "  }",
    "}",
    "",
    "function promptFromPayload(payload) {",
    '  for (const key of ["prompt", "user_prompt", "input", "text"]) {',
    '    if (typeof payload[key] === "string" && payload[key].trim()) return payload[key];',
    "  }",
    "  const messages = payload.messages;",
    "  if (Array.isArray(messages)) {",
    "    for (let index = messages.length - 1; index >= 0; index -= 1) {",
    "      const message = messages[index];",
    '      if (message?.role !== "user") continue;',
    '      if (typeof message.content === "string") return message.content;',
    "      if (Array.isArray(message.content)) {",
    "        const parts = message.content",
    '          .map((part) => typeof part === "string" ? part : part?.text)',
    "          .filter(Boolean);",
    '        if (parts.length) return parts.join("\\n");',
    "      }",
    "    }",
    "  }",
    '  return "";',
    "}",
    "",
    "function findHookPromptScript() {",
    "  const candidates = [];",
    "  const hookDir = path.dirname(fileURLToPath(import.meta.url));",
    '  candidates.push(path.join(hookDir, "user-prompt-submit.js"));',
    '  candidates.push(path.join(hookDir, "hookprompt", "user-prompt-submit.js"));',
    '  candidates.push(path.join(hookDir, "..", "skills", "hookprompt", ".codex", "hooks", "user-prompt-submit.js"));',
    '  candidates.push(path.join(hookDir, "..", "skills", "hookprompt", ".claude", "hooks", "user-prompt-submit.js"));',
    '  candidates.push(path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude", "hooks", "user-prompt-submit.js"));',
    "  return candidates.find((candidate) => candidate && existsSync(candidate));",
    "}",
    "",
    "function parseClaudeAdditionalContext(stdout) {",
    "  try {",
    "    const parsed = JSON.parse(stdout);",
    '    return parsed?.hookSpecificOutput?.additionalContext || "";',
    "  } catch {",
    '    return "";',
    "  }",
    "}",
    "",
    "function emitAdditionalContext(additionalContext) {",
    `  const runtimeId = ${JSON.stringify(runtimeId)};`,
    '  if (runtimeId === "cursor") {',
    "    console.log(JSON.stringify({ prompt: additionalContext }));",
    "    return;",
    "  }",
    "  console.log(JSON.stringify({",
    "    hookSpecificOutput: {",
    '      hookEventName: "UserPromptSubmit",',
    "      additionalContext,",
    "    },",
    "  }));",
    "}",
    "",
    "const payload = readPayload();",
    "const prompt = promptFromPayload(payload);",
    "const script = findHookPromptScript();",
    "if (prompt && script) {",
    '  const result = spawnSync(process.execPath, [script], {',
    '    input: JSON.stringify({ prompt }),',
    '    encoding: "utf8",',
    '    windowsHide: true,',
    '    timeout: 10000,',
    "  });",
    "  const additionalContext = parseClaudeAdditionalContext(result.stdout || '');",
    "  if (additionalContext) {",
    "    emitAdditionalContext(additionalContext);",
    "  }",
    "}",
    "",
  ].join("\n");
}

export function buildCodexHooksJson({
  graphifyHookPath = ".codex/hooks/graphify-context.mjs",
  memoryHookPath = ".codex/hooks/meta-kim-memory-save.mjs",
  spineHookPath = ".codex/hooks/activate-meta-theory-spine.mjs",
  packageRoot = null,
  enforceAgentDispatchHookPath = ".codex/hooks/enforce-agent-dispatch.mjs",
  medusaEnqueueHookPath = ".codex/hooks/medusa-postscan-enqueue.mjs",
  medusaSurfaceHookPath = ".codex/hooks/medusa-findings-surface.mjs",
  hookPromptAdapterPath = null,
  stopSpineCleanupHookPath = null,
  nodeExecutable = "node",
} = {}) {
  const nodeCommand = (scriptPath, args = []) =>
    nodeHookCommand(scriptPath, args, nodeExecutable);
  const userPromptHooks = [];
  const spineHookArgs = packageRoot ? ["--package-root", packageRoot] : [];
  if (spineHookPath) {
    userPromptHooks.push(hookCommand(nodeCommand(spineHookPath, spineHookArgs), 5));
  }
  if (memoryHookPath) {
    userPromptHooks.push(
      hookCommand(nodeCommand(memoryHookPath, ["--event", "user-prompt"]), 10),
    );
  }
  if (medusaSurfaceHookPath) {
    userPromptHooks.push(
      hookCommand(nodeCommand(medusaSurfaceHookPath, ["--event", "user-prompt"]), 5),
    );
  }
  if (hookPromptAdapterPath) {
    userPromptHooks.push(hookCommand(nodeCommand(hookPromptAdapterPath), 10));
  }

  const hooks = {
    UserPromptSubmit: [
      {
        hooks: userPromptHooks,
      },
    ],
    PreToolUse: [
      // Capability-first + meta-readonly deny gate must run before any other
      // PreToolUse logic so it can short-circuit unsafe dispatches.
      {
        matcher: "Bash|apply_patch|Edit|Write|MultiEdit|NotebookEdit|Agent|spawn_agent|followup_task|collaboration\\.spawn_agent|collaboration\\.followup_task",
        hooks: [
          hookCommand(
            nodeCommand(enforceAgentDispatchHookPath, ["--runtime", "codex"]),
            10,
          ),
        ],
      },
      {
        matcher: "Bash",
        hooks: [hookCommand(nodeCommand(graphifyHookPath))],
      },
    ],
    Skill: [
      {
        matcher: "meta-theory",
        hooks: [hookCommand(nodeCommand(spineHookPath, spineHookArgs), 5)],
      },
    ],
  };

  if (medusaEnqueueHookPath) {
    hooks.PostToolUse = [
      // Medusa AI-context content scan, enqueue path. Cheap, non-blocking;
      // worker is spawned detached and writes findings asynchronously.
      {
        matcher: "Edit|Write|MultiEdit|NotebookEdit|apply_patch",
        hooks: [hookCommand(nodeCommand(medusaEnqueueHookPath), 5)],
      },
    ];
  }

  if (memoryHookPath) {
    hooks.SessionStart = [
      {
        matcher: "startup|resume",
        hooks: [
          hookCommand(nodeCommand(memoryHookPath, ["--event", "session-start"]), 10, {
            statusMessage: "Loading Meta_Kim memory",
          }),
        ],
      },
    ];
  }
  const stopHooks = [];
  if (memoryHookPath) {
    stopHooks.push(
      hookCommand(nodeCommand(memoryHookPath, ["--event", "stop"]), 10),
    );
  }
  if (stopSpineCleanupHookPath) {
    stopHooks.push(hookCommand(nodeCommand(stopSpineCleanupHookPath), 10));
  }
  if (stopHooks.length > 0) {
    hooks.Stop = [
      {
        matcher: "*",
        hooks: stopHooks,
      },
    ];
  }
  if (medusaSurfaceHookPath) {
    const surfaceSessionStart = hookCommand(
      nodeCommand(medusaSurfaceHookPath, ["--event", "session-start"]),
      5,
    );
    const surfaceStop = hookCommand(
      nodeCommand(medusaSurfaceHookPath, ["--event", "stop"]),
      5,
    );
    if (hooks.SessionStart) {
      hooks.SessionStart[0].hooks.push(surfaceSessionStart);
    } else {
      hooks.SessionStart = [{ matcher: "startup|resume", hooks: [surfaceSessionStart] }];
    }
    if (hooks.Stop) {
      hooks.Stop[0].hooks.push(surfaceStop);
    } else {
      hooks.Stop = [{ hooks: [surfaceStop] }];
    }
  }
  if (hooks.UserPromptSubmit[0].hooks.length === 0) {
    delete hooks.UserPromptSubmit;
  }

  return {
    hooks: {
      ...hooks,
    },
  };
}

export function buildCursorHooksJson({
  graphifyHookPath = ".cursor/hooks/graphify-context.mjs",
  memoryHookPath = ".cursor/hooks/meta-kim-memory-save.mjs",
  spineHookPath = ".cursor/hooks/activate-meta-theory-spine.mjs",
  packageRoot = null,
  enforceAgentDispatchHookPath = ".cursor/hooks/enforce-agent-dispatch.mjs",
  medusaEnqueueHookPath = ".cursor/hooks/medusa-postscan-enqueue.mjs",
  medusaSurfaceHookPath = ".cursor/hooks/medusa-findings-surface.mjs",
  hookPromptAdapterPath = null,
  nodeExecutable = "node",
} = {}) {
  const nodeCommand = (scriptPath, args = []) =>
    nodeHookCommand(scriptPath, args, nodeExecutable);
  const spineHookArgs = packageRoot ? ["--package-root", packageRoot] : [];
  const beforeSubmitPromptHooks = [
    {
      command: nodeCommand(spineHookPath, spineHookArgs),
      timeout: 5,
    },
    {
      command: nodeCommand(medusaSurfaceHookPath, ["--event", "user-prompt"]),
      timeout: 5,
    },
  ];
  if (memoryHookPath) {
    beforeSubmitPromptHooks.push({
      command: nodeCommand(memoryHookPath, ["--event", "user-prompt"]),
      timeout: 10,
    });
  }
  if (hookPromptAdapterPath) {
    beforeSubmitPromptHooks.push({
      command: nodeCommand(hookPromptAdapterPath),
      timeout: 10,
    });
  }

  const hooks = {
    beforeSubmitPrompt: beforeSubmitPromptHooks,
    preToolUse: [
      // Capability-first + meta-readonly deny gate. failClosed=true ensures
      // Cursor honors the deny payload even if the hook crashes.
      {
        command: nodeCommand(enforceAgentDispatchHookPath, ["--runtime", "cursor"]),
        timeout: 10,
        failClosed: true,
      },
      {
        command: nodeCommand(graphifyHookPath),
      },
    ],
  };
  if (memoryHookPath) {
    hooks.sessionStart = [
      {
        command: nodeCommand(memoryHookPath, ["--event", "session-start"]),
        timeout: 10,
      },
    ];
    hooks.stop = [
      {
        command: nodeCommand(memoryHookPath, ["--event", "stop"]),
        timeout: 10,
      },
    ];
  }
  if (medusaEnqueueHookPath) {
    // Medusa AI-context content scan, enqueue path. Stays fail-open: no
    // failClosed flag — a slow/missing Python must never block edits.
    hooks.postToolUse = [
      {
        command: nodeCommand(medusaEnqueueHookPath),
        timeout: 5,
      },
    ];
  }
  if (medusaSurfaceHookPath) {
    const surfaceSessionStart = {
      command: nodeCommand(medusaSurfaceHookPath, ["--event", "session-start"]),
      timeout: 5,
    };
    const surfaceStop = {
      command: nodeCommand(medusaSurfaceHookPath, ["--event", "stop"]),
      timeout: 5,
    };
    hooks.sessionStart = [...(hooks.sessionStart || []), surfaceSessionStart];
    hooks.stop = [...(hooks.stop || []), surfaceStop];
  }

  return {
    version: 1,
    hooks,
  };
}
