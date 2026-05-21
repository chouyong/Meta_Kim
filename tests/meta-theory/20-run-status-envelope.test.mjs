import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readFile as readRepoFile } from "./_helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("meta-theory run status envelope", () => {
  test("workflow contract defines cross-runtime public run status", async () => {
    const contract = await readJson("config/contracts/workflow-contract.json");
    const envelope = contract.runDiscipline?.runStatusEnvelope;

    assert.ok(envelope?.enabled, "runStatusEnvelope must be enabled");
    assert.equal(envelope.schemaVersion, 1);
    assert.equal(
      envelope.stateFiles?.activeRun,
      ".meta-kim/state/{profile}/active-run.json",
    );
    assert.equal(
      envelope.stateFiles?.perRunStatus,
      ".meta-kim/state/{profile}/runs/{runId}/status.json",
    );
    assert.equal(envelope.pathPolicy?.crossPlatform, true);
    assert.equal(envelope.pathPolicy?.useNodePathJoin, true);
    assert.equal(envelope.pathPolicy?.mustStayWithin, ".meta-kim/state");
    assert.equal(envelope.publicDisplayPolicy?.primaryDisplay, "conversation_notice");
    assert.equal(envelope.publicDisplayPolicy?.popupRequired, false);

    for (const field of [
      "active",
      "runId",
      "currentStage",
      "stageIndex",
      "stageTotal",
      "percent",
      "completed",
      "next",
      "blockedOn",
      "surfaceMode",
      "locale",
      "languageSource",
      "publicSurface",
      "stagePurposeByLocale",
    ]) {
      assert.ok(
        envelope.requiredFields.includes(field),
        `runStatusEnvelope must require ${field}`,
      );
    }

    for (const runtime of ["claude", "codex", "cursor", "openclaw"]) {
      assert.ok(
        envelope.runtimeAdapters?.[runtime],
        `runStatusEnvelope must document ${runtime} adapter behavior`,
      );
    }
  });

  test("spine-state writes active-run and per-run status files", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "meta-kim-status-"));
    try {
      const spine = await import(
        `../../canonical/runtime-assets/shared/hooks/spine-state.mjs?test=${Date.now()}`
      );

      let state = spine.createInitialState({
        taskClassification: "meta_theory_auto",
        triggerReason: "skill_activation_auto",
      });
      await spine.writeSpineState(tempDir, state);

      const activePath = path.join(
        tempDir,
        ".meta-kim",
        "state",
        "default",
        "active-run.json",
      );
      let active = JSON.parse(await readFile(activePath, "utf8"));

      assert.equal(active.active, true);
      assert.equal(active.currentStage, "Critical");
      assert.equal(active.stageIndex, 1);
      assert.equal(active.stageTotal, 8);
      assert.equal(active.percent, 12);
      assert.equal(active.locale, "en-US");
      assert.equal(active.stagePurposeByLocale["zh-CN"], "判断元治理是否已触发，以及是否需要先澄清");
      assert.equal(active.publicSurface.primaryDisplay, "conversation_notice");
      assert.equal(active.publicSurface.popupRequired, false);
      assert.ok(active.runId.startsWith("meta-"));

      const perRunPath = path.join(
        tempDir,
        ".meta-kim",
        "state",
        "default",
        "runs",
        active.runId,
        "status.json",
      );
      const perRun = JSON.parse(await readFile(perRunPath, "utf8"));
      assert.equal(perRun.runId, active.runId);

      state = spine.advanceStage(state, "fetch");
      await spine.writeSpineState(tempDir, state);
      active = JSON.parse(await readFile(activePath, "utf8"));

      assert.equal(active.currentStage, "Fetch");
      assert.equal(active.stageIndex, 2);
      assert.equal(active.percent, 25);
      assert.deepEqual(active.completed, ["Critical"]);
      assert.equal(active.next, "Thinking");
      assert.equal(active.stagePurposeByLocale["zh-CN"], "正在收集能力、证据和约束");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("skill and notice template describe the public status surface", async () => {
    const skill = await readRepoFile("canonical/skills/meta-theory/SKILL.md");
    const notice = await readRepoFile(
      "canonical/templates/user-interaction/notice-template.md",
    );
    const combined = `${skill}\n${notice}`;

    assert.match(combined, /runStatusEnvelope/);
    assert.match(combined, /\.meta-kim\/state\/\{profile\}\/active-run\.json/);
    assert.match(combined, /Meta governance active: \{Current Stage\}/);
    assert.match(combined, /stagePurposeByLocale/);
    assert.match(combined, /latest input language/);
    assert.match(combined, /must not expose internal protocol fields/i);
    assert.match(combined, /Preflight/);
    assert.match(combined, /conversation_fallback/);
  });

  test("status CLI localizes inactive output", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/meta-run-status.mjs", "--locale=zh-CN"],
      {
        cwd: path.resolve(__dirname, "..", ".."),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /元治理状态：未运行/);
  });
});
