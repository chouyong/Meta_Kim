import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn as childProcessDiagnosticMarker } from "node:child_process";
import {
  existsSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { runCommandWithIgnoredStdin } from "../../scripts/eval-process-runner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const SYNC_COMMAND_TIMEOUT_MS = 300_000;

async function runNodeCommand(args, env = process.env) {
  try {
    const result = await runCommandWithIgnoredStdin(process.execPath, args, {
      cwd: repoRoot,
      env,
      timeout: SYNC_COMMAND_TIMEOUT_MS,
    });
    return { status: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (error?.code !== "META_KIM_CHILD_COMMAND_FAILED") throw error;
    return {
      status: error.exitCode,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

async function runSyncCheck(targets) {
  const result = await runSyncCheckResult(targets);
  return (result.stdout || "") + (result.stderr || "");
}

function runSyncCheckResult(targets, extraEnv = {}) {
  return runNodeCommand(
    [
      "scripts/sync-runtimes.mjs",
      "--check",
      "--json",
      "--targets",
      targets,
    ],
    { ...process.env, ...extraEnv },
  );
}

function createTempSourceRepoFixture() {
  const tempRoot = mkdtempSync(join(os.tmpdir(), "meta-kim-source-repo-"));
  cpSync(join(repoRoot, "package.json"), join(tempRoot, "package.json"));
  cpSync(join(repoRoot, "config"), join(tempRoot, "config"), { recursive: true });
  cpSync(join(repoRoot, "canonical"), join(tempRoot, "canonical"), { recursive: true });
  return tempRoot;
}

function runSyncGlobal(targets, extraEnv = {}) {
  const runtimeHome =
    extraEnv.META_KIM_CODEX_HOME ?? extraEnv.META_KIM_CLAUDE_HOME ?? null;
  const isolatedUserHome = runtimeHome ? dirname(runtimeHome) : null;
  return runNodeCommand(
    [
      "scripts/sync-global-meta-theory.mjs",
      "--targets",
      targets,
      "--with-global-hooks",
      "--skip-durable-mcp",
    ],
    {
      ...process.env,
      ...(isolatedUserHome
        ? { HOME: isolatedUserHome, USERPROFILE: isolatedUserHome }
        : {}),
      ...extraEnv,
    },
  );
}

function runProjectSyncFromFixture(tempRoot, args = []) {
  return runNodeCommand(
    ["scripts/sync-runtimes.mjs", ...args],
    {
      ...process.env,
      META_KIM_REPO_ROOT: tempRoot,
      META_KIM_CALLER_CWD: tempRoot,
    },
  );
}

describe("runtime hook sync contract", () => {
  assert.equal(typeof childProcessDiagnosticMarker, "function");

  test("source repo project check treats absent runtime projections as expected", async () => {
    const tempRoot = createTempSourceRepoFixture();
    try {
      const result = await runSyncCheckResult("claude,codex,cursor,openclaw", {
        META_KIM_REPO_ROOT: tempRoot,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, "source_repo_project_projections_absent");
      assert.equal(summary.total, 0);
      assert.equal(summary.sourceRepoProjectProjections.expectedAbsent, true);
      assert.equal(summary.staleFiles.length, 0);
      assert.ok(summary.sourceRepoProjectProjections.skippedStaleFiles > 0);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("source repo project check ignores empty projection directories", async () => {
    const tempRoot = createTempSourceRepoFixture();
    const claudeRoot = join(tempRoot, ".claude");
    const emptyHooksDir = join(claudeRoot, "hooks");

    try {
      mkdirSync(emptyHooksDir, { recursive: true });

      const result = await runSyncCheckResult("claude", {
        META_KIM_REPO_ROOT: tempRoot,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, "source_repo_project_projections_absent");
      assert.equal(summary.total, 0);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("project sync does not generate repo-local hook files", async () => {
    const output = (await runSyncCheck("claude")).replace(/\\/g, "/");
    assert.doesNotMatch(output, /\.claude\/hooks\//);
  });

  test("global_only project sync keeps Claude Codex Cursor hook dependency pairs resolvable", async () => {
    const tempRoot = createTempSourceRepoFixture();
    try {
      const overrideDir = join(tempRoot, ".meta-kim");
      mkdirSync(overrideDir, { recursive: true });
      writeFileSync(
        join(overrideDir, "local.overrides.json"),
        `${JSON.stringify({ projectProjectionMode: "global_only" }, null, 2)}\n`,
      );

      const retiredHookSentinel = "// user-owned legacy basename\n";
      for (const runtimeDir of [".claude", ".codex", ".cursor"]) {
        const hooksDir = join(tempRoot, runtimeDir, "hooks");
        mkdirSync(hooksDir, { recursive: true });
        writeFileSync(
          join(hooksDir, "hook-i18n.mjs"),
          retiredHookSentinel,
          "utf8",
        );
      }

      const sync = await runProjectSyncFromFixture(tempRoot);
      assert.equal(sync.status, 0, sync.stderr || sync.stdout);
      assert.doesNotMatch(
        sync.stdout + sync.stderr,
        /missing canonical.*hook-i18n|缺失的 canonical.*hook-i18n/iu,
      );

      for (const runtimeDir of [".claude", ".codex", ".cursor"]) {
        const hooksDir = join(tempRoot, runtimeDir, "hooks");
        const activatorPath = join(hooksDir, "activate-meta-theory-spine.mjs");
        const projectRootPath = join(hooksDir, "project-root.mjs");
        const spineStateGatesPath = join(hooksDir, "spine-state-gates.mjs");
        assert.equal(
          existsSync(activatorPath),
          true,
          `${runtimeDir} activator missing\n${sync.stdout}\n${sync.stderr}`,
        );
        assert.equal(existsSync(projectRootPath), true, `${runtimeDir} project-root missing`);
        assert.equal(
          existsSync(spineStateGatesPath),
          true,
          `${runtimeDir} spine-state gate dependency missing`,
        );
        assert.match(
          readFileSync(activatorPath, "utf8"),
          /from "\.\/project-root\.mjs"/u,
          `${runtimeDir} activator must resolve its paired project-root dependency`,
        );
        assert.equal(
          readFileSync(join(hooksDir, "hook-i18n.mjs"), "utf8"),
          retiredHookSentinel,
          `${runtimeDir} same-name legacy file must be preserved without exact ownership proof`,
        );
      }

      assert.equal(existsSync(join(tempRoot, ".codex", "agents")), false);
      assert.equal(existsSync(join(tempRoot, ".cursor", "agents")), false);
      assert.equal(existsSync(join(tempRoot, ".agents", "skills")), false);

      const check = await runProjectSyncFromFixture(tempRoot, ["--check", "--json"]);
      assert.equal(check.status, 0, check.stderr || check.stdout);
      const summary = JSON.parse(check.stdout);
      assert.equal(summary.status, "ok");
      assert.deepEqual(summary.targets, []);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("global_only cleanup rejects a project runtime-root Junction without reading outside", async () => {
    const tempRoot = createTempSourceRepoFixture();
    const outsideRoot = mkdtempSync(join(os.tmpdir(), "meta-kim-global-only-outside-"));
    try {
      mkdirSync(join(tempRoot, ".meta-kim"), { recursive: true });
      writeFileSync(join(tempRoot, ".meta-kim", "local.overrides.json"), `${JSON.stringify({ projectProjectionMode: "global_only" }, null, 2)}\n`);
      mkdirSync(join(tempRoot, ".agents"), { recursive: true });
      writeFileSync(join(outsideRoot, "outside.txt"), "preserve\n");
      symlinkSync(outsideRoot, join(tempRoot, ".agents", "skills"), process.platform === "win32" ? "junction" : "dir");

      const result = await runProjectSyncFromFixture(tempRoot);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr + result.stdout, /Refusing to follow a project symlink or Junction/u);
      assert.equal(readFileSync(join(outsideRoot, "outside.txt"), "utf8"), "preserve\n");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  test("global runtime sync rejects a runtime-home junction into the immutable package store", async () => {
    const root = mkdtempSync(join(os.tmpdir(), "meta-kim-global-store-junction-"));
    try {
      const storeRoot = join(
        root,
        ".meta-kim",
        "runtime",
        "projection-packages",
      );
      const claudeHome = join(root, "claude");
      mkdirSync(storeRoot, { recursive: true });
      symlinkSync(
        storeRoot,
        claudeHome,
        process.platform === "win32" ? "junction" : "dir",
      );

      const result = await runNodeCommand(
        [
          "scripts/sync-runtimes.mjs",
          "--scope",
          "global",
          "--targets",
          "claude",
          "--global-assets",
          "hooks",
        ],
        {
          ...process.env,
          HOME: root,
          USERPROFILE: root,
          META_KIM_CLAUDE_HOME: claudeHome,
        },
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr + result.stdout, /immutable package store/u);
      assert.deepEqual(readdirSync(storeRoot), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("global_only cleanup preserves descendant files inside a runtime-sedimented Skill root", async () => {
    const tempRoot = createTempSourceRepoFixture();
    try {
      const stateRoot = join(tempRoot, ".meta-kim", "state", "default");
      const skillRoot = join(tempRoot, ".agents", "skills", "custom-project-skill");
      const skillFile = join(skillRoot, "SKILL.md");
      const childFile = join(skillRoot, "references", "user-note.md");
      mkdirSync(join(skillRoot, "references"), { recursive: true });
      mkdirSync(stateRoot, { recursive: true });
      writeFileSync(skillFile, "# custom skill\n");
      writeFileSync(childFile, "# user note\n");
      writeFileSync(join(tempRoot, ".meta-kim", "local.overrides.json"), `${JSON.stringify({ projectProjectionMode: "global_only" }, null, 2)}\n`);
      writeFileSync(join(stateRoot, "project-capabilities.json"), `${JSON.stringify({
        schemaVersion: "meta-kim-project-capabilities-v0.1",
        capabilities: [{
          type: "skill",
          ownershipClass: "runtime_sedimented_project_copy",
          dependencyUpdatePolicy: "preserve_project_copy",
          files: [{ relPath: ".agents/skills/custom-project-skill/SKILL.md" }],
        }],
      }, null, 2)}\n`);
      const childBytes = readFileSync(childFile);
      const now = new Date().toISOString();
      writeFileSync(join(tempRoot, ".meta-kim", "install-manifest.json"), `${JSON.stringify({
        schemaVersion: 1,
        scope: "project",
        metaKimVersion: "test",
        repoRoot: tempRoot,
        createdAt: now,
        updatedAt: now,
        entries: [{
          path: childFile,
          category: "D",
          source: "sync-runtimes",
          purpose: "project-skill",
          kind: "file",
          installedAt: now,
          sha256: createHash("sha256").update(childBytes).digest("hex"),
          size: childBytes.length,
        }],
      }, null, 2)}\n`);

      const result = await runProjectSyncFromFixture(tempRoot);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(readFileSync(childFile, "utf8"), "# user note\n");
      assert.equal(readFileSync(skillFile, "utf8"), "# custom skill\n");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("global sync includes the meta-theory spine activation hook package", () => {
    const source = readFileSync(
      join(repoRoot, "scripts/sync-global-meta-theory.mjs"),
      "utf8",
    );

    assert.match(
      source,
      /GLOBAL_HOOK_PACKAGE_FILES = new Set\(\[[\s\S]*"activate-meta-theory-spine\.mjs"/,
    );
    assert.equal(
      existsSync(
        join(
          repoRoot,
          "canonical/runtime-assets/shared/hooks/activate-meta-theory-spine.mjs",
        ),
      ),
      true,
    );
    assert.match(
      source,
      /GLOBAL_HOOK_PACKAGE_FILES = new Set\(\[[\s\S]*"project-root\.mjs"/,
    );
    assert.match(
      source,
      /GLOBAL_HOOK_PACKAGE_FILES = new Set\(\[[\s\S]*"spine-state-gates\.mjs"/,
    );
  });

  test("Codex global sync writes hooks and hook config to the Codex home", async () => {
    const root = mkdtempSync(join(os.tmpdir(), "meta-kim-codex-global-hooks-"));
    try {
      const codexHome = join(root, "codex");
      mkdirSync(join(codexHome, "hooks"), { recursive: true });
      writeFileSync(join(codexHome, "hooks", "graphify-context.mjs"), "");
      writeFileSync(join(codexHome, "hooks", "custom-user-hook.mjs"), "");

      const result = await runSyncGlobal("codex", {
        META_KIM_CODEX_HOME: codexHome,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(
        existsSync(join(codexHome, "hooks", "meta-kim", "graphify-context.mjs")),
        true,
      );
      assert.equal(
        existsSync(
          join(codexHome, "hooks", "meta-kim", "activate-meta-theory-spine.mjs"),
        ),
        true,
      );
      assert.equal(
        existsSync(join(codexHome, "hooks", "meta-kim", "project-root.mjs")),
        true,
      );
      assert.equal(
        existsSync(join(codexHome, "hooks", "meta-kim", "spine-state-gates.mjs")),
        true,
      );
      assert.equal(existsSync(join(codexHome, "hooks.json")), true);
      assert.equal(
        existsSync(join(codexHome, "hooks", "graphify-context.mjs")),
        true,
        "an unmanifested same-name root hook is user/unknown state and must be preserved",
      );
      assert.equal(existsSync(join(codexHome, "hooks", "custom-user-hook.mjs")), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Claude global sync keeps namespaced hook package entries", async () => {
    const root = mkdtempSync(join(os.tmpdir(), "meta-kim-claude-global-hooks-"));
    try {
      const claudeHome = join(root, "claude");
      mkdirSync(join(claudeHome, "hooks", "meta-kim"), { recursive: true });
      writeFileSync(
        join(claudeHome, "hooks", "meta-kim", "block-dangerous-bash.mjs"),
        "// installed by sync-global-meta-theory\n",
      );

      const result = await runSyncGlobal("claude", {
        META_KIM_CLAUDE_HOME: claudeHome,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(
        existsSync(join(claudeHome, "hooks", "meta-kim", "block-dangerous-bash.mjs")),
        true,
      );

      const settings = readFileSync(join(claudeHome, "settings.json"), "utf8");
      assert.match(settings, /hooks\/meta-kim\/activate-meta-theory-spine\.mjs/);
      assert.match(settings, /hooks\/meta-kim\/block-dangerous-bash\.mjs/);
      assert.doesNotMatch(settings, /node "\\.claude\/hooks\//);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("global target filtering does not touch Claude home when only Codex is selected", async () => {
    const root = mkdtempSync(join(os.tmpdir(), "meta-kim-global-target-filter-"));
    try {
      const claudeHome = join(root, "claude");
      const codexHome = join(root, "codex");
      mkdirSync(claudeHome, { recursive: true });
      const sentinel = `${JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "node user-stop.js" }] }] } }, null, 2)}\n`;
      writeFileSync(join(claudeHome, "settings.json"), sentinel);

      const result = await runSyncGlobal("codex", {
        META_KIM_CLAUDE_HOME: claudeHome,
        META_KIM_CODEX_HOME: codexHome,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(readFileSync(join(claudeHome, "settings.json"), "utf8"), sentinel);
      assert.equal(existsSync(join(claudeHome, "hooks", "meta-kim")), false);
      assert.equal(existsSync(join(codexHome, "hooks", "meta-kim")), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("global target filtering does not touch Codex home when only Claude is selected", async () => {
    const root = mkdtempSync(join(os.tmpdir(), "meta-kim-global-target-filter-"));
    try {
      const claudeHome = join(root, "claude");
      const codexHome = join(root, "codex");
      mkdirSync(codexHome, { recursive: true });
      const sentinel = `${JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ command: "node user-hook.mjs" }] }] } }, null, 2)}\n`;
      writeFileSync(join(codexHome, "hooks.json"), sentinel);

      const result = await runSyncGlobal("claude", {
        META_KIM_CLAUDE_HOME: claudeHome,
        META_KIM_CODEX_HOME: codexHome,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(readFileSync(join(codexHome, "hooks.json"), "utf8"), sentinel);
      assert.equal(existsSync(join(codexHome, "hooks", "meta-kim")), false);
      assert.equal(existsSync(join(claudeHome, "settings.json")), true);
      assert.equal(existsSync(join(claudeHome, "hooks", "meta-kim")), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("shared hook backup is not a canonical runtime asset", () => {
    assert.equal(
      existsSync(
        join(
          repoRoot,
          "canonical/runtime-assets/shared/hooks/skip-reminder.mjs.bak",
        ),
      ),
      false,
    );
  });
});
