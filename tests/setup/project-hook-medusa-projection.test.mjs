import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MEDUSA_PROJECT_HOOK_FILES,
  deployPlatformFiles,
  readProjectHookSource,
  isMetaKimManagedHookRelPath,
} from "../../setup.mjs";
import { scanSettingsFile } from "../../scripts/doctor-hooks.mjs";

const DOCTOR_PATH = fileURLToPath(
  new URL("../../scripts/doctor-hooks.mjs", import.meta.url),
);

// Regression for: a downstream consumer repo (no canonical/, no package.json)
// installed via setup.mjs got a .claude/settings.json (+ capability-index) that
// references medusa hooks, but the medusa .mjs/.py files were never projected
// into .claude/hooks/ — so the Stop/SessionStart hooks failed with
// MODULE_NOT_FOUND. Root cause: setup projected the medusa-referencing
// settings.json + capability-index but not the medusa hook files themselves
// (GLOBAL_HOOK_PACKAGE_FILES_LIST had no medusa; readProjectHookSource never
// searched canonical/runtime-assets/shared/scripts/).

function withTempProject(fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "meta-kim-project-medusa-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("setup project projection ships medusa hooks", () => {
  test("deployPlatformFiles('claude') writes all four medusa hook files", () => {
    withTempProject((dir) => {
      deployPlatformFiles("claude", dir);
      const hooksDir = path.join(dir, ".claude", "hooks");
      for (const fileName of MEDUSA_PROJECT_HOOK_FILES) {
        assert.ok(
          existsSync(path.join(hooksDir, fileName)),
          `expected projected medusa hook: .claude/hooks/${fileName}`,
        );
      }
    });
  });

  test("every hook referenced by the projected settings.json resolves on disk (no dangling)", () => {
    withTempProject((dir) => {
      deployPlatformFiles("claude", dir);
      const settingsPath = path.join(dir, ".claude", "settings.json");
      assert.ok(existsSync(settingsPath), "settings.json must be projected");

      // Resolve relative hook targets against the projected project root.
      const result = scanSettingsFile(settingsPath, dir);
      assert.equal(result.ok, true);
      assert.deepEqual(
        result.zombies.map((z) => z.path),
        [],
        `dangling hook references: ${result.zombies
          .map((z) => z.path)
          .join(", ")}`,
      );

      // Sanity: the medusa hooks are actually referenced and counted as live.
      const livePaths = result.live.map((l) => l.path).join(" ");
      assert.match(livePaths, /medusa-findings-surface\.mjs/);
      assert.match(livePaths, /medusa-postscan-enqueue\.mjs/);
    });
  });

  test("readProjectHookSource resolves shared/scripts medusa assets", () => {
    for (const fileName of ["medusa-worker.mjs", "medusa_batch_scan.py"]) {
      const content = readProjectHookSource("claude", fileName);
      assert.ok(
        typeof content === "string" && content.length > 0,
        `readProjectHookSource should find shared/scripts asset: ${fileName}`,
      );
    }
  });

  test("isMetaKimManagedHookRelPath recognizes medusa hooks incl. the .py helper", () => {
    assert.equal(
      isMetaKimManagedHookRelPath(".claude/hooks/medusa-findings-surface.mjs"),
      true,
    );
    assert.equal(
      isMetaKimManagedHookRelPath(".claude/hooks/medusa_batch_scan.py"),
      true,
    );
  });

  test("doctor project-root gate flags a deleted medusa hook as dangling", () => {
    withTempProject((dir) => {
      deployPlatformFiles("claude", dir);
      unlinkSync(
        path.join(dir, ".claude", "hooks", "medusa-findings-surface.mjs"),
      );
      const result = scanSettingsFile(
        path.join(dir, ".claude", "settings.json"),
        dir,
      );
      assert.equal(result.ok, true);
      assert.ok(
        result.zombies.some((z) =>
          String(z.path).endsWith("medusa-findings-surface.mjs"),
        ),
        "gate must detect the missing medusa hook referenced by settings.json",
      );
    });
  });

  test("deployPlatformFiles('all') projects medusa hooks and expands to every runtime", () => {
    withTempProject((dir) => {
      deployPlatformFiles("all", dir);

      // Root regression: platformId "all" used to write zero generated hooks
      // (projectHookGeneratedPlans had no "all" entry), so the projected
      // .claude/settings.json referenced medusa hooks that never landed →
      // MODULE_NOT_FOUND. All four medusa files must now be present under "all".
      const claudeHooks = path.join(dir, ".claude", "hooks");
      for (const fileName of MEDUSA_PROJECT_HOOK_FILES) {
        assert.ok(
          existsSync(path.join(claudeHooks, fileName)),
          `expected projected medusa hook under 'all': .claude/hooks/${fileName}`,
        );
      }

      // The projected Claude settings must have no dangling hook references.
      const result = scanSettingsFile(
        path.join(dir, ".claude", "settings.json"),
        dir,
      );
      assert.equal(result.ok, true);
      assert.deepEqual(
        result.zombies.map((z) => z.path),
        [],
        `dangling hook references under 'all': ${result.zombies
          .map((z) => z.path)
          .join(", ")}`,
      );

      // "all" must expand beyond Claude: codex + cursor generated hooks land too
      // (proves the expansion iterates every concrete platform, not just claude).
      assert.ok(
        existsSync(path.join(dir, ".codex", "hooks", "enforce-agent-dispatch.mjs")),
        "'all' must project codex generated hooks",
      );
      assert.ok(
        existsSync(path.join(dir, ".cursor", "hooks", "enforce-agent-dispatch.mjs")),
        "'all' must project cursor generated hooks",
      );
      assert.ok(
        existsSync(path.join(dir, "openclaw", "hooks", "stop-save-progress.mjs")),
        "'all' must project openclaw generated hooks (guards against 4→3 runtime degradation)",
      );
    });
  });
});

