# Codex -> Claude 独立审核通知

状态：READY_FOR_REVIEW
轮次：MUTEX_V2_R3A_IDENTITY

## Review Scope

- 项目根目录：`D:/knowledgeBase/Meta_Kim`
- 唯一审核问题：`project_chain_mutex.ps1` 的 Windows 实现是否能让同一物理目录的规范路径与 junction 别名得到同一个不泄露路径的 mutex 名，同时让不同物理目录得到不同名称，并正确保留驱动器根？
- 目标回执：`D:/knowledgeBase/Meta_Kim/docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R3A_IDENTITY_RECEIPT.md`
- 只审这一份 161 行 helper；不审测试、invoker、部署器、文案或发布。

## Baseline

- Git 基线：`c63676224786c57fd242fffa36766174f47bc5c6`；工作树干净。
- 候选尚未部署。
- R1 宽范围和 R2A helper+test 范围均在 300 秒无完整回执；本轮进一步压缩为单文件单问题并使用 low effort。

EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/scripts/project_chain_mutex.ps1 SHA256=0add2c04b4d80e64608982a2109afa05391e76ffe57de07e9c0ff4a324759e77
EVIDENCE: docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R2A_HELPER_TIMEOUT.md SHA256=6eacbb8088be26664b26a6cb61d54baa71374050a7d4ef34a23b6b71df80da09
NOTICE_SHA256: ab6d8e650e89c513787193f3886b53b440f7028703deeee8c6c96529c8e70a3d

## 变更意图

Windows 路径字符串不足以识别 junction 等物理别名。helper 先解析并保留合法根路径，再用目录句柄取得卷序列号与文件索引，编码为内部身份并做 SHA-256，最终只返回 `Local\CodexClaudeCliProjectChainV2-<64 lowercase hex>`。

## Project Guardrails

- 只读审核；只可使用 Read、Glob、Grep。
- 不执行命令，不修改文件，不调用模型或子代理。
- `GO` 只表示没有发现使唯一问题失败的阻塞缺陷。

## Reproduction Commands

本轮不要求 Claude 执行命令。Codex 已运行包含路径等价、junction、驱动器根和脱敏断言的回归；该运行证据不在本轮单文件源码判断范围内。

## Known Gaps

- Claude 不能独立运行或哈希。
- 非 Windows fallback、测试充分性、安装后行为和发布状态均不在范围。

## 审核重点

只判断 Win32 `CreateFile` / `GetFileInformationByHandle`、根路径裁剪、UNC/extended path 处理、身份串和 SHA-256 mutex 名构造是否存在阻塞性错误。若 HOLD，必须指向具体语句和可复现场景。

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
