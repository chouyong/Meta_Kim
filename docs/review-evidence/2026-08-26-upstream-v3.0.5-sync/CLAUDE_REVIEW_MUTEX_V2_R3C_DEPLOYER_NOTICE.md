# Codex -> Claude 独立审核通知

状态：READY_FOR_REVIEW
轮次：MUTEX_V2_R3C_DEPLOYER

## Review Scope

- 项目根目录：`D:/knowledgeBase/Meta_Kim`
- 唯一审核问题：`deploy_project_chain_mutex_v2.ps1` 是否能在旧 V1 链仍可能存在时，以 fail-closed 事务方式安装 V2 候选，拒绝未知目标漂移，并在任意中途失败后完整恢复已触碰文件？
- 目标回执：`D:/knowledgeBase/Meta_Kim/docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R3C_DEPLOYER_RECEIPT.md`
- 只审部署器；不审 helper、回归、invoker 业务语义、Skill 文案或发布。

## Baseline

- Git 基线：`c63676224786c57fd242fffa36766174f47bc5c6`；工作树干净。
- 部署尚未执行。
- 8 个旧版既有目标当前均与 D 盘 `original/` 备份相同；新增 helper/test/eval 没有旧版原件。

EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/deploy_project_chain_mutex_v2.ps1 SHA256=38e2b56ae4ab28f07a21396f7b8559062e689e87440a2d28c611dcd6f86999c4
EVIDENCE: docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/MUTEX_V2_VERIFICATION_R1.md SHA256=2ff399bc8fdd2681b6cbbde3e80b93c6182fee4039f12180b53ec846faba1515
NOTICE_SHA256: 296b1095fab52fa0ce05c53ae292139ce130703420cadfeeca90e14338f3b93f

## 变更意图

部署器应在持有 `Local\CodexClaudeCliSingleChainV1` 时完成整组迁移，避免旧 invoker 与新 helper 混用。它应只接受当前目标等于 D 盘 original 或 candidate 的精确哈希，备份到 D 盘 staging，按 helper/test/eval -> Skill -> invoker -> rules 顺序覆盖，逐文件验证 SHA-256，并在异常时逆序回滚 touched 集合后再释放 V1。

## Project Guardrails

- 只读审核；只可使用 Read、Glob、Grep。
- 不执行部署或任何命令，不修改文件，不调用模型或子代理。
- `GO` 只回答部署器事务与迁移安全问题。

## Reproduction Commands

Claude 不执行命令。Codex 已做 AST 解析与 predeploy hash baseline；真正部署和安装后复验只会在本轮 GO 后执行。

## Known Gaps

- 尚未做故障注入式回滚运行；Claude 只能从源码判断异常路径。
- 文件复制不提供跨文件原子性，安全性依赖 V1 门禁、备份和回滚。
- ACL、磁盘满、杀进程/断电等宿主级故障不可能由 PowerShell catch 完全恢复。

## 审核重点

检查 V1 获取/释放、目标漂移白名单、新旧文件存在性规则、备份创建、覆盖顺序、touched 记录时机、逆序回滚、新增文件删除、哈希校验和 finally 是否存在会导致半升级或误覆盖的阻塞缺陷。

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
