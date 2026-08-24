import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import {
  readClaudeInteractiveSessionFailureObservation,
} from "../../scripts/live-acceptance/read-claude-session-evidence.mjs";
import {
  loadRuntimeCapabilityFailureObservations,
  runtimeCapabilityFailureRemediation,
  writeRuntimeCapabilityFailureObservation,
} from "../../scripts/runtime-capability-failure-observations.mjs";
import {
  runClaudeInteractiveSessionHandoffProducer,
} from "../../scripts/runtime-capability-producers.mjs";
import {
  loadRuntimeCapabilityAcceptanceAttempts,
} from "../../scripts/runtime-capability-acceptance.mjs";

const temporaryRoots = new Set();
const packageRoot = path.resolve(import.meta.dirname, "..", "..");

after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function jsonl(records) {
  return `${records.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function createFailureFixture({ laterTool = null, projectBoundNotification = true } = {}) {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "meta-kim-claude-failure-project-"));
  const claudeHome = mkdtempSync(path.join(tmpdir(), "meta-kim-claude-failure-home-"));
  temporaryRoots.add(projectRoot);
  temporaryRoots.add(claudeHome);
  const sessionId = "8885fe96-7fdc-48aa-ba32-3045f51c3289";
  const childSessionId = "a97d1a40d44a77f8a";
  const nonce = "318d540d-77f2-4036-8fb0-6e09a8a60520";
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
  writeFileSync(path.join(workspacePath, "meta-kim-probe.txt"), `before-${marker}\n`, "utf8");
  const sessionDirectory = path.join(claudeHome, "projects", "fixture-project");
  mkdirSync(sessionDirectory, { recursive: true });
  const sessionPath = path.join(sessionDirectory, `${sessionId}.jsonl`);
  const baseTime = Date.parse("2026-08-19T12:50:20.000Z");
  let sequence = 0;
  const envelope = (type, extra = {}) => ({
    type,
    timestamp: new Date(baseTime + (++sequence * 1_000)).toISOString(),
    sessionId,
    session_id: sessionId,
    cwd: projectRoot,
    version: "2.1.233-test",
    uuid: `record-${sequence}`,
    ...extra,
  });
  const use = (id, name, input) => envelope("assistant", {
    message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] },
  });
  const result = (id, content, extra = {}) => envelope("user", {
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: extra.isError === true }] },
    toolUseResult: extra.toolUseResult,
  });
  const prompt = `Return exactly ${marker} as your entire final response.`;
  const failureText = "Please run /login · API Error: 403 Request blocked: this endpoint only accepts requests from the official Claude Code CLI";
  const notification = `<task-notification>\n<task-id>${childSessionId}</task-id>\n<tool-use-id>agent-final</tool-use-id>\n<output-file>C:\\Users\\private\\tasks\\${childSessionId}.output</output-file>\n<status>failed</status>\n<summary>Agent failed: ${failureText}. (request id: PRIVATE_REQUEST_ID)</summary>\n</task-notification>`;
  const records = [
    envelope("user", { message: { role: "user", content: "UNRELATED_PRIVATE_TEXT_MUST_NOT_PERSIST" } }),
    use("agent-classifier-one", "Agent", { description: "classification", prompt }),
    result("agent-classifier-one", "classifier unavailable", { isError: true }),
    use("agent-classifier-two", "Agent", { description: "classification", prompt }),
    result("agent-classifier-two", "classifier unavailable", { isError: true }),
    use("agent-final", "Agent", { description: "Return fixed marker", prompt }),
    result("agent-final", "Agent launched successfully.", {
      toolUseResult: { isAsync: true, status: "async_launched", agentId: childSessionId },
    }),
    {
      type: "queue-operation",
      timestamp: new Date(baseTime + (++sequence * 1_000)).toISOString(),
      sessionId,
      content: notification,
    },
    envelope("user", {
      cwd: projectBoundNotification ? projectRoot : path.dirname(projectRoot),
      message: { role: "user", content: notification },
    }),
    envelope("assistant", { message: { role: "assistant", content: "PRIVATE_SUMMARY_MUST_NOT_PERSIST" } }),
  ];
  if (laterTool) {
    records.push(use("later-tool", laterTool, { command: "must-not-run" }));
  }
  writeFileSync(sessionPath, jsonl(records), "utf8");
  return {
    projectRoot,
    claudeHome,
    sessionId,
    childSessionId,
    marker,
    workspacePath,
    sessionPath,
    failureText,
    sinceMs: baseTime - 1_000,
  };
}

function readFailure(fixture, overrides = {}) {
  return readClaudeInteractiveSessionFailureObservation({
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

test("Claude handoff imports the terminal Agent 403 as a sanitized blocked observation", () => {
  const fixture = createFailureFixture();
  const evidence = readFailure(fixture);
  assert.equal(evidence.outcome, "fail");
  assert.equal(evidence.blockedFromRelease, true);
  assert.equal(evidence.failureClass, "gateway_403_official_cli_only");
  assert.equal(evidence.failureText, fixture.failureText);
  assert.equal(evidence.sessionId, fixture.sessionId);
  assert.equal(evidence.childSessionId, fixture.childSessionId);
  assert.equal(evidence.priorMarkerBoundAgentAttempts, 2);
  assert.equal(evidence.laterToolUseCount, 0);
  assert.deepEqual(evidence.sourceSessionLines.map((entry) => entry.lineNumber), [6, 7, 8, 9]);
  const sanitized = JSON.stringify(evidence.sanitizedArtifact);
  assert.doesNotMatch(sanitized, /UNRELATED_PRIVATE_TEXT|PRIVATE_SUMMARY|PRIVATE_REQUEST_ID|output-file|C:\\Users/iu);
  assert.match(sanitized, /gateway_403_official_cli_only/u);
});

test("Claude handoff failure observation rejects later tools and cross-project terminal records", () => {
  assert.throws(() => readFailure(createFailureFixture({ laterTool: "Bash" })), /after the failed Agent|later tool|step 2/u);
  assert.throws(() => readFailure(createFailureFixture({ projectBoundNotification: false })), /project root|cwd|project-bound/u);
});

test("failed Claude handoff persists one negative observation and writes no acceptance", async () => {
  const fixture = createFailureFixture();
  let acceptanceCalls = 0;
  const produced = await runClaudeInteractiveSessionHandoffProducer({
    projectRoot: fixture.projectRoot,
    profile: "default",
    sessionId: fixture.sessionId,
    marker: fixture.marker,
    workspacePath: fixture.workspacePath,
    sinceMs: fixture.sinceMs,
    reader: () => { throw new Error("five-step success lifecycle is incomplete"); },
    failureReader: (options) => readClaudeInteractiveSessionFailureObservation({ ...options, claudeHome: fixture.claudeHome }),
    _acceptanceWriter: () => { acceptanceCalls += 1; throw new Error("acceptance writer must not run"); },
    attemptBase: "claude-negative-observation-test",
  });
  assert.equal(produced.outcome, "fail");
  assert.equal(produced.blockedFromRelease, true);
  assert.equal(produced.failureClass, "gateway_403_official_cli_only");
  assert.deepEqual(produced.results, []);
  assert.equal(acceptanceCalls, 0);
  assert.equal(loadRuntimeCapabilityAcceptanceAttempts({ projectRoot: fixture.projectRoot, profile: "default" }).attempts.length, 0);
  const failureStore = loadRuntimeCapabilityFailureObservations({ projectRoot: fixture.projectRoot, profile: "default" });
  assert.equal(failureStore.observations.length, 1);
  assert.equal(failureStore.observations[0].outcome, "fail");
  assert.equal(failureStore.observations[0].blockedFromRelease, true);
  assert.equal(failureStore.observations[0].capability, "agent");
  const persisted = `${readFileSync(produced.rawPath, "utf8")}\n${readFileSync(produced.observationPath, "utf8")}`;
  assert.doesNotMatch(persisted, /PRIVATE_REQUEST_ID|output-file|C:\\Users/iu);
});

test("status CLI forbids retry after the official-CLI-only failure is recorded", async () => {
  const fixture = createFailureFixture();
  writeRuntimeCapabilityFailureObservation({
    projectRoot: fixture.projectRoot,
    profile: "default",
    producer: { id: "claude-interactive-session-handoff" },
    evidence: readFailure(fixture),
    testOnly: false,
  });
  const status = spawnSync(process.execPath, [
    path.join(packageRoot, "scripts", "run-runtime-capability-producers.mjs"),
    "--status",
    "--require-fresh",
    "--project-root",
    fixture.projectRoot,
    "--runtimes",
    "claude_code",
    "--capabilities",
    "agent",
  ], { cwd: packageRoot, encoding: "utf8" });
  assert.equal(status.status, 1, status.stderr);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.results.length, 0);
  assert.equal(payload.negativeObservations.length, 1);
  assert.match(payload.remediation, /do not retry/iu);
  assert.doesNotMatch(payload.remediation, /Run: meta-kim runtime produce/u);
});

test("failure observation loader rejects source artifact drift", async () => {
  const fixture = createFailureFixture();
  const produced = await runClaudeInteractiveSessionHandoffProducer({
    projectRoot: fixture.projectRoot,
    profile: "default",
    sessionId: fixture.sessionId,
    marker: fixture.marker,
    workspacePath: fixture.workspacePath,
    sinceMs: fixture.sinceMs,
    reader: () => { throw new Error("five-step success lifecycle is incomplete"); },
    failureReader: (options) => readClaudeInteractiveSessionFailureObservation({ ...options, claudeHome: fixture.claudeHome }),
    _acceptanceWriter: () => { throw new Error("acceptance writer must not run"); },
    attemptBase: "claude-negative-observation-drift-test",
  });
  writeFileSync(produced.rawPath, `${readFileSync(produced.rawPath, "utf8")} `, "utf8");
  assert.throws(
    () => loadRuntimeCapabilityFailureObservations({ projectRoot: fixture.projectRoot, profile: "default" }),
    /artifact.*SHA-256|digest|hash/u,
  );
});

test("official-CLI-only failure remediation forbids an unchanged retry", () => {
  const remediation = runtimeCapabilityFailureRemediation([{
    outcome: "fail",
    blockedFromRelease: true,
    failureClass: "gateway_403_official_cli_only",
  }]);
  assert.match(remediation, /do not retry/iu);
  assert.doesNotMatch(remediation, /Run: meta-kim runtime produce/u);
});
