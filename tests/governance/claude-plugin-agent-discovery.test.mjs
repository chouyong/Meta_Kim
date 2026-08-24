import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import {
  parseClaudeAgentDefinition,
} from "../../scripts/claude-plugin-agent-discovery.mjs";

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writePlugin(root, name, agentName, description = "Fixture execution owner from a Claude plugin.") {
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  mkdirSync(join(root, "agents"), { recursive: true });
  writeJson(join(root, ".claude-plugin", "plugin.json"), {
    name,
    version: "1.0.0",
    description: `${name} fixture`,
  });
  writeFileSync(
    join(root, "agents", `${agentName}.md`),
    `---\nname: ${agentName}\ndescription: ${description}\n---\n\n# ${agentName}\n`,
    "utf8",
  );
}

function fixtureEnv(home, claudeHome, profile) {
  return {
    ...process.env,
    USERPROFILE: home,
    HOME: home,
    CLAUDE_CONFIG_DIR: claudeHome,
    META_KIM_PROFILE: profile,
    META_KIM_RUNTIME_FAMILY: "claude_code",
  };
}

function discoverClaudeAgents(env) {
  const discovery = spawnSync(
    process.execPath,
    [
      "scripts/discover-global-capabilities.mjs",
      "--runtime-inventory-only",
      "--targets",
      "claude",
      "--json",
      "--lang",
      "en",
    ],
    { cwd: process.cwd(), env, encoding: "utf8" },
  );
  assert.equal(discovery.status, 0, discovery.stderr);
  return {
    output: discovery.stdout,
    agents: Object.values(
      JSON.parse(discovery.stdout).byCapabilityType.agents ?? {},
    ),
  };
}

function selectClaudeRoute(env) {
  const route = spawnSync(
    process.execPath,
    [
      "scripts/select-execution-route.mjs",
      "--task",
      "review and fix the Claude execution owner discovery route",
      "--runtime",
      "claude_code",
      "--os",
      "windows",
      "--json",
    ],
    { cwd: process.cwd(), env, encoding: "utf8" },
  );
  assert.equal(route.status, 0, route.stderr);
  return JSON.parse(route.stdout);
}

test("Claude agent definitions require a declared frontmatter name", () => {
  const parsed = parseClaudeAgentDefinition(
    "---\ndescription: Missing the declared name.\n---\n",
    "diagnostic-fallback",
  );
  assert.equal(parsed.metadata.name, null);
  assert.equal(parsed.metadata.displayName, "diagnostic-fallback");
  assert.ok(parsed.errors.includes("missing_name"));
});

