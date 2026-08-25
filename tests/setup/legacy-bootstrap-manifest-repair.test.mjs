import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const cliPath = path.join(repoRoot, "bin", "meta-kim.mjs");

function runRepair(projectDir, extraArgs = [], env = {}) {
  const output = execFileSync(
    process.execPath,
    [
      cliPath,
      "project",
      "bootstrap",
      "repair-legacy-manifest",
      "--project-dir",
      projectDir,
      "--json",
      ...extraArgs,
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return JSON.parse(output);
}

function createLegacyFixture() {
  const projectDir = mkdtempSync(path.join(os.tmpdir(), "meta-kim-legacy-bootstrap-"));
  const managedPath = path.join(projectDir, ".codex", "skills", "meta-theory", "SKILL.md");
  const stateDir = path.join(projectDir, ".meta-kim", "state", "default");
  mkdirSync(path.dirname(managedPath), { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(managedPath, "# legacy projection\n", "utf8");
  writeFileSync(
    path.join(stateDir, "project-bootstrap.json"),
    `${JSON.stringify({
      schemaVersion: "meta-kim-project-bootstrap-v0.1",
      metaKimVersion: "2.8.7",
      activeTargets: ["codex"],
      managedFiles: [{ relPath: ".codex/skills/meta-theory/SKILL.md", kind: "file" }],
    }, null, 2)}\n`,
    "utf8",
  );
  return { projectDir, manifestPath: path.join(stateDir, "project-bootstrap.json"), managedPath };
}

describe("legacy project bootstrap manifest repair", () => {
  test("defaults to a read-only dry-run and requires explicit trust for legacy bytes", () => {
    const { projectDir, manifestPath } = createLegacyFixture();
    try {
      const result = runRepair(projectDir);
      assert.equal(result.schemaVersion, "meta-kim-project-bootstrap-repair-result-v0.1");
      assert.equal(result.mode, "dry-run");
      assert.equal(result.ok, true);
      assert.equal(result.requiresTrust, true);
      assert.equal(result.writeCount, 0);
      assert.equal(readFileSync(manifestPath, "utf8").includes("contentHash"), false);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("apply with explicit trust writes a hashed manifest and a verified backup", () => {
    const { projectDir, manifestPath, managedPath } = createLegacyFixture();
    try {
      const result = runRepair(projectDir, ["--apply", "--trust-current-bytes"]);
      assert.equal(result.mode, "apply");
      assert.equal(result.ok, true);
      assert.equal(result.requiresTrust, false);
      assert.equal(result.writeCount, 1);
      assert.equal(result.backup.verified, true);
      assert.equal(existsSync(result.backup.path), true);
      assert.match(result.backup.sha256, /^[a-f0-9]{64}$/u);
      assert.equal(result.backup.bytes, readFileSync(result.backup.path).length);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      assert.equal(manifest.schemaVersion, "meta-kim-project-bootstrap-v0.1");
      assert.equal(manifest.metaKimVersion, "2.8.7");
      assert.match(manifest.managedFiles[0].contentHash, /^[a-f0-9]{64}$/u);
      assert.equal(manifest.managedFiles[0].size, readFileSync(managedPath).length);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("transaction failure restores the original manifest and leaves recovery evidence", () => {
    const { projectDir, manifestPath } = createLegacyFixture();
    const before = readFileSync(manifestPath, "utf8");
    try {
      assert.throws(
        () => runRepair(projectDir, ["--apply", "--trust-current-bytes"], {
          META_KIM_TEST_INJECT_LEGACY_REPAIR_FAILURE: "after-backup",
        }),
        /injected legacy manifest repair failure/u,
      );
      assert.equal(readFileSync(manifestPath, "utf8"), before);
      const backupRoot = path.join(projectDir, ".meta-kim", "backups", "project-bootstrap-legacy-repair");
      assert.equal(readdirSync(backupRoot).length > 0, true);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
