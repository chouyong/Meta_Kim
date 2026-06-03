import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const prd = readFileSync(
  path.join(REPO_ROOT, "docs", "ai-native-capability-gap-mvp-prd.zh-CN.md"),
  "utf8"
);

describe("29 — Capability Gap complete product PRD", () => {
  test("marks current completion state without claiming complete product delivery", () => {
    assert.match(prd, /## 当前完成状态/);
    assert.match(prd, /已测通/);
    assert.match(prd, /部分完成/);
    assert.match(prd, /未完成/);
    assert.match(prd, /还不能宣称“完整产品已经可用于万物制作”/);
  });

  test("defines remaining complete-product scope with measurable acceptance", () => {
    for (const section of [
      "R-001 分支产物质量门",
      "R-002 用户纠错回放与进化门",
      "R-003 可执行 Graph Contract",
      "R-004 Run Analytics",
      "R-005 默认产品入口",
      "R-006 完整产品验收命令",
      "R-007 默认 meta-theory orchestration runtime path",
      "R-008 跨 runtime 真实投影验证",
      "R-009 Warden 审批后的真实长期 writeback 流程",
      "R-010 用户可读 UI / 报告层",
      "完整产品 Definition of Done",
    ]) {
      assert.match(prd, new RegExp(section), `missing ${section}`);
    }

    for (const metric of [
      "真实输入至少 12 条",
      "每类至少 2 条",
      "branch coverage 100%",
      "database_as_planner_count = 0",
      "用户纠正 replay 后",
      "FR pass rate 100%",
      "Quantitative acceptance pass rate 100%",
      "fake owner 0",
      "自动写 canonical 0",
      "未授权外部写动作 0",
    ]) {
      assert.match(prd, new RegExp(metric), `missing metric ${metric}`);
    }
  });

  test("requires PRD iteration status for every future product iteration", () => {
    for (const marker of [
      "## PRD 迭代与任务状态规则",
      "每次 Capability Gap / meta-theory 产品迭代都必须同步更新本 PRD",
      "每项任务的状态",
      "GitHub 差距",
      "未开始",
      "进行中",
      "部分完成",
      "已测通",
      "阻塞",
    ]) {
      assert.match(prd, new RegExp(marker), `missing iteration marker ${marker}`);
    }
  });

  test("tracks the four next product targets with status and done standards", () => {
    for (const marker of [
      "T-001",
      "默认 meta-theory orchestration runtime path",
      "T-002",
      "Claude / Codex / Cursor / OpenClaw 四端投影验证",
      "T-003",
      "Warden 审批后的真实长期 writeback 流程",
      "T-004",
      "用户可读 UI / 报告层",
      "Definition of Done",
      "orchestrationTaskBoardPacket",
      "workerTaskPackets",
      "approved-for-writeback",
      "按 runId 查看",
    ]) {
      assert.match(prd, new RegExp(marker), `missing target marker ${marker}`);
    }
  });

  test("keeps Capability Gap product settings in a single PRD source", () => {
    assert.equal(
      existsSync(path.join(REPO_ROOT, "docs", "meta-kim-capability-governance-langgraph-plan.zh-CN.md")),
      false,
      "Capability Gap / LangGraph product settings must not live in a second plan"
    );
    assert.match(prd, /单一产品源/);
    assert.match(prd, /不要再维护第二份 Capability Gap \/ LangGraph 产品设定文档/);
  });

  test("defines capability as a multi-type function stack, not skill-only", () => {
    for (const marker of [
      "能力口径",
      "不是 skill-only",
      "governance / execution agent",
      "script / command",
      "MCP provider / MCP tool",
      "runtime tool / plugin / connector",
      "retrieval capability",
      "dependency / external tool package",
      "workerTask",
      "multi-type capability inventory",
      "researchCapabilityDiscovery",
      "deepResearchPlan",
    ]) {
      assert.match(prd, new RegExp(marker), `missing multi-capability marker ${marker}`);
    }
  });

  test("keeps user goal prompt out of product PRD requirements", () => {
    assert.doesNotMatch(prd, /下一目标提示词/);
    assert.doesNotMatch(prd, /复制.*提示词/);
  });
});
