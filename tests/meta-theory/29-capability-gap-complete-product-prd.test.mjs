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
  test("marks local complete-product state with live/native release boundary", () => {
    assert.match(prd, /## 当前完成状态/);
    assert.match(prd, /已测通/);
    assert.match(prd, /Complete product MVP 已经在本地证明/);
    assert.match(prd, /还不能宣称“发布级 live\/native 全 runtime 完成”/);
    assert.match(prd, /Cursor 还没有 native live-turn harness/);
    assert.match(prd, /Claude 和 OpenClaw 全九个 meta agents shard live evidence 已闭合/);
    assert.match(prd, /Codex \| live pass/);
    assert.match(prd, /Cursor 还没有 native live-turn harness/);
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
      "R-011 AI 课可理解产品标准",
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
      "requiredEvidence",
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
      "T-005",
      "AI 课可理解产品标准",
      "Definition of Done",
      "orchestrationTaskBoardPacket",
      "workerTaskPackets",
      "approved-for-writeback",
      "按 runId 查看",
      "设计、执行、验收、反馈、交付内容",
      "Codex live pass",
      "Cursor live harness",
      "全 meta agents shard live evidence",
    ]) {
      assert.match(prd, new RegExp(marker), `missing target marker ${marker}`);
    }
  });

  test("tracks a granular parallel work queue for unfinished runtime and product work", () => {
    for (const marker of [
      "### 可并行任务队列",
      "主窗口由 `meta-warden` / `meta-conductor` 保持总控",
      "可子窗口并行",
      "P-001",
      "Codex live prompt 最小化",
      "已测通",
      "P-002",
      "Codex session recovery",
      "codex_live_timeout",
      "sessionRecoveryHint",
      "META_KIM_CODEX_LIVE_TIMEOUT_FIXTURE=1",
      "recoveredFromTimeout = true",
      "P-003",
      "Codex 主窗口 / 子窗口隔离复测",
      "019e9163-31ec-7510-86f9-9fc645c95811",
      "019e916e-4782-7081-ae57-740b4c3bf1b2",
      "第二轮 PASS",
      "无新增文件改动",
      "P-004",
      "Cursor native live-turn harness 设计",
      "P-005",
      "Cursor native live-turn harness 实现或明确阻塞",
      "P-006",
      "Claude 全 meta agents shard",
      "P-007",
      "OpenClaw 全 meta agents shard",
      "P-008",
      "四端 evidence aggregator",
      "P-009",
      "runtime failure taxonomy",
      "P-010",
      "真实 Warden approval packet",
      "P-011",
      "当前 repo canonical writeback dry-run",
      "P-012",
      "Web/UI 产品面板原型",
      "P-013",
      "报告可读性 review",
      "P-014",
      "AI 课评分表导出",
      "P-015",
      "多 gap 混合需求 fixture",
      "P-016",
      "orchestration board 并行/线性计划质量门",
      "P-017",
      "深度研究前置门",
      "P-018",
      "multi-type capability inventory 质量门",
      "P-019",
      "skill 触发入口边界",
      "P-020",
      "同类型多需求拆分",
      "P-021",
      "非 agent 能力候选站点质量门",
      "stationCoverage",
      "npm run meta:gap:validate-board",
      "npm run meta:gap:score-candidates",
      "P-022",
      "产品面板数据合同",
      "config/contracts/run-report-panel-contract.json",
      "runReportPanelContract",
      "P-023",
      "AI 课案例包",
      "P-024",
      "Cursor native live pass 解阻",
      "当前主干闭合顺序",
      "当前可并行批次",
      "Runtime evidence",
      "Orchestration quality",
      "User deliverable",
      "Release closure",
    ]) {
      assert.match(prd, new RegExp(marker), `missing parallel queue marker ${marker}`);
    }
  });

  test("records orchestration quality completion and GitHub delta", () => {
    for (const marker of [
      "编排质量轨",
      "tests/meta-theory/33-capability-gap-orchestration-quality.test.mjs",
      "当前 GitHub 差距",
      "P-015 到 P-021 编排质量轨",
      "仍未完成且不能对 GitHub 宣称完成",
      "P-012 / P-013 / P-014 / P-023",
      "P-024 Cursor native live pass 解阻",
    ]) {
      assert.match(prd, new RegExp(marker), `missing v0.16 marker ${marker}`);
    }
  });

  test("keeps panel data contract completion without overclaiming runtime completion", () => {
    for (const marker of [
      "P-022 产品面板数据合同",
      "runReportPanelContract",
      "decision summary",
      "owner handoff",
      "blocked reason",
      "runtime evidence",
      "approval request",
      "course rubric",
      "deliverables",
      "P-012 / P-013 / P-014 / P-023",
      "不能把某一类交付物冒充另一类",
    ]) {
      assert.match(prd, new RegExp(marker), `missing v0.17 panel marker ${marker}`);
    }
  });

  test("records user deliverables completion without clearing Cursor native blocker", () => {
    for (const marker of [
      "npm run meta:theory:deliverables",
      "run-panel.html",
      "readability-review.zh-CN.md",
      "ai-course-rubric.zh-CN.md",
      "ai-course-rubric.json",
      "ai-course-case-pack.zh-CN.md",
      "tests/meta-theory/34-run-deliverables.test.mjs",
      "P-012 / P-013 / P-014 / P-023 用户交付轨",
      "P-024 Cursor native live pass 解阻",
      "用户交付轨已有面板数据合同、静态 Web/UI、可读性 review、AI 课评分表和课程案例包",
      "后续只能扩展真实课程样本，不能把某一类交付物冒充另一类",
    ]) {
      assert.match(prd, new RegExp(marker), `missing deliverable marker ${marker}`);
    }
  });

  test("records all meta agents shard evidence with only Cursor native still blocked", () => {
    for (const marker of [
      "P-006 / P-007 全 meta agents shard live evidence",
      "仍未完成且不能对 GitHub 宣称完成：P-024 Cursor native live pass 解阻",
      "Claude 和 OpenClaw 全九个 meta agents shard live evidence 已闭合",
      "P-006",
      "9/9 agentResults ok",
      "runtimeEvidencePacket.failureClasses.claude = \"pass\"",
      "P-007",
      "minimax-portal/MiniMax-M3",
      "hooks 4/4 ready",
      "批量模式出现过 timeout",
      "验收口径采用单 shard 证据而非虚报整批 pass",
      "all meta agents shard live pass",
      "无 OpenClaw shard 剩余动作；保留批量 timeout 作为稳定性改进信号",
    ]) {
      assert.match(prd, new RegExp(marker), `missing v0.19 runtime shard marker ${marker}`);
    }
  });

  test("records v0.20 Cursor WSL candidate while preserving native-live blocker", () => {
    for (const marker of [
      "P-024 官方 WSL candidate probe",
      "官方 Windows WSL `cursor-agent`",
      "cursor-agent-wsl",
      "WSL Ubuntu 存在但 `command -v cursor-agent` 为空",
      "Windows native、Cursor IDE subcommand、官方 Windows WSL `cursor-agent` 三个候选",
      "Cursor CLI installation 文档声明 macOS / Linux / Windows WSL 可用 `cursor-agent --version` 验证",
      "failureClass = \"native_harness_missing\"",
      "不能对 GitHub 宣称完成：P-024 Cursor native live pass 解阻",
    ]) {
      assert.match(prd, new RegExp(marker), `missing v0.20 Cursor marker ${marker}`);
    }
  });

  test("records expanded unfinished parallel backlog instead of collapsing to one blocker", () => {
    for (const marker of [
      "版本：v0.21",
      "未完成但可并行推进的扩展 / 解阻队列",
      "P-025",
      "Cursor WSL live 安装与只读验收子窗口",
      "P-026",
      "Cursor 官方文档 source-backed refresh",
      "P-027",
      "Cursor native success fixture",
      "P-028",
      "GitHub 差距自动报告",
      "P-029",
      "跨 run 趋势服务化面板",
      "P-030",
      "AI 课真实 reviewer 样本回放",
      "P-031",
      "真实 Warden approved canonical writeback",
      "P-032",
      "OpenClaw batch live 稳定性改进",
      "P-033",
      "runtime live shard 自动化矩阵",
      "P-034",
      "子窗口验收包模板",
      "P-035",
      "真实复杂输入扩展集",
      "P-036",
      "PRD 状态完整性守卫",
      "这些任务不会让当前 MVP 重新变成未完成",
    ]) {
      assert.match(prd, new RegExp(marker), `missing expanded backlog marker ${marker}`);
    }
  });

  test("records current live runtime evidence without overclaiming release-grade completion", () => {
    for (const marker of [
      "当前 live evidence matrix",
      "Claude",
      "live pass",
      "Codex",
      "orchestrationTaskBoardPacket.synthesisOwner",
      "workerTaskPackets\\[0\\].owner",
      "OpenClaw",
      "MiniMax M3",
      "Cursor",
      "native live blocked-with-contract",
      "cursor-live-turn-harness-v0.1",
      "native_harness_missing",
      "evidenceKind = \"unsupported\"",
      "不能当 release-grade native live pass",
    ]) {
      assert.match(prd, new RegExp(marker), `missing live evidence marker ${marker}`);
    }
  });

  test("defines AI-course understandable standards for product outputs", () => {
    for (const marker of [
      "AI 课可理解产品标准",
      "设计标准",
      "执行标准",
      "验收标准",
      "反馈标准",
      "交付内容标准",
      "人话问题",
      "通过标准",
      "失败标准",
      "requiredEvidence",
      "config/contracts/ai-course-product-standards.json",
    ]) {
      assert.match(prd, new RegExp(marker), `missing AI-course standard ${marker}`);
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
