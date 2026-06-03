import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  COMPLETE_PRODUCT_INPUTS,
  runCapabilityGapCompleteProduct,
} from "../../scripts/run-capability-gap-complete-product.mjs";

const sourceLeakPattern = new RegExp(
  [
    "gst" + "ack",
    "gbr" + "ain",
    "wsh" + "obson",
    "Anth" + "ropic",
    "skill-" + "creator",
    "[A-Z]:[\\\\/]",
    "Users[\\\\/]Kim",
  ].join("|"),
  "i"
);

describe("30 — Capability Gap complete product MVP", () => {
  test("runs the complete-product entry with 12 real inputs, graph, feedback, analytics, and acceptance", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "meta-kim-complete-product-"));
    try {
      const jsonPath = path.join(tempDir, "complete-product.json");
      const markdownPath = path.join(tempDir, "complete-product.md");
      const dbPath = path.join(tempDir, "complete-product.sqlite");
      const report = await runCapabilityGapCompleteProduct({
        jsonPath,
        markdownPath,
        dbPath,
      });

      assert.equal(report.status, "pass");
      assert.equal(report.summary.inputs, 12);
      assert.equal(report.summary.decisionsCovered, 6);
      assert.equal(report.summary.scorecardsPassed, 12);
      assert.equal(report.summary.frPassRate, 1);
      assert.equal(report.summary.quantitativePassRate, 1);
      assert.deepEqual(
        report.productArtifacts.map((artifact) => artifact.gapDecision.decision),
        COMPLETE_PRODUCT_INPUTS.map((item) => item.expectedDecision)
      );

      for (const id of ["R-001", "R-002", "R-003", "R-004", "R-005", "R-006"]) {
        const check = report.requirementChecks.find((item) => item.id === id);
        assert.ok(check, `${id} check missing`);
        assert.equal(check.passed, true, `${id} must pass`);
        assert.ok(check.owner, `${id} must name owner`);
        assert.ok(check.returnToStage, `${id} must name returnToStage`);
      }

      for (const scorecard of report.scorecards) {
        assert.equal(scorecard.status, "pass");
        for (const dimension of [
          "completeness",
          "boundary_fit",
          "verification_readiness",
          "least_privilege",
          "reuse_or_run_scope_fit",
        ]) {
          assert.equal(scorecard.dimensions[dimension], true, `${dimension} must pass`);
        }
      }

      assert.equal(report.graphValidation.status, "pass");
      assert.equal(report.graphValidation.conditionalEdgeCount, 6);
      assert.equal(report.graphValidation.databaseAsPlannerCount, 0);
      assert.equal(report.graphValidation.directCanonicalWriteFromGraphNode, 0);

      assert.equal(report.feedbackReplay.cases.length, 6);
      assert.equal(report.feedbackReplay.reductionPercent, 30);
      assert.ok(
        report.feedbackReplay.promotionCandidates.some(
          (item) =>
            item.repeatCount >= 3 &&
            item.status === "promotion_review_candidate" &&
            item.noAutomaticCanonicalWrite === true
        )
      );

      assert.equal(report.analytics.source, "RunStateStore");
      assert.equal(report.analytics.metricCount, 6);
      assert.equal(report.analytics.decisionDistribution.length, 6);
      assert.ok(report.analytics.userCorrectionDistribution.length >= 2);
      assert.ok(report.analytics.candidateAcceptance.length >= 2);
      assert.ok(report.analytics.repeatKeyTopList.length > 0);
      assert.ok(report.analytics.ownerFailureRate.length > 0);

      for (const artifact of report.productArtifacts) {
        for (const field of [
          "criticalSummary",
          "fetchEvidence",
          "gapDecision",
          "decisionOutput",
          "reviewResult",
          "verificationResult",
          "feedbackPlaceholder",
          "evolutionDecision",
        ]) {
          assert.ok(artifact[field], `artifact missing ${field}`);
        }
      }

      assert.doesNotMatch(JSON.stringify(report), sourceLeakPattern);

      const markdown = await readFile(markdownPath, "utf8");
      assert.match(markdown, /Capability Gap Complete Product MVP Report/);
      assert.match(markdown, /R-006/);
      assert.match(markdown, /Analytics/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