// Regression for the doctor "漏检" gap: medusa_batch_scan.py is spawned by
// medusa-worker.mjs, which is spawned by the settings.json-referenced medusa
// hooks. settings.json never names the .py, so a settings-only scan returns 0
// even when the .py is missing. The --project-root gate must follow that spawn
// chain and fail closed on any missing transitive dependency.
describe("doctor gate detects missing transitive medusa dependency", () => {
  test("deleting ONLY medusa_batch_scan.py (keeping the 3 .mjs) is a missing transitive dep, not a dangling ref", () => {
    withTempProject((dir) => {
      deployPlatformFiles("claude", dir);
      const hooksDir = path.join(dir, ".claude", "hooks");
      // The three .mjs stay; remove only the Python helper the worker spawns.
      unlinkSync(path.join(hooksDir, "medusa_batch_scan.py"));
      for (const stillThere of [
        "medusa-findings-surface.mjs",
        "medusa-postscan-enqueue.mjs",
        "medusa-worker.mjs",
      ]) {
        assert.ok(
          existsSync(path.join(hooksDir, stillThere)),
          `precondition: ${stillThere} must remain`,
        );
      }

      const result = scanSettingsFile(
        path.join(dir, ".claude", "settings.json"),
        dir,
      );
      assert.equal(result.ok, true);
      // settings.json itself still has NO dangling reference — the .py is not
      // referenced there. This is exactly why a settings-only scan missed it.
      assert.deepEqual(result.zombies.map((z) => z.path), []);
      // The transitive check must catch the spawned-but-missing helper...
      const dep = result.missingDeps.find((d) =>
        String(d.path).endsWith("medusa_batch_scan.py"),
      );
      assert.ok(dep, "transitive check must flag the missing medusa_batch_scan.py");
      // ...and report the full spawn chain down to it.
      assert.ok(
        dep.chain.includes("medusa-worker.mjs") &&
          dep.chain[0] === "settings.json",
        `chain must trace settings.json -> ... -> medusa-worker.mjs -> py, got: ${dep.chain.join(" -> ")}`,
      );
    });
  });

  test("with all four files present there are zero missing transitive deps", () => {
    withTempProject((dir) => {
      deployPlatformFiles("claude", dir);
      const result = scanSettingsFile(
        path.join(dir, ".claude", "settings.json"),
        dir,
      );
      assert.equal(result.ok, true);
      assert.deepEqual(
        result.missingDeps,
        [],
        `unexpected missing transitive deps: ${result.missingDeps
          .map((d) => d.path)
          .join(", ")}`,
      );
    });
  });

  test("deleting medusa-worker.mjs is flagged as a missing transitive dep (deduped once)", () => {
    withTempProject((dir) => {
      deployPlatformFiles("claude", dir);
      unlinkSync(path.join(dir, ".claude", "hooks", "medusa-worker.mjs"));
      const result = scanSettingsFile(
        path.join(dir, ".claude", "settings.json"),
        dir,
      );
      const workerHits = result.missingDeps.filter((d) =>
        String(d.path).endsWith("medusa-worker.mjs"),
      );
      // findings-surface (x3 events) + postscan-enqueue all spawn the worker;
      // it must be reported once, not once per referencing hook/event.
      assert.equal(
        workerHits.length,
        1,
        `worker should be reported exactly once, got ${workerHits.length}`,
      );
    });
  });

  test("doctor CLI --project-root gate exits non-zero when ONLY the .py is missing, zero when restored", () => {
    withTempProject((dir) => {
      deployPlatformFiles("claude", dir);
      const py = path.join(dir, ".claude", "hooks", "medusa_batch_scan.py");

      // Healthy projection: gate passes.
      const ok = spawnSync(
        process.execPath,
        [DOCTOR_PATH, "--project-root", dir, "--silent"],
        { encoding: "utf8" },
      );
      assert.equal(ok.status, 0, `expected clean gate exit 0, got ${ok.status}`);

      // Remove only the spawned Python helper: gate must fail closed (exit 1)
      // AND print the spawn chain so the operator knows what to restore.
      unlinkSync(py);
      const bad = spawnSync(
        process.execPath,
        [DOCTOR_PATH, "--project-root", dir, "--silent"],
        { encoding: "utf8" },
      );
      assert.equal(
        bad.status,
        1,
        `expected fail-closed exit 1 for missing .py, got ${bad.status}`,
      );
      assert.match(bad.stderr, /medusa_batch_scan\.py/);
      assert.match(bad.stderr, /medusa-worker\.mjs/);
    });
  });
});
