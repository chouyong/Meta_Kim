import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runMetaTheoryGovernedExecution } from "../../scripts/run-meta-theory-governed-execution.mjs";

async function runFor(runtime) {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), `meta-kim-agent-teams-${runtime}-`));
  try {
    const report = await runMetaTheoryGovernedExecution({
      task: "meta-theory 检查 Codex runtime 和 Claude Code runtime 的并行编排契约",
      runId: `agent-teams-provider-${runtime}`,
      stateDir,
      dbPath: path.join(stateDir, "runs.sqlite"),
      runtime,
      osTarget: "windows",
    });
    return report.coreLoop.agentTeamsPlaybookPacket.providerResolution;
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
}

test("Codex prefers a local upstream checkout and supports the packaged global layout", async () => {
  const resolution = await runFor("codex");
  assert.equal(resolution.runtime, "codex");
  assert.equal(resolution.candidates[0].source, "project_codex_skill");
  const siblingCandidate = resolution.candidates.find(
    (candidate) => candidate.source === "sibling_dependency_checkout",
  );
  const packagedGlobalCandidate = resolution.candidates.find(
    (candidate) => candidate.source === "codex_global_skill_package",
  );
  assert.ok(
    resolution.candidates.findIndex((candidate) => candidate.source === "sibling_dependency_checkout") <
      resolution.candidates.findIndex((candidate) => candidate.source === "codex_global_skill"),
  );
  assert.equal(packagedGlobalCandidate?.found, true);
  assert.equal(
    resolution.selectedSource,
    siblingCandidate?.found ? "sibling_dependency_checkout" : "codex_global_skill_package",
  );
  assert.ok(resolution.selectedVersion);
});

test("Claude Code resolves Claude-native skill roots and the packaged global layout", async () => {
  const resolution = await runFor("claude_code");
  assert.equal(resolution.runtime, "claude_code");
  assert.equal(resolution.candidates[0].source, "project_claude_skill");
  assert.ok(resolution.candidates.some((candidate) => candidate.source === "claude_global_skill"));
  assert.ok(
    resolution.candidates.some((candidate) => candidate.source === "claude_global_skill_package"),
  );
  assert.equal(
    resolution.candidates.some((candidate) => candidate.source.startsWith("codex_global_skill")),
    false,
  );
  const siblingCandidate = resolution.candidates.find(
    (candidate) => candidate.source === "sibling_dependency_checkout",
  );
  const packagedGlobalCandidate = resolution.candidates.find(
    (candidate) => candidate.source === "claude_global_skill_package",
  );
  assert.equal(packagedGlobalCandidate?.found, true);
  assert.equal(
    resolution.selectedSource,
    siblingCandidate?.found ? "sibling_dependency_checkout" : "claude_global_skill_package",
  );
  assert.ok(resolution.selectedVersion);
});