test("enabled Claude plugin agents are discovered but blocked pending trust review", () => {
  const home = mkdtempSync(join(tmpdir(), "meta-kim-claude-plugin-agent-"));
  const claudeHome = join(home, "custom-claude-home");
  const enabledRoot = join(claudeHome, "plugins", "cache", "fixture", "enabled", "1.0.0");
  const disabledRoot = join(claudeHome, "plugins", "cache", "fixture", "disabled", "1.0.0");
  const profile = `claude-plugin-agent-${process.pid}-${Date.now()}`;
  const repoProfileDir = resolve(".meta-kim", "state", profile);
  mkdirSync(join(claudeHome, "plugins"), { recursive: true });
  writePlugin(enabledRoot, "enabled", "code-reviewer");
  writePlugin(disabledRoot, "disabled", "disabled-reviewer");
  writeJson(join(claudeHome, "plugins", "installed_plugins.json"), {
    version: 2,
    plugins: {
      "enabled@fixture": [{
        scope: "user",
        installPath: enabledRoot,
        version: "1.0.0",
      }],
      "disabled@fixture": [{
        scope: "user",
        installPath: disabledRoot,
        version: "1.0.0",
      }],
    },
  });
  writeJson(join(claudeHome, "settings.json"), {
    enabledPlugins: {
      "enabled@fixture": true,
      "disabled@fixture": false,
    },
  });

  const env = {
    ...process.env,
    USERPROFILE: home,
    HOME: home,
    CLAUDE_CONFIG_DIR: claudeHome,
    META_KIM_PROFILE: profile,
    META_KIM_RUNTIME_FAMILY: "claude_code",
  };

  try {
    const discovery = spawnSync(
      process.execPath,
      [
        "scripts/discover-global-capabilities.mjs",
        "--runtime-inventory-only",
        "--targets",
        "claude",
        "--json",
        "--lang",
        "en",
      ],
      { cwd: process.cwd(), env, encoding: "utf8" },
    );
    assert.equal(discovery.status, 0, discovery.stderr);
    const inventory = JSON.parse(discovery.stdout);
    const agents = Object.values(inventory.byCapabilityType.agents ?? {});
    const enabled = agents.find((agent) => agent.id === "code-reviewer");
    assert.ok(enabled, discovery.stdout);
    assert.equal(enabled.layer, "execution");
    assert.equal(enabled.executionBlock, true);
    assert.equal(enabled.routeEligible, false);
    assert.equal(enabled.sourceClass, "plugin");
    assert.equal(enabled.ownershipClass, "third_party_plugin");
    assert.equal(enabled.metadata?.source, "claude-plugin:enabled@fixture");
    assert.equal(enabled.metadata?.validCustomAgentDefinition, true);
    assert.equal(enabled.trustRequired, true);
    assert.equal(enabled.trustReview, "third_party_plugin");
    assert.equal(enabled.trustReviewStatus, "trust_review_required");
    assert.equal(
      enabled.trustReviewReason,
      "third_party_plugins_require_trust_review_before_execution",
    );
    assert.equal(enabled.trustAdmissionRecord, null);
    assert.equal(agents.some((agent) => agent.id === "disabled-reviewer"), false);

    const route = spawnSync(
      process.execPath,
      [
        "scripts/select-execution-route.mjs",
        "--task",
        "review and fix the Claude execution owner discovery route",
        "--runtime",
        "claude_code",
        "--os",
        "windows",
        "--json",
      ],
      { cwd: process.cwd(), env, encoding: "utf8" },
    );
    assert.equal(route.status, 0, route.stderr);
    const routed = JSON.parse(route.stdout);
    assert.equal(
      routed.ownerDiscoveryPacket?.candidateExistingExecutionOwners?.includes("code-reviewer"),
      false,
    );
    const routedPlugin = routed.ownerDiscoveryPacket?.localGlobalAgents?.find(
      (agent) => agent.id === "code-reviewer",
    );
    assert.ok(routedPlugin, JSON.stringify(routed));
    assert.equal(routedPlugin.executionBlock, true);
    assert.equal(routedPlugin.routeEligible, false);
    assert.equal(routedPlugin.trustReviewStatus, "trust_review_required");
    assert.equal(
      routedPlugin.trustReviewReason,
      "third_party_plugins_require_trust_review_before_execution",
    );
    assert.ok(routed.capabilityGapPacket, JSON.stringify(routed));
  } finally {
    rmSync(repoProfileDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

for (const [label, settings] of [
  ["missing settings", undefined],
  ["missing enabledPlugins", {}],
  ["explicit false", { enabledPlugins: { "enabled@fixture": false } }],
  ["invalid enabledPlugins shape", { enabledPlugins: [] }],
]) {
  test(`Claude plugin discovery fails closed for ${label}`, () => {
    const home = mkdtempSync(join(tmpdir(), "meta-kim-claude-plugin-settings-gate-"));
    const claudeHome = join(home, "custom-claude-home");
    const pluginRoot = join(claudeHome, "plugins", "cache", "fixture", "enabled", "1.0.0");
    const profile = `claude-plugin-settings-gate-${process.pid}-${Date.now()}`;
    const repoProfileDir = resolve(".meta-kim", "state", profile);
    mkdirSync(join(claudeHome, "plugins"), { recursive: true });
    writePlugin(pluginRoot, "enabled", "code-reviewer");
    writeJson(join(claudeHome, "plugins", "installed_plugins.json"), {
      version: 2,
      plugins: {
        "enabled@fixture": [{
          scope: "user",
          installPath: pluginRoot,
          version: "1.0.0",
        }],
      },
    });
    if (settings !== undefined) {
      writeJson(join(claudeHome, "settings.json"), settings);
    }

    try {
      const discovery = discoverClaudeAgents(fixtureEnv(home, claudeHome, profile));
      assert.equal(
        discovery.agents.some((agent) => agent.id === "code-reviewer"),
        false,
        discovery.output,
      );
    } finally {
      rmSync(repoProfileDir, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });
}

test("malformed Claude settings fail closed for plugin agent discovery", () => {
  const home = mkdtempSync(join(tmpdir(), "meta-kim-claude-plugin-malformed-settings-"));
  const claudeHome = join(home, "custom-claude-home");
  const pluginRoot = join(claudeHome, "plugins", "cache", "fixture", "enabled", "1.0.0");
  const profile = `claude-plugin-malformed-settings-${process.pid}-${Date.now()}`;
  const repoProfileDir = resolve(".meta-kim", "state", profile);
  mkdirSync(join(claudeHome, "plugins"), { recursive: true });
  writePlugin(pluginRoot, "enabled", "code-reviewer");
  writeJson(join(claudeHome, "plugins", "installed_plugins.json"), {
    version: 2,
    plugins: {
      "enabled@fixture": [{
        scope: "user",
        installPath: pluginRoot,
        version: "1.0.0",
      }],
    },
  });
  writeFileSync(join(claudeHome, "settings.json"), "{ invalid json\n", "utf8");

  try {
    const discovery = discoverClaudeAgents(fixtureEnv(home, claudeHome, profile));
    assert.equal(
      discovery.agents.some((agent) => agent.id === "code-reviewer"),
      false,
      discovery.output,
    );
  } finally {
    rmSync(repoProfileDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("Claude user agent frontmatter identity overrides the same plugin agent", () => {
  const home = mkdtempSync(join(tmpdir(), "meta-kim-claude-user-agent-precedence-"));
  const claudeHome = join(home, "custom-claude-home");
  const pluginRoot = join(claudeHome, "plugins", "cache", "fixture", "enabled", "1.0.0");
  const profile = `claude-user-agent-precedence-${process.pid}-${Date.now()}`;
  const repoProfileDir = resolve(".meta-kim", "state", profile);
  mkdirSync(join(claudeHome, "agents"), { recursive: true });
  mkdirSync(join(claudeHome, "plugins"), { recursive: true });
  writeFileSync(
    join(claudeHome, "agents", "custom.md"),
    "---\nname: code-reviewer\ndescription: User-owned reviewer.\n---\n\n# User reviewer\n",
    "utf8",
  );
  writePlugin(pluginRoot, "enabled", "code-reviewer");
  writeJson(join(claudeHome, "plugins", "installed_plugins.json"), {
    version: 2,
    plugins: {
      "enabled@fixture": [{
        scope: "user",
        installPath: pluginRoot,
        version: "1.0.0",
      }],
    },
  });
  writeJson(join(claudeHome, "settings.json"), {
    enabledPlugins: { "enabled@fixture": true },
  });
  const env = fixtureEnv(home, claudeHome, profile);

  try {
    const discovery = discoverClaudeAgents(env);
    const reviewer = discovery.agents.find((agent) => agent.id === "code-reviewer");
    assert.ok(reviewer, discovery.output);
    assert.equal(reviewer.sourceClass, "personal");
    assert.equal(reviewer.inventoryId, "custom");
    assert.equal(reviewer.collision?.detected, true);
    assert.equal(reviewer.collision?.ambiguous, false);

    const routed = selectClaudeRoute(env);
    assert.equal(routed.recommendedRoute?.owner, "code-reviewer");
    assert.equal(
      routed.recommendedRoute?.selectedCapabilityProviders?.agent?.sourceClass,
      "personal",
    );
    assert.equal(routed.capabilityGapPacket, null);
  } finally {
    rmSync(repoProfileDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("a valid Claude user agent wins over an invalid same-identity definition", () => {
  const home = mkdtempSync(join(tmpdir(), "meta-kim-claude-validity-precedence-"));
  const claudeHome = join(home, "custom-claude-home");
  const profile = `claude-validity-precedence-${process.pid}-${Date.now()}`;
  const repoProfileDir = resolve(".meta-kim", "state", profile);
  mkdirSync(join(claudeHome, "agents"), { recursive: true });
  writeFileSync(
    join(claudeHome, "agents", "code-reviewer.md"),
    "---\ndescription: Invalid because name is missing.\n---\n\n# Invalid reviewer\n",
    "utf8",
  );
  writeFileSync(
    join(claudeHome, "agents", "valid-reviewer.md"),
    "---\nname: code-reviewer\ndescription: Valid user-owned reviewer.\n---\n\n# Valid reviewer\n",
    "utf8",
  );
  const env = fixtureEnv(home, claudeHome, profile);

  try {
    const discovery = discoverClaudeAgents(env);
    const reviewer = discovery.agents.find((agent) => agent.id === "code-reviewer");
    assert.ok(reviewer, discovery.output);
    assert.equal(reviewer.inventoryId, "valid-reviewer");
    assert.equal(reviewer.validCustomAgentDefinition, true);
    assert.equal(reviewer.collision?.ambiguous, false);

    const routed = selectClaudeRoute(env);
    assert.equal(routed.recommendedRoute?.owner, "code-reviewer");
    assert.equal(
      routed.recommendedRoute?.selectedCapabilityProviders?.agent?.sourceRef,
      reviewer.sourceRef,
    );
    assert.equal(routed.capabilityGapPacket, null);
  } finally {
    rmSync(repoProfileDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("conflicting same-priority Claude plugin agents are blocked and produce a capability gap", () => {
  const home = mkdtempSync(join(tmpdir(), "meta-kim-claude-plugin-conflict-"));
  const claudeHome = join(home, "custom-claude-home");
  const firstRoot = join(claudeHome, "plugins", "cache", "fixture", "first", "1.0.0");
  const secondRoot = join(claudeHome, "plugins", "cache", "fixture", "second", "1.0.0");
  const profile = `claude-plugin-conflict-${process.pid}-${Date.now()}`;
  const repoProfileDir = resolve(".meta-kim", "state", profile);
  mkdirSync(join(claudeHome, "plugins"), { recursive: true });
  writePlugin(firstRoot, "first", "code-reviewer", "First conflicting reviewer.");
  writePlugin(secondRoot, "second", "code-reviewer", "Second conflicting reviewer.");
  writeJson(join(claudeHome, "plugins", "installed_plugins.json"), {
    version: 2,
    plugins: {
      "first@fixture": [{ scope: "user", installPath: firstRoot, version: "1.0.0" }],
      "second@fixture": [{ scope: "user", installPath: secondRoot, version: "1.0.0" }],
    },
  });
  writeJson(join(claudeHome, "settings.json"), {
    enabledPlugins: {
      "first@fixture": true,
      "second@fixture": true,
    },
  });
  const env = fixtureEnv(home, claudeHome, profile);

  try {
    const discovery = discoverClaudeAgents(env);
    const reviewer = discovery.agents.find((agent) => agent.id === "code-reviewer");
    assert.ok(reviewer, discovery.output);
    assert.equal(reviewer.collision?.kind, "conflicting_definitions");
    assert.equal(reviewer.collision?.ambiguous, true);
    assert.equal(reviewer.routeEligible, false);

    const routed = selectClaudeRoute(env);
    assert.equal(
      routed.ownerDiscoveryPacket?.candidateExistingExecutionOwners?.includes("code-reviewer"),
      false,
    );
    assert.ok(routed.capabilityGapPacket, JSON.stringify(routed));
  } finally {
    rmSync(repoProfileDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("Claude plugin discovery rejects non-user scope, manifest mismatch, and linked roots", () => {
  const home = mkdtempSync(join(tmpdir(), "meta-kim-claude-plugin-boundaries-"));
  const claudeHome = join(home, "custom-claude-home");
  const projectRoot = join(claudeHome, "plugins", "cache", "fixture", "project", "1.0.0");
  const mismatchRoot = join(claudeHome, "plugins", "cache", "fixture", "mismatch", "1.0.0");
  const linkedTarget = join(claudeHome, "plugins", "cache", "fixture", "linked-target", "1.0.0");
  const linkedRoot = join(claudeHome, "plugins", "cache", "fixture", "linked", "1.0.0");
  const externalRoot = join(home, "external-plugins", "fixture", "external", "1.0.0");
  const profile = `claude-plugin-boundaries-${process.pid}-${Date.now()}`;
  const repoProfileDir = resolve(".meta-kim", "state", profile);
  mkdirSync(join(claudeHome, "plugins"), { recursive: true });
  writePlugin(projectRoot, "project", "project-reviewer");
  writePlugin(mismatchRoot, "wrong-name", "mismatch-reviewer");
  writePlugin(linkedTarget, "linked", "linked-reviewer");
  writePlugin(externalRoot, "external", "external-reviewer");
  mkdirSync(join(linkedRoot, ".."), { recursive: true });
  symlinkSync(linkedTarget, linkedRoot, process.platform === "win32" ? "junction" : "dir");
  writeJson(join(claudeHome, "plugins", "installed_plugins.json"), {
    version: 2,
    plugins: {
      "project@fixture": [{ scope: "project", installPath: projectRoot, version: "1.0.0" }],
      "expected@fixture": [{ scope: "user", installPath: mismatchRoot, version: "1.0.0" }],
      "linked@fixture": [{ scope: "user", installPath: linkedRoot, version: "1.0.0" }],
      "external@fixture": [{ scope: "user", installPath: externalRoot, version: "1.0.0" }],
    },
  });
  writeJson(join(claudeHome, "settings.json"), {
    enabledPlugins: {
      "project@fixture": true,
      "expected@fixture": true,
      "linked@fixture": true,
      "external@fixture": true,
    },
  });

  try {
    const discovery = discoverClaudeAgents(fixtureEnv(home, claudeHome, profile));
    assert.equal(discovery.agents.some((agent) => agent.id === "project-reviewer"), false);
    assert.equal(discovery.agents.some((agent) => agent.id === "mismatch-reviewer"), false);
    assert.equal(discovery.agents.some((agent) => agent.id === "linked-reviewer"), false);
    assert.equal(discovery.agents.some((agent) => agent.id === "external-reviewer"), false);
  } finally {
    rmSync(repoProfileDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
