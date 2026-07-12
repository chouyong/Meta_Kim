import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

// Regression coverage for the P1 project-root gate: the meta-theory spine
// activate hook and the post-copy init script must never bootstrap/project
// state into an arbitrary cwd (e.g. a temp dir a stray invocation runs in).
// They may only project at a *legitimate* project root, resolved from
// CLAUDE_PROJECT_DIR / a payload workspace root, or a strong cwd marker
// (.git or the meta-kim project-bootstrap manifest).

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SHARED_HOOKS = path.join(
  REPO_ROOT,
  "canonical",
  "runtime-assets",
  "shared",
  "hooks",
);
const POST_COPY_SCRIPT = path.join(
  REPO_ROOT,
  "scripts",
  "project-post-copy-init.mjs",
);

// Deterministically triggers meta-theory activation via the skill-activation
// path, so the test exercises the project-root gate rather than the
// prompt-classification heuristics.
const TRIGGER_PAYLOAD = JSON.stringify({
  tool_name: "Skill",
  tool_input: { skill_name: "meta-theory" },
});

function envWithoutProjectDir() {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  return env;
}

function stageActivateHook(cwd) {
  const hookDir = path.join(cwd, "hooks");
  mkdirSync(hookDir, { recursive: true });
  for (const fileName of [
    "activate-meta-theory-spine.mjs",
    "spine-state.mjs",
    "spine-state-utils.mjs",
    "utils.mjs",
  ]) {
    copyFileSync(path.join(SHARED_HOOKS, fileName), path.join(hookDir, fileName));
  }
  return path.join(hookDir, "activate-meta-theory-spine.mjs");
}

function runActivate(hookPath, cwd) {
  return spawnSync(process.execPath, [hookPath], {
    cwd,
    input: TRIGGER_PAYLOAD,
    encoding: "utf8",
    timeout: 15000,
    windowsHide: true,
    env: envWithoutProjectDir(),
  });
}

function spineStatePath(cwd) {
  return path.join(
    cwd,
    ".meta-kim",
    "state",
    "default",
    "spine",
    "spine-state.json",
  );
}

describe("P1: meta-theory spine activate project-root gate", () => {
  test("does not project into a non-project temp dir", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "meta-kim-noproj-"));
    try {
      const hookPath = stageActivateHook(cwd);
      const result = runActivate(hookPath, cwd);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(
        existsSync(path.join(cwd, ".meta-kim")),
        false,
        "activate must not project .meta-kim state into a non-project dir",
      );
      assert.equal(
        existsSync(path.join(cwd, "graphify-out")),
        false,
        "activate must not bootstrap graphify into a non-project dir",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("projects spine state at a .git-marked project root", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "meta-kim-git-"));
    try {
      mkdirSync(path.join(cwd, ".git"), { recursive: true });
      const hookPath = stageActivateHook(cwd);
      const result = runActivate(hookPath, cwd);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(
        existsSync(spineStatePath(cwd)),
        true,
        "activate must project spine state at a .git project root",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("projects spine state at a bootstrap-manifest project root", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "meta-kim-manifest-"));
    try {
      const manifestDir = path.join(cwd, ".meta-kim", "state", "default");
      mkdirSync(manifestDir, { recursive: true });
      writeFileSync(
        path.join(manifestDir, "project-bootstrap.json"),
        JSON.stringify({ schemaVersion: "meta-kim-project-bootstrap-v0.1" }, null, 2),
        "utf8",
      );
      const hookPath = stageActivateHook(cwd);
      const result = runActivate(hookPath, cwd);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(
        existsSync(spineStatePath(cwd)),
        true,
        "activate must project spine state at a project-bootstrap-manifest root",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("P1: project-post-copy-init project-root gate", () => {
  test("no-ops (exit 0, no bootstrap) in a non-project temp dir", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "meta-kim-postcopy-"));
    try {
      const result = spawnSync(process.execPath, [POST_COPY_SCRIPT], {
        cwd,
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
        env: envWithoutProjectDir(),
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(
        existsSync(path.join(cwd, ".meta-kim")),
        false,
        "post-copy init must not write .meta-kim state into a non-project dir",
      );
      assert.equal(
        existsSync(path.join(cwd, "graphify-out")),
        false,
        "post-copy init must not bootstrap graphify into a non-project dir",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
