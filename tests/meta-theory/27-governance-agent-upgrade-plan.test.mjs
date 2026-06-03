import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

describe("27 — Governance agent upgrade plan", async () => {
  const plan = await readFile(
    "docs/governance-agent-upgrade-plan.zh-CN.md",
    "utf8"
  );

  test("documents the reference standard and forbidden architecture copying", () => {
    for (const source of [
      "wshobson/agents",
      "Anthropic",
      "skill-creator",
      "gstack",
      "gbrain",
    ]) {
      assert.match(plan, new RegExp(source, "i"));
    }
    assert.match(plan, /不能复制/);
    assert.match(plan, /不能照搬/);
    assert.match(plan, /不能把.*架构搬进 Meta_Kim/);
  });

  test("defines the four governance agent design stations", () => {
    for (const station of [
      "Boundary Station",
      "Loadout Station",
      "Review Station",
      "Gate Station",
    ]) {
      assert.match(plan, new RegExp(station));
    }
    for (const owner of [
      "meta-genesis",
      "meta-artisan",
      "meta-prism",
      "meta-warden",
    ]) {
      assert.match(plan, new RegExp(owner));
    }
  });

  test("names the next contract and validation path", () => {
    assert.match(plan, /governance-agent-design-station-contract\.json/);
    assert.match(plan, /agentBoundaryDecision/);
    assert.match(plan, /agentLoadoutDecision/);
    assert.match(plan, /agentDesignReview/);
    assert.match(plan, /agentCandidateGateDecision/);
    assert.match(plan, /npm run meta:core:mvp:acceptance/);
    assert.match(plan, /npm run meta:test:meta-theory/);
  });
});
