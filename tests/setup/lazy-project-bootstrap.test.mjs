import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function tempProject() {
  return mkdtempSync(path.join(os.tmpdir(), "meta-kim-lazy-bootstrap-"));
}

function runSetup(args, options = {}) {
  return spawnSync(process.execPath, ["setup.mjs", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 120_000,
    ...options,
  });
}

function runBin(args, options = {}) {
  return spawnSync(process.execPath, ["bin/meta-kim.mjs", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 120_000,
    ...options,
  });
}

function runBootstrap(projectDir, extraArgs = []) {
  const result = runSetup([
    "--project-bootstrap",
    "--targets",
    "claude,codex",
    "--project-dir",
    projectDir,
    "--json",
    ...extraArgs,
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

test("lazy project bootstrap dry-run exposes source chain and writes nothing", () => {
  const projectDir = tempProject();
  try {
    const before = new Set([]);
    const summary = runBootstrap(projectDir, ["--dry-run"]);
    assert.equal(summary.mode, "dry-run");
    assert.equal(summary.ok, true);
    assert.equal(summary.resultCount, 1);

    const plan = summary.results[0];
    assert.equal(plan.schemaVersion, "meta-kim-project-bootstrap-plan-v0.1");
    assert.equal(plan.state.status, "missing");
    assert.deepEqual(plan.state.activeTargets, ["claude", "codex"]);
    assert.equal(plan.sourceChain.binEntrypoint, "bin/meta-kim.mjs");
    assert.equal(plan.sourceChain.setupEntrypoint, "setup.mjs --project-bootstrap");
    assert.equal(plan.sourceChain.syncManifest, "config/sync.json");
    assert.equal(plan.sourceChain.canonicalRoots.skills, "canonical/skills");
    assert.ok(plan.sourceChain.generatedTargets.claude.includes(".claude/skills"));
    assert.ok(plan.sourceChain.generatedTargets.codex.includes(".agents/skills"));

    const byRel = new Map(plan.files.map((file) => [file.relPath, file]));
    assert.equal(byRel.get("AGENTS.md")?.mergePolicy, "generated_projection_create");
    assert.equal(
      byRel.get(".agents/skills/meta-theory/SKILL.md")?.mergePolicy,
      "generated_projection_create",
    );
    assert.equal(
      byRel.get(".claude/settings.json")?.mergePolicy,
      "additive_preserve_user_state_json",
    );
    assert.equal(
      byRel.get(".codex/hooks.json")?.mergePolicy,
      "additive_preserve_user_state_json",
    );
    assert.equal(byRel.get(".codex/config.toml")?.mergePolicy, "never_touch");

    assert.deepEqual(new Set([]), before);
    assert.equal(existsSync(path.join(projectDir, ".meta-kim")), false);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("meta-kim CLI exposes project bootstrap subcommand for global-first skill use", () => {
  const projectDir = tempProject();
  try {
    const result = runBin([
      "project",
      "bootstrap",
      "--targets",
      "claude,codex",
      "--project-dir",
      projectDir,
      "--dry-run",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.mode, "dry-run");
    assert.equal(summary.results[0].sourceChain.binEntrypoint, "bin/meta-kim.mjs");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("lazy project bootstrap apply preserves user text/config, skips Codex project config, and records backup manifest", () => {
  const projectDir = tempProject();
  try {
    writeFileSync(path.join(projectDir, "AGENTS.md"), "# User Project\n\nKeep this local note.\n");
    mkdirSync(path.join(projectDir, ".codex"), { recursive: true });
    writeFileSync(
      path.join(projectDir, ".codex", "hooks.json"),
      JSON.stringify(
        {
          hooks: {
            UserPromptSubmit: [{ hooks: [{ command: "node user-hook.mjs" }] }],
          },
        },
        null,
        2,
      ) + "\n",
    );
    writeFileSync(
      path.join(projectDir, ".mcp.json"),
      JSON.stringify({ mcpServers: { custom: { command: "custom-mcp" } } }, null, 2) + "\n",
    );

    const summary = runBootstrap(projectDir, ["--apply"]);
    assert.equal(summary.mode, "apply");
    assert.equal(summary.results[0].applied, true);

    const agents = readFileSync(path.join(projectDir, "AGENTS.md"), "utf8");
    assert.match(agents, /# User Project/);
    assert.match(agents, /Keep this local note/);
    assert.match(agents, /BEGIN META_KIM MANAGED BLOCK: AGENTS\.md/);
    assert.match(agents, /# Meta_Kim for Codex/);

    const codexHooks = readJson(path.join(projectDir, ".codex", "hooks.json"));
    assert.match(JSON.stringify(codexHooks), /node user-hook\.mjs/);
    assert.match(JSON.stringify(codexHooks), /hookprompt-adapter|meta-kim-memory-save|enforce-agent-dispatch|graphify-context/);

    const mcp = readJson(path.join(projectDir, ".mcp.json"));
    assert.equal(mcp.mcpServers.custom.command, "custom-mcp");
    assert.equal(existsSync(path.join(projectDir, ".codex", "config.toml")), false);

    const manifestPath = path.join(
      projectDir,
      ".meta-kim",
      "state",
      "default",
      "project-bootstrap.json",
    );
    const manifest = readJson(manifestPath);
    assert.equal(manifest.schemaVersion, "meta-kim-project-bootstrap-v0.1");
    assert.deepEqual(manifest.activeTargets, ["claude", "codex"]);
    assert.equal(manifest.sourceChain.setupEntrypoint, "setup.mjs --project-bootstrap");
    assert.equal(manifest.protectedMergeDecisions.protectedMerge.includes(".codex/config.toml"), true);
    assert.equal(manifest.backup.created, true);
    assert.ok(manifest.backup.entries.some((entry) => entry.relPath === "AGENTS.md"));
    assert.ok(manifest.backup.entries.some((entry) => entry.relPath === ".codex/hooks.json"));

    const postCopyBootstrap = path.join(projectDir, "meta-kim-post-copy.mjs");
    assert.equal(existsSync(postCopyBootstrap), true);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("lazy project bootstrap replaces existing managed text block without duplicating user content", () => {
  const projectDir = tempProject();
  try {
    writeFileSync(
      path.join(projectDir, "AGENTS.md"),
      [
        "# User Project",
        "",
        "Keep this local note.",
        "",
        "<!-- BEGIN META_KIM MANAGED BLOCK: AGENTS.md -->",
        "# Old Meta Kim Block",
        "<!-- END META_KIM MANAGED BLOCK: AGENTS.md -->",
        "",
        "Keep this tail.",
        "",
      ].join("\n"),
    );

    const summary = runBootstrap(projectDir, ["--apply"]);
    assert.equal(summary.mode, "apply");

    const agents = readFileSync(path.join(projectDir, "AGENTS.md"), "utf8");
    const managedBlockCount = agents.match(/BEGIN META_KIM MANAGED BLOCK: AGENTS\.md/g)?.length ?? 0;
    assert.equal(managedBlockCount, 1);
    assert.match(agents, /Keep this local note/);
    assert.match(agents, /Keep this tail/);
    assert.match(agents, /# Meta_Kim for Codex/);
    assert.doesNotMatch(agents, /# Old Meta Kim Block/);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("lazy project bootstrap does not report success for a read-only project target", () => {
  const projectDir = tempProject();
  const agentsPath = path.join(projectDir, "AGENTS.md");
  try {
    writeFileSync(agentsPath, "# User Project\n\nRead-only local note.\n");
    chmodSync(agentsPath, 0o444);

    const result = runSetup([
      "--project-bootstrap",
      "--targets",
      "claude,codex",
      "--project-dir",
      projectDir,
      "--json",
      "--apply",
    ]);
    assert.notEqual(result.status, 0, "read-only target must not be reported as apply success");
    assert.match(result.stderr || result.stdout, /Setup error|EACCES|EPERM|permission|read-only/i);
  } finally {
    try {
      chmodSync(agentsPath, 0o666);
    } catch {}
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("lazy project bootstrap detects stale previous manifest before update", () => {
  const projectDir = tempProject();
  try {
    const manifestDir = path.join(projectDir, ".meta-kim", "state", "default");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      path.join(manifestDir, "project-bootstrap.json"),
      JSON.stringify(
        {
          schemaVersion: "meta-kim-project-bootstrap-v0.1",
          metaKimVersion: "0.0.0",
          appliedAt: "2026-01-01T00:00:00.000Z",
          activeTargets: ["claude"],
        },
        null,
        2,
      ) + "\n",
    );

    const summary = runBootstrap(projectDir, ["--dry-run"]);
    assert.equal(summary.results[0].state.status, "stale");
    assert.equal(summary.results[0].state.previousManifest.metaKimVersion, "0.0.0");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});
