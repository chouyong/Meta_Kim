import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { recordSetupRuntimeExecutableBindings } from "../../scripts/runtime-executable-binding.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

test("global sync installs the project model-chain Skill only for Claude and Codex", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "meta-kim-project-chain-skill-"));
  try {
    const env = {
      ...process.env,
      HOME: root,
      USERPROFILE: root,
      META_KIM_CLAUDE_HOME: path.join(root, "claude"),
      META_KIM_CODEX_HOME: path.join(root, "codex"),
      META_KIM_CURSOR_HOME: path.join(root, "cursor"),
      META_KIM_OPENCLAW_HOME: path.join(root, "openclaw"),
    };
    const result = spawnSync(
      process.execPath,
      [
        "scripts/sync-global-meta-theory.mjs",
        "--targets",
        "claude,codex,cursor,openclaw",
        "--skip-durable-mcp",
      ],
      { cwd: repoRoot, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);

    for (const runtimeId of ["claude", "codex"]) {
      const skillRoot = path.join(root, runtimeId, "skills", "project-model-chain-concurrency");
      const skill = readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
      const helper = readFileSync(
        path.join(skillRoot, "scripts", "project_model_chain_concurrency.ps1"),
        "utf8",
      );
      assert.match(skill, /Enter-ProjectModelChainLock/);
      assert.match(helper, /Local\\MetaKimProjectModelChainV1-/);
      assert.match(helper, /Local\\CodexClaudeCliProjectChainV2-/);
    }

    for (const runtimeId of ["cursor", "openclaw"]) {
      assert.throws(() =>
        readFileSync(
          path.join(root, runtimeId, "skills", "project-model-chain-concurrency", "SKILL.md"),
          "utf8",
        )
      );
    }

    recordSetupRuntimeExecutableBindings({
      roots: [path.resolve(root)],
      targets: ["claude", "codex"],
      pathResolver: () => process.execPath,
    });
    const check = spawnSync(
      process.execPath,
      [
        "scripts/sync-global-meta-theory.mjs",
        "--check",
        "--targets",
        "claude,codex,cursor,openclaw",
        "--skip-durable-mcp",
      ],
      { cwd: repoRoot, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(check.status, 0, `${check.stderr}\n${check.stdout}`);
    assert.match(check.stdout, /global project-model-chain-concurrency skill/);
  }
  finally {
    rmSync(root, { recursive: true, force: true });
  }
});
