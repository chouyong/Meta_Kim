import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HOOK_ROOT = process.env.META_KIM_HOOK_CONTRACT_ROOT
  ? path.resolve(process.env.META_KIM_HOOK_CONTRACT_ROOT)
  : path.join(REPO_ROOT, "canonical", "runtime-assets", "shared", "hooks");

function runHook(scriptPath, cwd, args = [], env = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    input: JSON.stringify({ cwd }),
    encoding: "utf8",
    env: { ...process.env, ...env },
    windowsHide: true,
  });
}

async function importSpineState() {
  const moduleUrl = pathToFileURL(path.join(HOOK_ROOT, "spine-state.mjs"));
  moduleUrl.searchParams.set("stopOutputContract", `${Date.now()}-${Math.random()}`);
  return import(moduleUrl.href);
}

async function seedFinding(root) {
  const medusaDir = path.join(root, ".meta-kim", "state", "default", "medusa");
  await mkdir(medusaDir, { recursive: true });
  await writeFile(
    path.join(medusaDir, "findings.jsonl"),
    `${JSON.stringify({
      file: path.join(root, "AGENTS.md"),
      sha256: "a".repeat(64),
      scannedAt: "2026-09-18T00:00:00.000Z",
      summary: { CRITICAL: 0, HIGH: 1, MEDIUM: 0 },
    })}\n`,
    "utf8",
  );
}

describe("runtime Stop hook output contracts", () => {
  test("Codex/Cursor spine cleanup stays silent while terminalizing state", async () => {
    const spine = await importSpineState();
    const stopScript = path.join(HOOK_ROOT, "stop-spine-cleanup.mjs");

    for (const runtime of ["codex", "cursor"]) {
      const root = await mkdtemp(path.join(os.tmpdir(), `meta-kim-${runtime}-stop-output-`));
      try {
        const state = spine.advanceStage(
          spine.createInitialState({ taskClassification: `${runtime}_stop_output` }),
          "fetch",
        );
        await spine.writeSpineState(root, state);

        const result = runHook(stopScript, root, [], { META_KIM_HOOK_RUNTIME: runtime });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, "", `${runtime} Stop cleanup must not write stdout`);
        assert.equal(result.stderr, "", `${runtime} treats non-empty Stop stderr as Hook failed`);

        const stopped = JSON.parse(
          await readFile(
            path.join(root, ".meta-kim", "state", "default", "spine", "spine-state.json"),
            "utf8",
          ),
        );
        assert.equal(stopped.active, false);
        assert.equal(stopped.deactivationReason, "session_stop");
        assert.equal(stopped.deactivationTrigger, "stop_hook_turn_boundary");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  test("Codex/Cursor medusa Stop stays silent while git-diff fallback enqueues work", async () => {
    const sourceScript = path.join(HOOK_ROOT, "medusa-findings-surface.mjs");

    for (const runtime of ["codex", "cursor"]) {
      const root = await mkdtemp(path.join(os.tmpdir(), `meta-kim-${runtime}-medusa-output-`));
      try {
        const isolatedHookDir = path.join(root, "isolated-hooks");
        await mkdir(isolatedHookDir, { recursive: true });
        const isolatedScript = path.join(isolatedHookDir, "medusa-findings-surface.mjs");
        await copyFile(sourceScript, isolatedScript);

        const init = spawnSync("git", ["init", "--quiet"], {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
        });
        assert.equal(init.status, 0, init.stderr);
        const agentPath = path.join(root, "AGENTS.md");
        await writeFile(agentPath, "baseline\n", "utf8");
        const add = spawnSync("git", ["add", "AGENTS.md"], {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
        });
        assert.equal(add.status, 0, add.stderr);
        await writeFile(agentPath, "baseline\nchanged\n", "utf8");

        const result = runHook(isolatedScript, root, ["--event", "stop"], {
          META_KIM_HOOK_RUNTIME: runtime,
        });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, "", `${runtime} medusa Stop must not write stdout`);
        assert.equal(result.stderr, "", `${runtime} treats informational Stop stderr as Hook failed`);

        const queueText = await readFile(
          path.join(root, ".meta-kim", "state", "default", "medusa", "queue.jsonl"),
          "utf8",
        );
        const queued = queueText.trim().split("\n").map((line) => JSON.parse(line));
        assert.equal(queued.length, 1);
        assert.equal(queued[0].origin, "stop-diff-fallback");
        assert.match(queued[0].file.replace(/\\/g, "/"), /\/AGENTS\.md$/iu);
        assert.equal(queued[0].status, "pending");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  test("Claude medusa Stop keeps its informational stderr summary", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "meta-kim-claude-medusa-output-"));
    try {
      await seedFinding(root);
      const result = runHook(
        path.join(HOOK_ROOT, "medusa-findings-surface.mjs"),
        root,
        ["--event", "stop"],
        { META_KIM_HOOK_RUNTIME: "claude" },
      );

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /AI-context findings: 0 CRITICAL, 1 HIGH, 0 MEDIUM/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
