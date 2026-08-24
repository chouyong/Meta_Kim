import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import {
  readClaudeInteractiveSessionEvidence,
} from "../../scripts/live-acceptance/read-claude-session-evidence.mjs";
import {
  runClaudeInteractiveSessionHandoffProducer,
} from "../../scripts/runtime-capability-producers.mjs";
import {
  loadRuntimeCapabilityAcceptanceAttempts,
  validateRuntimeCapabilityAcceptanceAttemptEvidence,
  writeTestOnlyControlledRuntimeCapabilityAcceptanceAttempt,
} from "../../scripts/runtime-capability-acceptance.mjs";

const packageRoot = path.resolve(import.meta.dirname, "../..");
const temporaryRoots = new Set();

after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function jsonl(records) {
  return `${records.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function createFixture({ extraTool = null, mismatchedCwdIndex = null, duplicateAgent = false } = {}) {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "meta-kim-claude-handoff-project-"));
  const claudeHome = mkdtempSync(path.join(tmpdir(), "meta-kim-claude-handoff-home-"));
  temporaryRoots.add(projectRoot);
  temporaryRoots.add(claudeHome);
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const childSessionId = "22222222-2222-4222-8222-222222222222";
  const nonce = "33333333-3333-4333-8333-333333333333";
  const marker = `META_KIM_CAPABILITY_CLAUDE_HANDOFF_${nonce}`;
  const workspacePath = path.join(
    projectRoot,
    ".meta-kim",
    "state",
    "default",
    "runtime-capability-producers",
    "workspaces",
    `claude-handoff-${nonce}`,
  );
  mkdirSync(workspacePath, { recursive: true });
  const probeFile = path.join(workspacePath, "meta-kim-probe.txt");
  writeFileSync(probeFile, `after-${marker}\n`, "utf8");
  const sessionDirectory = path.join(claudeHome, "projects", "fixture-project");
  mkdirSync(sessionDirectory, { recursive: true });
  const sessionPath = path.join(sessionDirectory, `${sessionId}.jsonl`);
  const now = new Date().toISOString();
  let sequence = 0;
  const record = (type, message, extra = {}) => ({
    type,
    timestamp: now,
    sessionId,
    session_id: sessionId,
    cwd: projectRoot,
    version: "2.1.233-test",
    uuid: `record-${++sequence}`,
    parentUuid: sequence === 1 ? null : `record-${sequence - 1}`,
    message,
    ...extra,
  });
  const use = (id, name, input) => record("assistant", {
    role: "assistant",
    content: [{ type: "tool_use", id, name, input }],
  });
  const result = (id, content, extra = {}) => record("user", {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: id, content, is_error: false }],
  }, extra);
  const bashCommand = `printf '%s\\n' 'shell-${marker}'`;
  const records = [
    record("user", { role: "user", content: "UNRELATED_PRIVATE_TEXT_MUST_NOT_PERSIST" }),
    use("agent-call", "Agent", { description: "controlled probe", prompt: `Return exactly ${marker} as your entire final response.`, subagent_type: "general-purpose" }),
    result("agent-call", marker, { toolUseResult: { agentId: childSessionId } }),
    use("bash-call", "Bash", { command: bashCommand, description: "controlled shell probe" }),
    result("bash-call", `shell-${marker}`),
    use("read-before", "Read", { file_path: probeFile }),
    result("read-before", `     1→before-${marker}`),
    use("edit-call", "Edit", { file_path: probeFile, old_string: `before-${marker}`, new_string: `after-${marker}` }),
    result("edit-call", "The file has been updated successfully."),
    use("read-after", "Read", { file_path: probeFile }),
    result("read-after", `     1→after-${marker}`),
  ];
  if (extraTool) {
    records.splice(7, 0, use("extra-call", extraTool, { file_path: probeFile }), result("extra-call", "extra"));
  }
  if (duplicateAgent) {
    records.splice(3, 0,
      use("agent-call-duplicate", "Agent", { description: "duplicate", prompt: `Return exactly ${marker} as your entire final response.`, subagent_type: "general-purpose" }),
      result("agent-call-duplicate", marker, { toolUseResult: { agentId: "44444444-4444-4444-8444-444444444444" } }),
    );
  }
  if (Number.isInteger(mismatchedCwdIndex)) records[mismatchedCwdIndex].cwd = path.dirname(projectRoot);
  writeFileSync(sessionPath, jsonl(records), "utf8");
  return {
    projectRoot,
    claudeHome,
    sessionId,
    childSessionId,
    marker,
    workspacePath,
    sessionPath,
    sinceMs: Date.parse(now) - 1_000,
  };
}

function readFixture(fixture, overrides = {}) {
  return readClaudeInteractiveSessionEvidence({
    claudeHome: fixture.claudeHome,
    projectRoot: fixture.projectRoot,
    profile: "default",
    sessionId: fixture.sessionId,
    marker: fixture.marker,
    workspacePath: fixture.workspacePath,
    sinceMs: fixture.sinceMs,
    ...overrides,
  });
}

test("interactive Claude session evidence binds one exact five-facet lifecycle without persisting message content", () => {
  const fixture = createFixture();
  const evidence = readFixture(fixture);
  assert.equal(evidence.sourceCategory, "claude_interactive_session_file_handoff");
  assert.deepEqual(Object.keys(evidence.events), ["agent", "subagent", "shell", "filesystemBefore", "edit", "filesystemAfter"]);
  assert.equal(evidence.sessionId, fixture.sessionId);
  assert.equal(evidence.childSessionId, fixture.childSessionId);
  assert.equal(evidence.cliVersion, "2.1.233-test");
  const sanitized = JSON.stringify(evidence.sanitizedArtifact);
  assert.doesNotMatch(sanitized, /UNRELATED_PRIVATE_TEXT_MUST_NOT_PERSIST/u);
  assert.doesNotMatch(sanitized, /old_string|new_string|file_path|subagent_type/u);
  assert.match(sanitized, /META_KIM_CAPABILITY_CLAUDE_HANDOFF_/u);
});

test("interactive Claude handoff rejects cross-project, ambiguous, and extra-tool lifecycles", async (context) => {
  await context.test("cross-project record", () => {
    const fixture = createFixture({ mismatchedCwdIndex: 6 });
    assert.throws(() => readFixture(fixture), /project root|cwd/u);
  });
  await context.test("duplicate marker-bound Agent lifecycle", () => {
    const fixture = createFixture({ duplicateAgent: true });
    assert.throws(() => readFixture(fixture), /exact|ambiguous|sequence/u);
  });
  await context.test("unapproved Write tool", () => {
    const fixture = createFixture({ extraTool: "Write" });
    assert.throws(() => readFixture(fixture), /tool sequence|unapproved|Write/u);
  });
  await context.test("duplicate session id across Claude project directories", () => {
    const fixture = createFixture();
    const duplicateDirectory = path.join(fixture.claudeHome, "projects", "other-project");
    mkdirSync(duplicateDirectory, { recursive: true });
    const duplicateRecords = readFileSync(fixture.sessionPath, "utf8").trimEnd().split(/\r?\n/u).map((line) => ({
      ...JSON.parse(line),
      cwd: path.dirname(fixture.projectRoot),
    }));
    writeFileSync(path.join(duplicateDirectory, `${fixture.sessionId}.jsonl`), jsonl(duplicateRecords), "utf8");
    assert.throws(() => readFixture(fixture), /ambiguous|multiple|duplicate/u);
  });
});

test("interactive Claude handoff accepts only the controlled workspace and an exact final file", () => {
  const fixture = createFixture();
  const outside = mkdtempSync(path.join(tmpdir(), "meta-kim-claude-handoff-outside-"));
  temporaryRoots.add(outside);
  writeFileSync(path.join(outside, "meta-kim-probe.txt"), `after-${fixture.marker}\n`, "utf8");
  assert.throws(() => readFixture(fixture, { workspacePath: outside }), /workspace.*controlled producer|workspace.*root/u);
  writeFileSync(path.join(fixture.workspacePath, "meta-kim-probe.txt"), `before-${fixture.marker}\n`, "utf8");
  assert.throws(() => readFixture(fixture), /final workspace outcome/u);
});

test("one interactive Claude session snapshot emits five distinct controlled receipts", async () => {
  const fixture = createFixture();
  const reader = (options) => readClaudeInteractiveSessionEvidence({ ...options, claudeHome: fixture.claudeHome });
  const produced = await runClaudeInteractiveSessionHandoffProducer({
    projectRoot: fixture.projectRoot,
    profile: "default",
    sessionId: fixture.sessionId,
    marker: fixture.marker,
    workspacePath: fixture.workspacePath,
    sinceMs: fixture.sinceMs,
    reader,
    _acceptanceWriter: writeTestOnlyControlledRuntimeCapabilityAcceptanceAttempt,
  });
  assert.deepEqual(produced.results.map((entry) => entry.capability), ["agent", "subagent", "shell", "filesystem", "apply_patch / edit"]);
  assert.equal(new Set(produced.results.map((entry) => entry.receipt.compositeLifecycle.lifecycleId)).size, 1);
  assert.equal(new Set(produced.results.map((entry) => entry.receipt.rawArtifact.sha256)).size, 1);
  assert.ok(produced.results.every((entry) => entry.receipt.runtime === "claude_code"));
  assert.ok(produced.results.every((entry) => entry.receipt.testOnly === true));
  const raw = readFileSync(produced.rawPath, "utf8");
  assert.doesNotMatch(raw, /UNRELATED_PRIVATE_TEXT_MUST_NOT_PERSIST/u);
  assert.doesNotMatch(raw, /old_string|new_string|file_path|subagent_type/u);
});

test("acceptance revalidates the immutable Claude session prefix and fails after source drift", async () => {
  const fixture = createFixture();
  const reader = (options) => readClaudeInteractiveSessionEvidence({ ...options, claudeHome: fixture.claudeHome });
  await runClaudeInteractiveSessionHandoffProducer({
    projectRoot: fixture.projectRoot,
    profile: "default",
    sessionId: fixture.sessionId,
    marker: fixture.marker,
    workspacePath: fixture.workspacePath,
    sinceMs: fixture.sinceMs,
    reader,
    _acceptanceWriter: writeTestOnlyControlledRuntimeCapabilityAcceptanceAttempt,
  });
  const store = loadRuntimeCapabilityAcceptanceAttempts({ projectRoot: fixture.projectRoot, profile: "default" });
  assert.equal(store.attempts.length, 5);
  for (const attempt of store.attempts) {
    const validation = validateRuntimeCapabilityAcceptanceAttemptEvidence(attempt, {
      profileRoot: store.paths.profileRoot,
      now: new Date(Date.now() + 1_000).toISOString(),
      claudeHome: fixture.claudeHome,
    });
    assert.equal(validation.valid, true, validation.issues.join("\n"));
  }
  writeFileSync(fixture.sessionPath, `${readFileSync(fixture.sessionPath, "utf8")}${JSON.stringify({ type: "system", timestamp: new Date().toISOString(), sessionId: fixture.sessionId })}\n`, "utf8");
  const appendOnly = validateRuntimeCapabilityAcceptanceAttemptEvidence(store.attempts[0], {
    profileRoot: store.paths.profileRoot,
    now: new Date(Date.now() + 1_000).toISOString(),
    claudeHome: fixture.claudeHome,
  });
  assert.equal(appendOnly.valid, true, appendOnly.issues.join("\n"));
  const original = readFileSync(fixture.sessionPath, "utf8");
  writeFileSync(fixture.sessionPath, original.replace("controlled probe", "controlled drift"), "utf8");
  const drifted = validateRuntimeCapabilityAcceptanceAttemptEvidence(store.attempts[0], {
    profileRoot: store.paths.profileRoot,
    now: new Date(Date.now() + 1_000).toISOString(),
    claudeHome: fixture.claudeHome,
  });
  assert.equal(drifted.valid, false);
  assert.match(drifted.issues.join("\n"), /snapshot|source|session/u);
});

test("runtime producer CLI exposes file handoff but rejects incomplete bindings before production", () => {
  const help = spawnSync(process.execPath, ["scripts/run-runtime-capability-producers.mjs", "--help"], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /claude_interactive_session_handoff/u);
  assert.match(help.stdout, /--claude-session-id/u);
  assert.match(help.stdout, /--claude-runtime-workspace/u);
  const incomplete = spawnSync(process.execPath, [
    "scripts/run-runtime-capability-producers.mjs",
    "--source", "claude_interactive_session_handoff",
    "--runtimes", "claude_code",
  ], { cwd: packageRoot, encoding: "utf8" });
  assert.equal(incomplete.status, 1);
  assert.match(incomplete.stderr, /requires session, marker, workspace, and since/u);
  assert.doesNotMatch(`${incomplete.stdout}\n${incomplete.stderr}`, /401|403|authenticate/iu);
});
