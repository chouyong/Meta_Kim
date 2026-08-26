# Codex -> Claude 独立审核通知

状态：READY_FOR_REVIEW
轮次：MUTEX_V2_R3D_INVOKERS

## Review Scope

- 项目根目录：`D:/knowledgeBase/Meta_Kim`
- 唯一审核问题：三个候选 invoker 的 mutex 接入片段是否都保留递归拒绝、只按项目物理身份互斥、在 contention 时 fail closed，并在所有成功/异常路径正确 ReleaseMutex/Dispose，而没有残留 V1 用户级锁？
- 目标回执：`D:/knowledgeBase/Meta_Kim/docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R3D_INVOKERS_RECEIPT.md`
- 只比较 mutex/recursion 片段；不审核模型提示、响应解析、认证重试、helper 内部、测试或部署器。

## Baseline

- Git 基线：`c63676224786c57fd242fffa36766174f47bc5c6`；工作树干净。
- 三个 invoker 均在 D 盘 staging，尚未部署。
- 回归已从三个入口验证 recursion guard，并从两侧入口验证 same/different-project 行为。

EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/scripts/invoke_claude_review.ps1 SHA256=069485e158fec06d8c318fbfd5cb9b254b19818abdf4657aacd6e87dc89e319d
EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/claude-review/scripts/invoke_codex_review.ps1 SHA256=c6c9092aa32a49a7f17dd23241e62c1cc740d44be7f43c13cf1a7360440f9f48
EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/claude-develop/scripts/invoke_codex_develop.ps1 SHA256=8a1696b0a0326408d3d7a6f3bbad5a0b23a2330ef3c54412ad11d3ec2ac27ece
EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/scripts/project_chain_mutex.ps1 SHA256=0add2c04b4d80e64608982a2109afa05391e76ffe57de07e9c0ff4a324759e77
NOTICE_SHA256: 3e00eb868c51fd5df368deab8fd524c52c85d187f83ef921012e67a330675040

## 变更意图

三个方向共享同一 helper 与 `Local\CodexClaudeCliProjectChainV2-<digest>` 命名。`CODEX_CLAUDE_CLI_CHAIN_ACTIVE` 继续阻止任何嵌套模型链；项目 mutex 只负责同一项目的顶层链串行。不同项目不共享锁。

## Project Guardrails

- 只读审核；只可使用 Read、Glob、Grep。
- 优先 Grep 指定符号并只读小范围上下文，不通读无关业务段。
- 不执行命令，不修改文件，不调用模型或子代理。
- `GO` 只回答三个 invoker 的 mutex/recursion 接入是否一致且 fail closed。

## Reproduction Commands

Claude 不执行命令。Codex 已运行 shared regression，`RecursionGuardVerified=true`，并确认 candidate invoker 中 V1 名称零命中。

## Known Gaps

- Claude 不能独立执行真实模型链。
- 旧 invoker 的认证、超时、响应解析等未变业务逻辑不在范围。

## 审核重点

对每个文件只检查：recursion env 检查顺序、helper 存在/加载、mutex name 来源、WaitOne/AbandonedMutexException、contention 错误、chain env 设置、嵌套 try/finally、ReleaseMutex 和 Dispose。确认没有任何一侧仍使用 V1 或全局固定 mutex。

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
