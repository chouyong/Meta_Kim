import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  test("keeps user goal prompt out of product PRD requirements", () => {
    assert.doesNotMatch(prd, /下一目标提示词/);
    assert.doesNotMatch(prd, /复制.*提示词/);
  });
});
