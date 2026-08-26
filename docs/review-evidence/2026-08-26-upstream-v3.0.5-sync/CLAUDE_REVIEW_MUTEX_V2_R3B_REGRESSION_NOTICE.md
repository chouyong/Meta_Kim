# Codex -> Claude 独立审核通知

状态：READY_FOR_REVIEW
轮次：MUTEX_V2_R3B_REGRESSION

## Review Scope

- 项目根目录：`D:/knowledgeBase/Meta_Kim`
- 唯一审核问题：`test_project_chain_mutex.ps1` 与 `project-mutex-regression.json` 是否真实覆盖声明的 mutex 行为，且没有用自证式、永远通过或观察时序错误的夹具制造假阳性？
- 目标回执：`D:/knowledgeBase/Meta_Kim/docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R3B_REGRESSION_RECEIPT.md`
- 不重新审核 helper 正确性、invoker、部署器、文案或发布。

## Baseline

- Git 基线：`c63676224786c57fd242fffa36766174f47bc5c6`；工作树干净。
- 两份 test 脚本 SHA-256 相同；两份 eval JSON SHA-256 相同，因此只审 Codex 侧一份代表副本。
- Codex 与 Claude 两侧脚本各实际运行一次，均返回全部布尔项 true，显式 D 盘临时残留为 0。

EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/scripts/test_project_chain_mutex.ps1 SHA256=7e56e790feb2793c9bf2e3e28534fba1d5336765b0152a55cd6a27a1ba8f23bf
EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/evals/project-mutex-regression.json SHA256=0a4a2e9f81fb838b2c7e7571feefd38a7fa770132e4adb869ed19bb552f2d6bc
EVIDENCE: docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/MUTEX_V2_VERIFICATION_R1.md SHA256=2ff399bc8fdd2681b6cbbde3e80b93c6182fee4039f12180b53ec846faba1515
NOTICE_SHA256: 886af30a0586a992aa2f15b1e845de6d33bd610ea4b128c2f13a4cf89d92947e

## 变更意图

回归必须证明 same-project contention、different-project concurrency、等价路径、junction、drive root、recursion guard、mutex-name redaction 和 abandoned-owner recovery。历史夹具曾在 owner 退出后才创建观察句柄，导致 abandoned 状态不可见；候选已改为提前保活 observer handle。

## Project Guardrails

- 只读审核；只可使用 Read、Glob、Grep。
- 不执行命令，不修改文件，不调用模型或子代理。
- `GO` 只回答测试是否足以支持其声明且不存在阻塞性假阳性。

## Reproduction Commands

Claude 不执行命令。Codex 已分别调用两侧 test 脚本，显式传入三份 candidate root 和 D 盘 `-TempParent`；两次输出记录见验证文件。Claude 只审查测试实现与 eval 契约的一致性。

## Known Gaps

- Claude 不能独立重跑或计算哈希。
- 性能、公平性、跨会话 Global mutex 可见性和非 Windows 行为不在范围。

## 审核重点

检查每个布尔项是否由独立、可失败的条件产生；重点审查子进程退出码、锁持有时序、abandoned observer 生命周期、junction 创建/清理、drive root 断言、递归探针和临时目录清理。若 HOLD，必须指出具体可产生假阳性的路径。

## Forbidden Actions

- 禁止 Write/Edit、Bash、commit、push、部署、凭据访问和外部消息。
- 禁止调用 Codex、Claude 子会话、Agent 或其它模型。
- 禁止创建 C 盘审核文档。

## 回执契约

回执必须识别实际 reviewer 与 `Claude CLI read-only safe-mode` 方法，并按顺序包含：

```text
## Findings
## Actions Executed and Not Executed
## Review Scope
## Evidence Gaps
## Residual Risks
FINAL_DECISION: GO
```

唯一末行必须为 `FINAL_DECISION: GO` 或 `FINAL_DECISION: HOLD`。
