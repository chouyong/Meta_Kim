# Meta_Kim AI-native Capability Gap MVP PRD

## 文档控制

- 版本：v0.21
- 状态：Complete product MVP implemented locally; live/native runtime release scope still bounded
- Owner：meta-conductor 负责 PRD 与执行节奏，meta-warden 负责最终边界门禁
- 建议目标版本：v2.9.0-alpha.1 先做 fixture 和决策策略验证；价值成立后再进入 v2.9.0
- 产物类型：MVP PRD / 执行计划
- 本期判断脊柱：Critical / Fetch / Thinking / Review

## Executive Summary

本期只证明一件事：当 Meta_Kim 发现缺能力时，默认路径能自然判断该创建 skill、agent、script、MCP-provider、只发 workerTask，还是阻塞等待授权，而不是让主线程硬做、万能 owner 硬接，或靠 validator 事后补救。

## 当前完成状态

这部分用于防止后续目标跑偏。它不是说产品已经完整，而是标明哪些已经有本地证据，哪些只是部分完成，哪些还不能算完成。

状态标记：

- 已测通：已有本地测试或报告证明，且可重复运行。
- 部分完成：已有结构或样例，但还没有覆盖完整产品闭环。
- 未完成：还没有足够的可执行证据，不能宣称交付。

| 模块 | 状态 | 当前证据 | 还缺什么 |
|---|---|---|---|
| 六类 GapDecision 判断 | 已测通 | `tests/meta-theory/22-capability-gap-mvp.test.mjs`、`npm run meta:gap:real-input-replay` | 增加更多真实输入样本，覆盖更复杂组合任务 |
| DecisionOutput 合同 | 已测通 | `config/contracts/capability-gap-output-contract.json`、FR-011、`npm run meta:gap:score-candidates` | 后续把 scorecard 渲染进课程评分表和 Web/UI 面板 |
| RunStateStore / SQLite 记录 | 已测通 | `runs`、`run_events`、`capability_gaps`、`gap_decisions`、`user_feedback` 写入；`runtime_evidence_recorded` 与 `warden_writeback_dry_run_recorded` 事件可查询 | 增加跨 run 趋势和失败热点可视化 |
| LangGraph-style state / edge | 已测通 | `config/contracts/capability-gap-executable-graph-contract.json`、`tests/meta-theory/30-capability-gap-complete-product.test.mjs` | 后续只扩展真实服务化 checkpoint adapter |
| create_agent 治理站点 | 已测通 | Genesis / Artisan / Librarian / Prism / Warden 五站点产物，station coverage 100% | 后续只做更多真实输入扩展 |
| 真实输入新进程回放 | 已测通 | `docs/capability-gap-real-input-replay-report.zh-CN.md`，6/6 pass | 扩展到多轮用户纠错和组合任务 |
| 用户反馈闭环 | 已测通 | `feedbackReplay.correctionInfluence.decisionChangedByCorrection = true`，重复 3 次生成 `promotion_review_candidate` | 后续接真实用户多轮纠错样本 |
| 默认产品入口 | 已测通 | `npm run meta:theory:run`、`tests/meta-theory/32-meta-theory-four-product-targets.test.mjs` | 后续把更多真实任务样本接入默认入口回放 |
| 运行数据分析 | 已测通 | `meta:theory:run` 写入 RunStateStore，并在 run artifact 中带 analytics | 后续增加跨 run 趋势和失败热点可视化 |
| 完整产品验收 | 已测通 | `npm run meta:release:smoke`、`tests/meta-theory/30-capability-gap-complete-product.test.mjs`、`tests/meta-theory/32-meta-theory-four-product-targets.test.mjs` | 后续只剩 Cursor native live harness 解阻后才能宣称发布级全 runtime complete |
| meta-theory 编排入口 | 已测通 | `npm run meta:theory:run` 默认输出 `orchestrationTaskBoardPacket`、`workerTaskPackets`、runId 报告 | 后续接更多 runtime 原生触发器的 live 证据 |
| 编排质量轨 | 已测通 | `npm run meta:gap:orchestrate`、`npm run meta:gap:validate-board`、`npm run meta:gap:score-candidates`、`tests/meta-theory/31-capability-gap-orchestration.test.mjs`、`tests/meta-theory/33-capability-gap-orchestration-quality.test.mjs` | 后续把同样质量门接进更多 runtime live shard |
| 跨 runtime 投影验证 | 部分完成 | Claude / Codex / OpenClaw 有 live pass；Claude 与 OpenClaw 全九个 meta agents shard live evidence 已测通；Cursor smoke pass；Cursor native live harness contract 已测通，但本机 `cursor-agent` / `cursor agent -p --output-format` 不可用时返回 structured blocked；runtime evidence packet 统一记录 `status`、`evidenceKind`、`failureClass`、`command`、`artifact`、`remainingAction` | 还缺可执行 Cursor native live pass |
| Warden 审批写回 | 已测通 | `tests/meta-theory/32-meta-theory-four-product-targets.test.mjs` 证明 `warden-approval-v0.1` 审批包、`candidate_only`、dry-run 0 写入、`approved-for-writeback` 受控写入 | 后续在真实 Warden 人工批准后才允许写当前 repo canonical |
| 用户可读产品面板 | 已测通 | `npm run meta:theory:report -- --run-id latest` 可按 runId 读取中文报告；`runReportPanelContract` 已进入 governed run artifact；`npm run meta:theory:deliverables` 可生成静态 Web/UI 面板 | 后续做交互式服务化面板和跨 run 趋势视图 |
| AI 课可理解产品标准 | 已测通 | `config/contracts/ai-course-product-standards.json`、完整产品报告中的“AI 课可理解标准”、`ai-course-rubric` 与 `ai-course-case-pack` 交付物 | 后续接真实课程 reviewer 样本和人工评分回放 |

当前可以宣称的结论：

- Complete product MVP 已经在本地证明：设计、执行、验收、反馈、交付内容都有可复查证据，且能按 AI 课可理解标准解释。
- 还不能宣称“发布级 live/native 全 runtime 完成”，因为 Cursor 还没有 native live-turn harness；真实外部写回仍需要 Warden 明确批准。

## PRD 迭代与任务状态规则

从 v0.5 开始，每次 Capability Gap / meta-theory 产品迭代都必须同步更新本 PRD。聊天记录、子窗口结论、测试输出和 commit 摘要都不能替代 PRD 状态。

每次修改或迭代至少更新这些内容：

- 文档控制中的版本、状态或目标版本建议。
- `当前完成状态` 表中相关模块的状态、当前证据、还缺什么。
- 对应 R 项的目标、量化验收、失败条件。
- 新增或变更的测试入口、CLI 入口、报告入口。
- 每项任务的状态：未开始、进行中、部分完成、已测通、阻塞。
- GitHub 差距：本地相对 `origin/main` 新增了哪些产品能力、哪些仍未 push。

当前 GitHub 差距：

- 本地已有但 `origin/main` 仍未包含：Cursor live harness blocked contract、runtime evidence aggregator / writeback approval、P-015 到 P-021 编排质量轨、P-022 产品面板数据合同、P-012 / P-013 / P-014 / P-023 用户交付轨、P-006 / P-007 全 meta agents shard live evidence、P-024 官方 WSL candidate probe、P-025 到 P-036 未完成并行扩展队列、以及本 PRD v0.21 的状态更新。
- 仍未完成且不能对 GitHub 宣称完成：P-024 Cursor native live pass 解阻。

状态口径：

| 状态 | 含义 | 允许宣称 |
|---|---|---|
| 未开始 | 只有目标，没有实现或测试 | 只能说“已列入目标” |
| 进行中 | 有代码或文档草稿，但未通过关键测试 | 只能说“正在实现” |
| 部分完成 | 有局部入口或样例证据，但未覆盖默认路径或端到端 | 只能说“局部可用” |
| 已测通 | 有可重复命令、测试或子窗口证据 | 可以说“该局部完成” |
| 阻塞 | 缺权限、缺 runtime 支持、缺用户决策或外部条件 | 必须写明阻塞原因和返回阶段 |

能力口径：

这里的“能力”不是 skill-only。Skill 只是可复用流程能力的一种。每次 Fetch / Thinking 都必须按多类型功能栈盘点：

- governance / execution agent：长期责任 owner、拒绝项、输入输出、记忆和验收政策。
- skill：可复用方法、流程、知识包、评审套路。
- script / command：稳定、机械、可测试的本地动作。
- MCP provider / MCP tool：外部系统能力、权限、凭证、审计边界和调用接口。
- runtime tool / plugin / connector：当前宿主可调用的运行时能力。
- retrieval capability：`web_search`、`url_fetch`、`docs_lookup`、`browser_open`、`mcp_search`、`plugin_search`、`local_only`、用户提供来源等研究取证能力。
- dependency / external tool package：可被采用或试点的外部工具、库、服务或生态能力。
- workerTask：本次 run 的一次性执行能力，不进入长期 identity。

Fetch 结论必须说明这些能力类型哪些已覆盖、哪些不足、哪些需要创新、哪些因为权限/风险而阻塞。Thinking 再根据这些证据决定是复用、创建、升级、阻塞，还是只发 run-scoped workerTask。

后续产品主干轨道：

| Track | 产品设定 | 当前状态 | 当前证据 | Definition of Done |
|---|---|---|---|---|
| T-001 | 默认 meta-theory orchestration runtime path | 已测通 | `npm run meta:theory:run`、`canonical/runtime-assets/codex/commands/meta-theory.md`、`tests/meta-theory/32-meta-theory-four-product-targets.test.mjs` | `/meta-theory` governed execution 默认进入 Warden -> Conductor -> orchestration board -> workerTaskPackets，而不是只靠显式 CLI |
| T-002 | Claude / Codex / Cursor / OpenClaw 四端投影验证 | 部分完成 | Claude / OpenClaw 全 meta agents shard live pass；Codex live pass；Cursor smoke pass + native live blocked-with-contract | 四端都有 live、smoke 或 unsupported-with-reason 证据；发布级完成还需要 Cursor native live pass |
| T-003 | Warden 审批后的真实长期 writeback 流程 | 已测通 | `candidate_only`、`none-with-reason`、`approved-for-writeback` 可区分；测试用临时 canonicalRoot 证明受控写入 | Warden 批准后，候选能力能以受控流程写入 canonical skill / agent，并经过 sync、review、verification |
| T-004 | 用户可读 UI / 报告层 | 已测通 | `npm run meta:theory:report -- --run-id latest`、runId 中文 Markdown 报告、`npm run meta:theory:deliverables` 静态面板 | 用户可按 runId 查看判定原因、阻塞原因、下一步 owner、升级长期能力建议和验证状态 |
| T-005 | AI 课可理解产品标准 | 已测通 | `config/contracts/ai-course-product-standards.json`、`tests/meta-theory/30-capability-gap-complete-product.test.mjs`、`tests/meta-theory/34-run-deliverables.test.mjs` | 设计、执行、验收、反馈、交付内容都有人话问题、通过标准、失败标准和证据字段 |

### 可并行任务队列

这张表是当前目标的执行队列，不新增第二份 PRD。主窗口由 `meta-warden` / `meta-conductor` 保持总控；标记为“可”的任务可以开新会话作为子窗口，只交付证据、diff 或报告，不直接改写主窗口结论。

| ID | 所属轨道 | 任务 | 状态 | 建议 owner | 可子窗口并行 | 验收证据 |
|---|---|---|---|---|---|---|
| P-001 | R-008 | Codex live prompt 最小化：把 `codex --live` 输入缩短到仍能证明 Warden -> Conductor -> board -> workerTaskPackets | 已测通 | verify | 可 | `node scripts/eval-meta-agents.mjs --runtime=codex --live` 通过，`summary.passed = ["codex"]`，返回 `orchestrationTaskBoardPacket` 与 `workerTaskPackets` |
| P-002 | R-008 | Codex session recovery：若 live 仍超时，记录可恢复 runId、stderr、timeout stage 和下一次续跑策略 | 已测通 | backend | 可 | 强制 timeout fixture 已测通：`META_KIM_CODEX_LIVE_TIMEOUT_FIXTURE=1 node scripts/eval-meta-agents.mjs --runtime=codex --live` 返回 `summary.passed = ["codex"]`、`recoveredFromTimeout = true`、`threadId = codex-live-timeout-fixture-thread`、`reason = codex_live_timeout_recovered`；未恢复时仍保留 `sessionRecoveryHint`、`retryCommand`、stdout/stderr tail |
| P-003 | R-008 | Codex 主窗口 / 子窗口隔离复测：子窗口只跑测试与证据采集，主窗口只合并和审查 | 已测通 | test | 可 | worktree 子窗口 `019e9163-31ec-7510-86f9-9fc645c95811` 发现独立 worktree 缺 runtime projections；本地主工作区只读复测子窗口 `019e916e-4782-7081-ae57-740b4c3bf1b2` 第二轮 PASS：`summary.passed = ["codex"]`、`synthesisOwner = meta-conductor`、`workerTaskPackets[0].owner = meta-artisan`、无新增文件改动 |
| P-004 | R-008 | Cursor native live-turn harness 设计：定义 Cursor 原生触发、输入、输出、可观测证据和 unsupported 条件 | 已测通 | docs | 可 | `config/contracts/cursor-live-turn-harness-contract.json` 定义官方 evidence、candidate command、passCriteria、blockedCriteria、releaseBoundary，明确 projection smoke 不能算 live pass |
| P-005 | R-008 | Cursor native live-turn harness 实现或明确阻塞：从 projection smoke 升级到 native live，或写清宿主限制 | 已测通（blocked 边界） | backend | 可 | `node scripts/eval-meta-agents.mjs --runtime=cursor --live` 在本机返回 `status = "blocked"`、`failureClass = "native_harness_missing"`、`runtimeEvidencePacket.records[0].evidenceKind = "unsupported"`；若未来 `cursor-agent` 支持 `-p --output-format json`，同一路径可升级为 live pass |
| P-006 | R-008 | Claude 全 meta agents shard：从 `meta-warden` 扩到九个 meta agents，必要时分片执行 | 已测通 | verify | 可 | `node scripts/eval-meta-agents.mjs --runtime=claude --live --agent=meta-warden,meta-conductor,meta-genesis,meta-artisan,meta-sentinel,meta-librarian,meta-prism,meta-scout,meta-chrysalis` exit 0；9/9 agentResults ok；`summary.passed = ["claude"]`；`runtimeEvidencePacket.failureClasses.claude = "pass"` |
| P-007 | R-008 | OpenClaw 全 meta agents shard：从 `meta-warden` 扩到九个 meta agents，验证 hooks / config / model 稳定性 | 已测通 | verify | 可 | OpenClaw 使用 `minimax-portal/MiniMax-M3`，hooks 4/4 ready；九个 agent 以单 agent live shard 跑通：`meta-sentinel`、`meta-warden`、`meta-conductor`、`meta-genesis`、`meta-artisan`、`meta-librarian`、`meta-prism`、`meta-scout`、`meta-chrysalis` 全部 `summary.passed = ["openclaw"]`；批量模式出现过 timeout，验收口径采用单 shard 证据而非虚报整批 pass |
| P-008 | R-008 | 四端 evidence aggregator：把 live/smoke/skipped/blocked 统一写入 RunStateStore 和中文报告 | 已测通 | backend | 可 | `runtimeEvidencePacket.records[]` 与 `runtime_evidence_recorded` 事件含 runtime、status、command、artifact、remainingAction；中文报告“Runtime 投影证据”表可读 |
| P-009 | R-008 | runtime failure taxonomy：把 timeout、auth missing、native harness missing、projection-only、tool unsupported 分成固定失败类 | 已测通 | meta-prism | 可 | `tests/setup/eval-meta-agents.test.mjs` 断言 `RUNTIME_FAILURE_TAXONOMY`、`failureClass`、`releaseGrade`；Codex timeout recovery fixture 归类为 `pass` 而不是 timeout |
| P-010 | R-009 | 真实 Warden approval packet：定义当前 repo canonical 写回前必须出现的人工批准证据格式 | 已测通 | meta-warden | 可 | `warden-approval-v0.1` 必须含 approvalId、approver、approvedAt、scope、targets、diffSummary、rollbackPlan，且 approver 必须指向 meta-warden |
| P-011 | R-009 | 当前 repo canonical writeback dry-run：不写 canonical，只生成将写入内容、目标路径和风险审查 | 已测通 | meta-chrysalis | 可 | 未提供审批包时 `dryRun.canonicalWrites = 0`、`approvalRequest` 生成、候选含 `dryRunArtifact` 与风险审查 |
| P-012 | R-010 | Web/UI 产品面板原型：按 runId 展示 GapDecision、owner、阻塞原因、升级建议和 runtime evidence | 已测通 | frontend | 可 | `npm run meta:theory:deliverables` 生成 `run-panel.html`，读取 `artifact.runReportPanelContract`，展示判定摘要、owner handoff、阻塞与审批、runtime evidence、AI 课评分标准，测试证明不泄露本机绝对路径 |
| P-013 | R-010 | 报告可读性 review：把协议字段翻译成人话标签，保留机器字段但不让用户被字段淹没 | 已测通 | review | 可 | `readability-review.zh-CN.md` 生成字段翻译表、前后对照和验收说明，AI 课 reviewer 可按人话标签解释每个结论 |
| P-014 | R-011 | AI 课评分表导出：把五维标准变成课程 reviewer 可直接打分的 Markdown / JSON rubric | 已测通 | docs | 可 | `ai-course-rubric.zh-CN.md` 与 `ai-course-rubric.json` 覆盖设计、执行、验收、反馈、交付内容，并映射 artifact evidence |
| P-015 | R-001/R-011 | 多 gap 混合需求 fixture：同类型多需求、多类型并发、共享 owner、线性依赖都要覆盖 | 已测通 | test | 可 | `tests/meta-theory/31-capability-gap-orchestration.test.mjs` 证明 6 类 gap 并发、同类型分组但不折叠 worker 实例 |
| P-016 | R-007/R-008 | orchestration board 并行/线性计划质量门：验证 dependsOn、parallelGroup、mergeOwner、reviewOwner 不冲突 | 已测通 | meta-conductor | 可 | `npm run meta:gap:validate-board`、`tests/meta-theory/33-capability-gap-orchestration-quality.test.mjs` 证明 worker parity、唯一 roleInstanceId、mergeOwner 冲突会 fail |
| P-017 | R-007 | 深度研究前置门：当任务依赖当前事实、联网搜索、平台/API 状态或外部能力候选时，`meta-scout` 必须先完成 source-backed research，再把 evidence handoff 给 Thinking | 已测通 | meta-scout | 可 | `tests/meta-theory/31-capability-gap-orchestration.test.mjs` 证明 `researchCapabilityDiscovery`、`deepResearchPlan`、source category、decisionImpactMap 在 Thinking 前存在 |
| P-018 | R-007/R-011 | multi-type capability inventory 质量门：能力不是 skill-only，Fetch 必须覆盖 agent、skill、script、command、MCP、runtime tool、plugin/connector、retrieval、dependency、workerTask | 已测通 | meta-artisan | 可 | `npm run meta:gap:orchestrate` 与测试断言 10 类 inventory 全部 `checkedBeforeThinking` |
| P-019 | R-007 | skill 触发入口边界：`meta-theory` skill 只做 adapter，真实治理入口必须是 Warden gate，编排必须由 Conductor 生成 | 已测通 | meta-warden | 可 | 默认 run artifact 固定 `meta-theory-skill-adapter -> meta-warden-entry-gate -> meta-conductor-orchestration`；测试证明 skill 不直接成为 planner |
| P-020 | R-001/R-007 | 同类型多需求拆分：多个 create_skill / create_agent / workerTask-only 需求可以共享 owner，但必须保留独立 `roleInstanceId`、`shardScope`、`dependsOn` 和验收证据 | 已测通 | test | 可 | `tests/meta-theory/31-capability-gap-orchestration.test.mjs` 证明同 repeatKey 分组、worker 实例数保留、`roleInstanceId` 不重复 |
| P-021 | R-001/R-009 | 非 agent 能力候选站点质量门：把 Genesis / Artisan / Librarian / Prism / Warden 的质量门扩展到 skill、script、MCP-provider、runtime tool 候选 | 已测通 | meta-prism | 可 | `npm run meta:gap:score-candidates` 覆盖 skill、script、MCP-provider、runtime workerTask；stationCoverage 映射 Genesis / Artisan / Librarian / Prism / Warden，boundary、loadout、least-privilege、verification、memoryPolicy、writebackPolicy 全 pass |
| P-022 | R-010 | 产品面板数据合同：先定义 Web/UI 面板读取的 runId JSON schema，再做页面，避免 UI 直接解析内部协议碎片 | 已测通 | backend | 可 | `config/contracts/run-report-panel-contract.json`、`runReportPanelContract`、`tests/meta-theory/32-meta-theory-four-product-targets.test.mjs` 证明 latest run 可生成 decision summary、owner handoff、blocked reason、runtime evidence、approval request、course rubric、deliverables |
| P-023 | R-011 | AI 课案例包：把一次 run 的设计、执行、验收、反馈、交付内容做成课程 reviewer 能直接看懂的示例 | 已测通 | docs | 可 | `ai-course-case-pack.zh-CN.md` 包含“学员该看到什么”“老师怎么评分”“通过 / 失败样例”，并链接 panel、review、rubric、manifest |
| P-024 | R-008 | Cursor native live pass 解阻：在有可用 `cursor-agent`、官方 Windows WSL `cursor-agent`，或支持 `-p --output-format json` 的 `cursor agent` 后，把 P-005 从 blocked 边界升级为真实 live pass | 阻塞 | verify | 可 | 当前复测：Windows 常见路径没有 `cursor-agent`，WSL Ubuntu 存在但 `command -v cursor-agent` 为空，`cursor agent --help` 没有 `--print` / `--output-format`；`node scripts/eval-meta-agents.mjs --runtime=cursor --live` 仍返回 `failureClass = "native_harness_missing"`。v0.20 已把 `cursor-agent-wsl` 加入合同和 probe，未来 WSL 安装后可直接升级为 live pass |

### 未完成但可并行推进的扩展 / 解阻队列

P-024 是当前发布级全 runtime native live 的硬阻塞，但它不应该把后续工作压缩成一个任务。下面这些任务可以并行推进；其中一部分用于解阻 P-024，一部分用于把已经完成的 MVP 做成更接近真实产品的持续能力。这些任务不会让当前 MVP 重新变成未完成，但完成后会提高发布级证据、用户交付质量和后续课程复盘价值。

| ID | 所属轨道 | 任务 | 状态 | 建议 owner | 可子窗口并行 | 验收证据 |
|---|---|---|---|---|---|---|
| P-025 | R-008 | Cursor WSL live 安装与只读验收子窗口：在 WSL 内安装或暴露官方 `cursor-agent`，只采集 `cursor-agent --version`、help、read-only live JSON 证据 | 阻塞 | verify | 可 | 需要用户允许安装 / 暴露 Cursor Agent CLI；通过后 `node scripts/eval-meta-agents.mjs --runtime=cursor --live` 必须返回 `summary.passed = ["cursor"]`，且无文件写入 |
| P-026 | R-008 | Cursor 官方文档 source-backed refresh：由 `meta-scout` 重新抓取官方 CLI overview / using / parameters / installation 文档，校准 P-024 的 pass / blocked 条件 | 未开始 | meta-scout | 可 | PRD 与 `cursor-live-turn-harness-contract.json` 的官方 evidence URL、claim、更新时间一致；若官方能力变更，必须更新 failure taxonomy |
| P-027 | R-008 | Cursor native success fixture：在不依赖本机真实 Cursor Agent 的情况下，构造一个成功 JSON fixture，证明 harness 能从 blocked 自动升级为 pass | 未开始 | backend | 可 | 新增测试证明 candidate help 含 `--print` / `--output-format` 且 live JSON 合格时，`failureClass = "pass"`、`releaseGrade = true` |
| P-028 | Release closure | GitHub 差距自动报告：把本地相对 `origin/main` 的能力差距、未 push commit、PRD 状态和产品设定生成机器可复查报告 | 未开始 | docs | 可 | 新增 CLI 或报告段落能输出 ahead commit 数、关键能力清单、仍未完成项、不能对 GitHub 宣称的范围 |
| P-029 | R-010 | 跨 run 趋势服务化面板：把静态 run panel 扩展成可看 decision 分布、blocked 原因、owner 失败率和课程评分趋势的服务化视图 | 未开始 | frontend | 可 | 面板可按 runId / 时间筛选，展示跨 run 趋势，不泄露本机路径或内部未解释字段 |
| P-030 | R-011 | AI 课真实 reviewer 样本回放：用真实或近真实课程评审样本验证 rubric、case pack 和报告是否能被非维护者理解 | 未开始 | review | 可 | 至少 3 个 reviewer 样本，记录误解点、评分差异、需要改写的人话标签，并回写 PRD 状态 |
| P-031 | R-009 | 真实 Warden approved canonical writeback：在用户明确批准后，把一个低风险候选能力写入当前 repo canonical，并完成 sync / review / verification | 阻塞 | meta-warden | 可 | 必须先有真实 `warden-approval-v0.1` 审批包；无审批时只能 dry-run，不能改 canonical |
| P-032 | R-008 | OpenClaw batch live 稳定性改进：排查全九 agent 批量 live timeout 的原因，决定是并发限制、超时策略还是 shard runner 改造 | 未开始 | backend | 可 | 单 shard pass 证据保留；批量 runner 要么稳定 pass，要么报告明确 timeout class、retry policy 和 remainingAction |
| P-033 | R-008 | runtime live shard 自动化矩阵：把 Claude / OpenClaw / Codex / Cursor 的 shard 命令、超时、证据文件和失败类统一成矩阵 runner | 未开始 | backend | 可 | 一个命令能生成每 runtime 的 records、artifacts、releaseGrade、remainingAction，并可被报告层读取 |
| P-034 | Verification | 子窗口验收包模板：为每个可并行任务生成固定的只读验收提示、允许命令、禁止动作和 PASS/FAIL 输出模板 | 未开始 | test | 可 | 子窗口可以直接按模板执行，不修改主窗口文件；主窗口只合并证据和 PRD 状态 |
| P-035 | R-001/R-007/R-011 | 真实复杂输入扩展集：增加更多多类型、多同类、多依赖、多阻塞的用户任务样本，验证 Conductor 编排不会退化 | 未开始 | test | 可 | 至少 10 个真实复杂输入 replay，覆盖 research-first、multi-capability、approval-blocked、workerTask-only 和 writeback candidate |
| P-036 | PRD governance | PRD 状态完整性守卫：测试 PRD 至少保留主干任务、未完成任务、GitHub 差距、并行队列和 AI 课标准，防止后续又散成多份文档 | 未开始 | meta-prism | 可 | PRD 测试能发现缺少未完成队列、GitHub 差距、状态口径或 AI 课五维标准的回归 |

当前主干闭合顺序：

1. 已完成 P-004 / P-005 的合同和 blocked 边界：Cursor projection smoke 仍可用，但本机缺可解析 native live harness 时不会冒充 live pass。
2. 已完成 P-006 / P-007：Claude 和 OpenClaw 全九个 meta agents shard live evidence 已闭合；P-024 先保持阻塞，等环境具备 Cursor Agent CLI 后再升级为 live pass。
3. 已完成 P-008 / P-009：四端证据现在有统一 failure taxonomy 和可读报告字段，防止 pass、smoke、skipped、blocked 混写。
4. 已完成 P-010 / P-011：Warden 审批包与 dry-run 预案已接入；真实当前 repo canonical 写回仍必须等明确审批包。
5. 已完成 P-015 / P-016 / P-017 / P-018 / P-019 / P-020 / P-021：编排质量轨已有 fixture、board validator、candidate scorecard 和站点映射。
6. 已完成 P-022 / P-012 / P-013 / P-014 / P-023：用户交付轨已有面板数据合同、静态 Web/UI、可读性 review、AI 课评分表和课程案例包。下一步用户交付轨只扩展真实课程样本，不再阻塞本轮闭合。

当前可并行批次：

| 批次 | 可并行任务 | 合并 owner | 依赖关系 | 不可并行点 |
|---|---|---|---|---|
| Runtime evidence | P-006、P-007、P-024 | meta-conductor | P-006 / P-007 已测通；P-024 依赖 Cursor Agent CLI 环境，当前会检查 Windows native、Cursor IDE subcommand、官方 Windows WSL `cursor-agent` 三个候选 | P-024 没有可用 CLI 前只能保留 blocked，不可伪造 pass |
| Orchestration quality | P-015、P-016、P-017、P-018、P-019、P-020、P-021 | meta-conductor | 已测通，作为后续用户交付轨和 runtime live shard 的前置质量门 | 后续只能扩展更多样本，不能退回 skill-only 或伪并行 |
| User deliverable | P-012、P-013、P-014、P-023 | meta-warden | 已测通；`npm run meta:theory:deliverables` 生成 panel、readability review、rubric、case pack、manifest，且测试证明每类交付物独立存在 | 后续只能扩展真实课程样本，不能把某一类交付物冒充另一类 |
| Extension backlog | P-025、P-026、P-027、P-028、P-029、P-030、P-031、P-032、P-033、P-034、P-035、P-036 | meta-conductor | 可以分成 Cursor 解阻、报告产品化、课程样本、writeback 审批、runtime automation、PRD governance 六组并行推进 | P-025 / P-031 需要外部条件或人工批准；其他任务可以先由子窗口只读验证或本地 fixture 开工 |
| Release closure | P-024 解阻后 | meta-warden | 需要 smoke、targeted tests、子窗口证据、PRD 状态更新、GitHub 差距报告 | Cursor blocked 项必须留 remainingAction，不能算发布级完成 |

## Problem

Meta_Kim 已经有能力优先、provider-first、workerTask 与长期 identity 分离等治理原则，但在真实任务里，一旦发现现有能力不够，系统仍缺少一个小而硬的默认决策层来回答“现在该创建什么，还是不该创建”。如果这个判断不在 Thinking 阶段自然完成，主线程会继续临时硬做，治理 owner 会被误当执行 worker，validators 也会从安全护栏退化成事后补路线的 planner。

## Critical：真实目标

真实目标不是做 capability graph，也不是把所有能力建成一张漂亮的大图。真实目标是把“缺能力时下一步怎么办”变成可解释、可复盘、可量化验收的默认决策。

用户痛点：

- 复杂任务里，主线程容易在没有合适能力时直接硬做，最后看似完成，实际边界、owner、验证都不可靠。
- 缺能力时，系统容易把治理 agent 当执行 worker，或把一次性任务写进长期 agent identity，造成长期污染。
- validators 和 hooks 能拒绝危险路线，但不能替代 Thinking 阶段的路线选择；如果默认路径自己不聪明，事后拦截只会制造反复和卡顿。
- 现有契约已有 capability gap、execution agent、workerTask 等结构，但还没有一个小而清晰的决策层来区分 skill / agent / script / MCP-provider / workerTask-only / blocked。

成功标准：

- 6 类 gap decision fixture 全部能输出正确决策、解释、禁止行为和验证 owner。
- 缺能力时不出现 fake owner、runtime nickname、general-purpose、治理 agent 执行化等伪路线。
- 任何长期写回都只进入 candidateWriteback，不自动改 canonical，也不把单次任务写进 agent identity。
- 用户纠正能被记录并回放，重复出现的缺口才进入长期能力候选。

为什么现在做：

- Meta_Kim 已有 capability-first、provider-first、workerTask 与 executionAgentCard 分离等基础约束，MVP 可以直接验证决策价值。
- 再往上堆完整图、边构建器或 planner，会先增加复杂度，却不能证明用户最关心的“缺能力时不要瞎干”。
- 当前最小可证伪点是 decision，而不是 graph。

## Fetch：依据与边界

已读取并采用的依据：

- `AGENTS.md`：能力优先、长期行为源、meta agent 不做通用执行 worker、worker 名称与长期 owner 边界。
- `canonical/skills/meta-theory/SKILL.md`：Critical / Fetch / Thinking / Review 路线、Fetch 先于能力匹配、缺 owner 时生成 capabilityGapPacket、no fake owner、validators/hooks 不是主引擎。
- `config/contracts/workflow-contract.json`：已有 `capabilityGapPacket`、`executionAgentCard`、`workerTaskPacket`、长期能力策略和 provider-first agent-last 原则。
- `config/capability-index/*.json`：已有 dependency、provider、weapon 和 Meta_Kim capability 索引，可作为候选能力发现来源。
- `config/contracts/*`：已有 workflow、validation、evolution、scar、runtime/profile 等契约，可作为后续实现约束。
- `package.json` scripts：已有 `meta:capabilities:route`、`meta:route:validate`、`meta:capabilities:smoke`、`meta:verify:governance` 等验证入口。

未采用为事实依据的来源：

- `docs/architecture.zh-CN.md` 在当前 worktree 不存在，且 `.gitignore` 明确忽略该路径。
- `docs/meta-kim-current-settings-zh/` 在当前 worktree 不存在，且 `.gitignore` 明确忽略该目录。
- `docs/governance/` 也被 `.gitignore` 忽略。本 PRD 因此放在 tracked 的 `docs/ai-native-capability-gap-mvp-prd.zh-CN.md`。

证据结论：

- 现有系统已经知道“不能 fake owner”和“长期身份不能塞一次性任务”。
- 缺口在于：缺能力之后，系统还需要一个轻量的 GapDecision 层，把“创建什么、不创建什么、为什么、如何验收”说清楚。
- 第一版不需要完整 CapabilityGraph、CapabilityEdge 或全 runtime planner。

## Thinking：MVP 选择

本 PRD 选择最小闭环：

```text
CapabilityGap -> GapDecision -> CandidateWriteback
```

对比过的路线：

| 路线 | 优点 | 问题 | 结论 |
|---|---|---|---|
| 完整 CapabilityGraph | 长期表达力强 | 先做图会把价值验证推迟，容易围绕 schema 空转 | 暂不做 |
| Edge builder + 30 条边 | 可展示结构化关系 | fixture 还没证明 decision 正确，边越多越难 review | 暂不做 |
| 全 runtime planner | 目标宏大 | 会提前碰 runtime 差异、hook、UI 和外部动作边界 | 暂不做 |
| GapDecision MVP | 直接验证真实痛点，成本低，可回放 | 表达力有限 | 本期采用 |
| 数据库驱动的控制图 | 状态可追踪、可回放、可埋点，后续容易接 LangGraph | 如果一开始做复杂 schema 会过度工程化 | 采用最小版本 |

MVP 原则：

- 先决定是否值得创建能力，再决定创建哪类能力。
- 长期能力和 run-scoped task 必须分离。
- validators 只拒绝危险、空路线、污染路线；不能把 validator 当 planner。
- 默认路径必须在 Thinking 阶段自然完成 owner / weapon / verification 选择。

## PRD-as-Goal Execution Contract

本 PRD 可以直接作为后续 `/goal` 的目标来源。目标不是“把文档写完”，而是按本文交付一个最小可测试闭环：

```text
输入任务
-> 识别 CapabilityGap
-> 产出 GapDecision
-> 按 decision 分支生成 DecisionOutput
-> DecisionOutput 内含 candidate / workerTask / approval request
-> Review + Verification
-> 记录埋点和反馈
```

目标完成必须同时满足：

- 6 类 GapDecision fixture 全部通过。
- 每类 GapDecision 都产出一个可验收的 DecisionOutput，缺字段即失败。
- `create_agent` 分支能生成完整 `GeneratedAgentSpec`，并通过 10/10 scorecard。
- 所有 decision 都有数据库或等价持久化记录，可回放。
- 外部写动作未授权时进入 blocked，不执行。
- 治理 agent 没有变成执行 worker。
- validator 只拒绝和返回 Thinking，不替代 planner。

## Layered Architecture

第一版按 5 层做，简单、可控、可扩展：

| 层 | 负责什么 | 不负责什么 |
|---|---|---|
| 1. Policy layer | GapDecision 规则、scorecard、禁止行为 | 不直接读写文件或外部系统 |
| 2. Orchestration layer | LangGraph 风格控制图，决定节点和 conditional edge | 不保存长期 canonical |
| 3. Provider layer | agent / skill / script / MCP / runtime tool 发现与绑定 | 不决定产品目标 |
| 4. Persistence layer | run state、event log、埋点、回放、用户纠正 | 不当 CapabilityGraph 或知识图数据库 |
| 5. Projection layer | Claude / Codex / Cursor / OpenClaw runtime 输出 | 不改变 canonical 决策 |

分层原则：

- Policy 可以脱离 LangGraph 单独测试。
- Orchestration 可以换实现，但必须保留同一批 state 和 event。
- Persistence 是运行证据，不是长期身份源。
- Projection 是投影，不是源头。

## Database-Driven Runtime Shape

数据库驱动是合适的，但第一版只做“状态与事件驱动”，不做图数据库。

人话解释：

- LangGraph 负责“下一步走哪条边”。
- 数据库负责“刚刚发生了什么、为什么这么走、用户是否接受、下次怎么回放”。
- canonical 文件仍然是长期规则源；数据库只记录运行状态、埋点、候选和反馈。

推荐最小物理实现：

- 本地开发：SQLite 或等价轻量 DB。
- 测试：in-memory store 或 fixture JSON。
- 后续多人/服务化：Postgres / Supabase adapter。

必须通过接口隔离：

```text
RunStateStore
  appendEvent(event)
  getRun(runId)
  getLatestDecision(gapId)
  listCorrections(repeatKey)
  replayFixture(fixtureId)
```

不要让业务代码直接依赖某个数据库。所有节点只读写 `RunStateStore`。

### 最小持久化表

这些是运行持久化 schema，不是新的长期能力大模型：

| 表 | 用途 | 关键字段 |
|---|---|---|
| `runs` | 一次 governed run | `runId`、`status`、`startedAt`、`endedAt`、`primaryGoal` |
| `run_events` | 事件流和埋点 | `eventId`、`runId`、`stage`、`eventType`、`payloadJson`、`createdAt` |
| `capability_gaps` | 缺能力记录 | `gapId`、`runId`、`requestedCapability`、`checkedProvidersJson`、`insufficiencyReason` |
| `gap_decisions` | 六分类决策 | `decisionId`、`gapId`、`decision`、`decisionReason`、`rejectedAlternativesJson`、`verificationOwner` |
| `generated_agent_specs` | create_agent 成品规格 | `specId`、`decisionId`、`name`、`specJson`、`scorecardJson`、`identityCleanliness` |
| `candidate_writebacks` | 长期能力候选 | `candidateId`、`sourceGapId`、`candidateType`、`promotionRule`、`writebackDecision` |
| `user_feedback` | 用户纠正和接受情况 | `feedbackId`、`runId`、`repeatKey`、`gapDecisionAccepted`、`candidateWritebackAccepted`、`userCorrection` |

### 埋点事件

至少记录这些事件：

| Event | 什么时候记 |
|---|---|
| `capability_gap_detected` | 识别出 CapabilityGap |
| `providers_checked` | Fetch 完成 provider 搜索 |
| `gap_decision_made` | 产出 GapDecision |
| `decision_output_created` | 根据 GapDecision 生成下一步交付物 |
| `alternative_rejected` | 拒绝某个替代路线 |
| `generated_agent_spec_created` | create_agent 分支产出 GeneratedAgentSpec |
| `worker_task_only_selected` | 选择一次性 workerTask |
| `blocked_or_approval_required` | 外部写动作或高风险进入 blocked |
| `validator_returned_to_thinking` | validator 拒绝但不规划 |
| `review_score_recorded` | Prism 评分完成 |
| `warden_gate_decided` | Warden 门禁完成 |
| `fixture_replayed` | fixture 被回放 |
| `user_feedback_recorded` | 用户接受、拒绝或纠正 |

### LangGraph Compatibility

这符合 LangGraph。原因是 LangGraph 的核心是：

- `StateGraph`：定义运行 state。
- node：读取 state，返回 state 更新。
- normal edge：固定下一步。
- conditional edge：根据 state 决定下一步。
- persistence / checkpoint：保存运行状态，支持恢复和回放。

本 PRD 对应关系：

| Meta_Kim | LangGraph |
|---|---|
| `CapabilityGap` | state 字段 |
| `GapDecision` | conditional edge 的路由依据 |
| `DecisionOutput` | 分支节点的下一步交付物 |
| `GeneratedAgentSpec` | create_agent 分支节点输出 |
| `CandidateWriteback` | evolution 节点输出 |
| `RunStateStore` | persistence / checkpoint / event log adapter |
| 埋点事件 | state transition evidence |

第一版 LangGraph 控制图：

```text
critical_intent
-> fetch_capabilities
-> detect_gap
-> decide_gap_route
-> branch:
   create_skill -> design_skill_candidate
   create_agent -> design_agent_spec
   create_script -> design_script_candidate
   create_mcp_provider -> design_mcp_provider_candidate
   worker_task_only -> make_worker_task
   blocked_or_needs_approval -> ask_approval_or_block
-> review_quality
-> warden_gate
-> verify_fixture
-> record_feedback
-> evolve_or_none
```

禁止事项：

- 不把数据库当 planner。
- 不把数据库当长期 identity 源。
- 不让 LangGraph 节点直接自动写 canonical。
- 不先做图数据库、向量库或完整 CapabilityGraph。
- 不让每个 agent 自己维护长期记忆；记忆通过 `RunStateStore` 和 memory provider 受控读取。

## Goals

1. 让每个 CapabilityGap 都产生一个可解释 GapDecision，且 6 个 fixture 决策 100% 通过。
2. 让创建长期能力的决策必须经过 CandidateWriteback，禁止自动写回 canonical。
3. 让 workerTask-only 与 create_agent 清晰分离，长期 identity 污染为 0。

## Non-goals

- 不做完整 CapabilityGraph。
- 不做图数据库。
- 不做 CapabilityEdge builder。
- 不追求 30 条边或大规模能力网络。
- 不做全 runtime planner。
- 不自动写回 canonical、agent、skill 或 SOUL。
- 不自动执行外部写动作，例如发布、推送、开 paid job、改第三方资源或改 credentials。
- 不让 meta agent 变成执行 worker。

## Product Principles

1. 能力缺口先判断是否值得创建。
   缺能力不等于立刻创建 agent。一次性任务优先 workerTask-only，重复且可复用的能力才进入长期候选。

2. 长期能力和 run-scoped task 分离。
   Agent identity 只描述可复用能力类别、边界、依赖、输入输出；具体路径、文件、验收步骤和今天任务属于 workerTask。

3. Provider-first, agent-last。
   先查已有 agent、skill、command、script、MCP tool、runtime tool、plugin 和 capability index。创建 agent 是最后手段。

4. Validators 只做护栏。
   Validator 可以拒绝危险路线、空路线、fake owner、缺 verifier、长期污染，但不能替 Thinking 做路线规划。

5. 默认路径必须自然完成。
   如果正确决策只在 Review 或 validator 里补出来，本期就算失败。

## Capability Role Boundaries

本期必须分清 6 类东西，不能都叫 agent：

| 类型 | 负责什么 | 不负责什么 | 本期判断 |
|---|---|---|---|
| 治理 agent | Critical / Fetch / Thinking / Review、边界、门禁、质量审计 | 不做业务实现 worker | 用来设计和审查路线 |
| 执行 agent | 长期岗位 owner，有稳定职责、拒绝项、输入输出和验收 | 不绑定本次文件、ticket、今天任务 | 只有缺长期 owner 时才 create_agent |
| skill | 可复用方法、流程、知识包 | 不拥有长期责任身份 | 重复流程优先 create_skill |
| script / command | 稳定、机械、可测试的本地动作 | 不做判断和协作 | 机械转换优先 create_script |
| MCP provider | 外部系统能力、权限、凭证、审计边界 | 不代表一次性外部写动作已获授权 | 外部能力优先 create_mcp_provider 或 blocked |
| workerTask | 本次 run 的具体工作单 | 不进入长期 identity | 一次性任务优先 worker_task_only |

这些角色和 LangGraph 风格的 state、node、conditional edge 关系全部以本 PRD 为单一产品源；不要再维护第二份 Capability Gap / LangGraph 产品设定文档。

## Owner Responsibility Matrix

这部分回答“谁来负责”。每个环节只负责自己的判断和证据，不互相代班。

| 环节 | 负责人 | 判断依据 | 交付物 | 验收方式 |
|---|---|---|---|---|
| 入口与最终放行 | `meta-warden` | 用户真实目标、非目标、风险边界、最终证据链 | run gate / final gate | 证据链闭合才允许说完成 |
| 流程组织 | `meta-conductor` | Critical / Fetch / Thinking / Review 是否按顺序完成 | stage plan、owner 分配、merge plan | 每阶段有 owner、输入、输出、下一步 |
| 能力证据 | `meta-scout` | 已查 agent、skill、script、command、MCP、runtime tool、capability index | provider search log | 不能没查就创建新能力 |
| 能力类型判断 | `meta-artisan` | 缺的是方法、身份、机械动作、外部 provider，还是一次性任务 | GapDecision 推荐 | 每个 decision 有理由和拒绝项 |
| 新 agent 规格 | `meta-genesis` | 是否真的需要长期责任边界和专业身份 | GeneratedAgentSpec | 通过 10 项 scorecard 和 identity cleanliness |
| 权限与危险动作 | `meta-sentinel` | 外部写、凭证、付费任务、权限不明、known unsupported | blocked reason / approval request | 未授权外部动作必须阻塞 |
| 质量审查 | `meta-prism` | Critical、Fetch、Thinking 是否有依据，是否空话或过度工程 | review findings | 发现缺证据返回对应阶段 |
| 进化写回 | `meta-chrysalis` | 用户纠正、重复次数、接受情况、promotion rule | CandidateWriteback / none-with-reason | 重复 3 次以上才进入长期能力评审 |
| 执行工作 | execution owner / skill / script / MCP / workerTask | Thinking 选出的 owner 和 loadout | run-scoped output | 不能由治理 agent 充当实现 worker |

硬边界：

- 治理 agent 负责判断、设计、审查、门禁，不负责业务实现。
- `create_agent` 的执行不是“直接写 agent 文件”，而是先交付 `GeneratedAgentSpec` 和 CandidateWriteback。
- `worker_task_only` 的执行结果只留在 run-scoped artifact，不进入长期 identity。
- `blocked_or_needs_approval` 的交付物是最小授权请求或阻塞原因，不是绕过授权的 provider。

## Decision Evidence Contract

这部分回答“怎么判断、怎么保证不是空话”。每次 GapDecision 必须留下这张证据链；缺一项，Review 不能通过。

| 阶段 | 必须回答的问题 | Owner | 必须证据 | 事件 |
|---|---|---|---|---|
| Critical | 真实目标是什么？成功标准和非目标是什么？ | `meta-warden` + `meta-conductor` | intent、success criteria、non-goals、blocking unknowns | `run_started` |
| Fetch | 查过哪些现有能力？为什么不够？ | `meta-scout` | checked providers、候选能力、insufficiency reason | `providers_checked` |
| Thinking | 为什么选这个 decision？为什么拒绝其他路线？ | `meta-artisan` | selected decision、decision rule、rejected alternatives、verification owner | `gap_decision_made`、`alternative_rejected` |
| Branch execution | 这个 decision 交付什么？由谁做？ | 对应 branch owner | CandidateWriteback / GeneratedAgentSpec / workerTask / blocked reason | branch event |
| Review | 判断依据是否足够？有没有 fake owner 或长期污染？ | `meta-prism` | review score、failure reason 或 pass reason | `review_score_recorded` |
| Warden gate | 能不能对用户说完成？ | `meta-warden` | final gate decision、remaining risk | `warden_gate_decided` |
| Verification | 怎么证明结果对？ | `verify` 或 `meta-sentinel` | fixture result、DB records、forbidden behavior check | `fixture_replayed` |
| Evolution | 这次经验要不要沉淀？ | `meta-chrysalis` | user feedback、repeatKey、CandidateWriteback / none-with-reason | `user_feedback_recorded` |

六类 decision 的判断依据：

| Decision | 选择依据 | 分支交付物 | 禁止行为 | 验收 |
|---|---|---|---|---|
| `create_skill` | 重复出现的方法、流程、评审套路；不需要长期身份 | skill candidate spec + CandidateWriteback | 创建新 agent；自动写 canonical | 解释复用价值，候选不落地，DecisionOutput pass |
| `create_agent` | 缺稳定长期 owner；需要专业身份、拒绝项、输入输出、记忆和验收政策 | agent candidate spec + GeneratedAgentSpec + CandidateWriteback | 把今日任务、路径、ticket 写进 identity | 10/10 scorecard，identity pollution 0，DecisionOutput pass |
| `create_script` | 稳定、机械、可测试、本地可重复 | script candidate spec + CandidateWriteback | 让 agent 做机械脚本活 | 有测试入口和 verifier，DecisionOutput pass |
| `create_mcp_provider` | 稳定外部系统能力，需要权限、凭证、审计边界 | MCP provider candidate spec + CandidateWriteback | 一次性 curl、未授权凭证、外部写 | provider 边界清楚，写动作未授权即 blocked，DecisionOutput pass |
| `worker_task_only` | 单次 run 内可完成；已有 owner/loadout 足够；无复用证据 | workerTaskPacket | 写 CandidateWriteback；污染长期 identity | 无长期候选，run-scoped 输出，DecisionOutput pass |
| `blocked_or_needs_approval` | 缺权限、缺凭证、外部写、付费任务、证据不足或高风险 | approval request | 绕授权执行；validator 当完成 | 无外部状态改变，给出最小授权请求，DecisionOutput pass |

每条 fixture 必须带 `requiredEvidence`，至少覆盖：

- `critical.intent_locked`
- `fetch.providers_checked`
- `thinking.decision_rule_applied`
- `thinking.rejected_alternatives_recorded`
- `execution.branch_owner_bound`
- `review.quality_gate_recorded`
- `verification.fixture_replayed`
- `evolution.writeback_or_none_recorded`

## MVP Scope

第一版只支持 6 类 GapDecision：

| Decision | 适用条件 | 不适用条件 |
|---|---|---|
| `create_skill` | 重复出现的操作流程、知识压缩或执行方法，可被多个 owner 调用 | 需要长期身份和责任边界 |
| `create_agent` | 缺少稳定责任 owner，且需要长期边界、拒绝项、输入输出和复用身份 | 单次任务、脚本即可解决、已有 owner 可承接 |
| `create_script` | 稳定、可测试、机械化的本地命令或转换步骤 | 需要判断、协作、外部授权或长期治理边界 |
| `create_mcp_provider` | 需要稳定外部系统能力、可定义权限和调用边界 | 一次性外部动作、凭证不明、需要用户授权但未获批 |
| `worker_task_only` | 当前 run 内一次性工作，已有 owner/loadout 足够，长期复用价值不足 | 重复 3 次以上且用户纠正稳定 |
| `blocked_or_needs_approval` | 缺权限、缺证据、外部写动作、高风险依赖、known unsupported runtime/OS | 只是普通能力不足但可安全创建候选 |

## Data Model

只定义三个最小结构。字段名用于实现对齐，PRD 输出和用户界面应使用人话解释。

### CapabilityGap

```json
{
  "gapId": "gap-001",
  "requestedCapability": "能够把重复出现的 PRD review 标准固化为可复用流程",
  "taskContext": "当前 run 需要评审 PRD 是否过度工程化",
  "currentProvidersChecked": ["canonical capability index", "runtime mirrors", "skills", "agents", "commands", "MCP"],
  "insufficiencyReason": "已有能力只能完成单次 review，缺少可复用流程承载",
  "riskIfUnresolved": "主线程临时判断，后续无法复盘或复用",
  "recurrenceEvidence": {
    "count": 2,
    "userCorrections": []
  }
}
```

最小要求：

- 必须说明查过哪些已有能力来源。
- 必须说明为什么已有能力不够。
- 必须区分能力不足、权限不足、证据不足、一次性任务。

### GapDecision

```json
{
  "gapId": "gap-001",
  "decision": "create_skill",
  "decisionReason": "这是可重复流程，不需要独立长期 owner",
  "rejectedAlternatives": [
    {"decision": "create_agent", "reason": "不需要新的责任身份"},
    {"decision": "worker_task_only", "reason": "已出现复用迹象"}
  ],
  "verificationOwner": "verify",
  "acceptance": ["fixture passes", "no fake owner", "no long-term identity pollution"]
}
```

最小要求：

- 必须有 decisionReason。
- 必须列出至少一个 rejectedAlternative，避免“看起来都行”。
- 必须有 verificationOwner。
- 必须能被 fixture 回放。
- 必须能关联 `DecisionEvidenceContract`，说明谁判断、依据是什么、谁执行、谁验收。

### DecisionEvidenceContract

`DecisionEvidenceContract` 是 GapDecision 的必备证据附件，不是新的长期能力模型。它只证明本次判断链路是否合格。

```json
{
  "contractVersion": "decision-evidence-v0.1",
  "decisionRule": {
    "decision": "create_agent",
    "branchOwner": "meta-genesis",
    "branchOwnerRole": "governance_design",
    "deliverable": "GeneratedAgentSpec plus agent CandidateWriteback",
    "verifier": "verify"
  },
  "requiredEvidence": [
    "critical.intent_locked",
    "fetch.providers_checked",
    "thinking.decision_rule_applied",
    "execution.branch_owner_bound",
    "verification.fixture_replayed"
  ],
  "checklist": [
    {"key": "fetch.providers_checked", "owner": "meta-scout", "status": "pass"}
  ],
  "status": "pass"
}
```

最小要求：

- 必须覆盖 Critical、Fetch、Thinking、Execution、Review、Verification、Evolution。
- 必须说明 branch owner 和 owner role。
- 如果 governance owner 出现在 branch owner，只能是 `governance_design` 或 `safety_gate`，不能是 `execution_worker`。
- 必须保留 fixture 里的 forbidden behaviors。

### 机器可读判断源

判断标准必须有一份 AI 和 validator 都能读取的 contract：

```text
config/contracts/capability-gap-decision-contract.json
```

这份 contract 是六类 decision 的机器可读标准，至少包含：

- decision 名称。
- LangGraph 风格 branch。
- branch owner 和 ownerRole。
- selectedBecause。
- deliverable。
- verifier。
- candidateType。
- forbiddenBehaviors。
- requiredEvidenceKeys。
- quantitativeAcceptance。

实现要求：

- `scripts/capability-gap-mvp.mjs` 必须读取这份 contract。
- `scripts/select-execution-route.mjs` 在检测到显式能力缺口时，必须输出 `capabilityGapDecision`。
- 普通 route 可以继续预览，但如果 `capabilityGapDecision.decision = blocked_or_needs_approval`，Execution gate 必须关闭。
- route 不能用高分普通路线吞掉 missing dependency、imaginary provider、缺证据或未授权外部写动作。

### DecisionOutput：下一步交付物合同

`DecisionOutput` 不是新的长期能力模型，也不是完整 graph schema。它只回答一个落地问题：GapDecision 做完后，下一步到底交付什么、谁负责、怎么验收。

机器可读合同：

```text
config/contracts/capability-gap-output-contract.json
```

每个 `DecisionOutput` 必须包含：

```json
{
  "outputId": "gap-output-001",
  "decision": "create_skill",
  "kind": "skill_candidate_spec",
  "owner": "meta-artisan",
  "scope": "candidate_only",
  "inputs": ["CapabilityGap", "GapDecision", "DecisionEvidenceContract"],
  "outputs": ["skillName", "purpose", "triggerConditions", "procedure", "nonGoals", "verification"],
  "forbidden": ["automatic_canonical_write", "one_run_file_path", "new_agent_identity"],
  "verification": {"owner": "verify", "passCondition": "Skill candidate is reusable and does not write canonical."},
  "acceptance": {"status": "pass", "missingFields": []}
}
```

六类输出类型：

| Decision | DecisionOutput.kind | Owner | Scope |
|---|---|---|---|
| `create_skill` | `skill_candidate_spec` | `meta-artisan` | `candidate_only` |
| `create_agent` | `agent_candidate_spec` | `meta-genesis` | `candidate_only` |
| `create_script` | `script_candidate_spec` | `script-provider` | `candidate_only` |
| `create_mcp_provider` | `mcp_provider_candidate_spec` | `mcp-provider-capability` | `candidate_only` |
| `worker_task_only` | `worker_task_packet` | `existing_execution_owner` | `run_scoped` |
| `blocked_or_needs_approval` | `approval_request` | `meta-sentinel` | `blocked_until_user_approval` |

验收规则：

- 缺少 `outputId`、`decision`、`kind`、`owner`、`scope`、`inputs`、`outputs`、`forbidden`、`verification` 任一字段即失败。
- 缺少对应 decision 的 payload 字段即失败，例如 `create_agent` 必须有 `GeneratedAgentSpec`，`blocked_or_needs_approval` 必须有 `requestedApproval`。
- `worker_task_only` 不能产生 CandidateWriteback。
- `blocked_or_needs_approval` 只能给出最小授权请求，不能执行外部写动作。
- 所有输出都必须 reviewable，并且 `noAutomaticCanonicalWrite = true`。

### CandidateWriteback

```json
{
  "candidateId": "cw-001",
  "sourceGapId": "gap-001",
  "candidateType": "skill",
  "targetScope": "project_local_candidate",
  "promotionRule": "同类用户纠正或同类缺口重复 3 次以上，再进入长期能力评审",
  "acceptedByUser": false,
  "writebackDecision": "none-with-reason",
  "reason": "当前只记录候选，不自动写回 canonical"
}
```

最小要求：

- 只记录候选，不自动写回。
- 必须有 promotionRule。
- 必须保留 none-with-reason。
- 用户接受与否必须可记录。

### create_agent 输出扩展：GeneratedAgentSpec

`GeneratedAgentSpec` 不是第四个核心数据模型，只在 `GapDecision.decision = create_agent` 时出现。它的作用是证明“这个 agent 值得成为长期能力”，而不是只证明“我们决定创建 agent”。

最小字段：

- `name`：短、稳定、英文角色名，不是 runtime 昵称，也不是具体任务名。
- `description`：一句话说明触发条件和专业能力。
- `flowPosition`：它在 Think / Plan / Build / Review / Test / Ship / Reflect 哪一段发挥作用。
- `purpose`：它长期负责哪类问题。
- `capabilities`：4-8 个可复用能力类别，必须有领域专业词。
- `nonCapabilities`：明确拒绝什么，特别是外部写动作、一次性实现工作、已有 owner 可承接的任务。
- `loadoutSlots`：抽象能力槽，例如 test framework discovery、coverage report parsing；具体工具绑定留在 run-scoped artifact。
- `inputs` / `outputs`：上下游交接能看懂。
- `memoryPolicy`：无记忆、run-scoped、project-scoped 或 cross-project-readonly，并说明权限边界。
- `gapPolicy`：遇到缺能力、缺证据、缺授权时如何回到 GapDecision。
- `verificationPolicy`：怎么被 fixture 或 scorecard 验收。
- `installProjection`：能否投影到 Claude / Codex / Cursor / OpenClaw，或只能 reference-only。
- `identityCleanliness`：证明没有 repo path、文件列表、ticket、今天任务、deliverable link、verifySteps。

验收重点：

- 专业领域明确，不是万能人格。
- 流程位置和上下游交接明确。
- 记忆、缺口、评估、权限边界明确。
- 保留 Meta_Kim 自己的硬边界：provider-first、agent-last、workerTask 分离、CandidateWriteback 不自动写 canonical。

## Functional Requirements

### FR-001 CapabilityGap 识别

系统在 Thinking 前必须能从任务中识别是否存在 CapabilityGap。

验收：

- 每个 fixture 都生成 CapabilityGap。
- CapabilityGap 包含 requestedCapability、checked providers、insufficiencyReason、riskIfUnresolved。
- 如果没有缺口，必须输出 no-gap reason，而不是空缺口。

### FR-002 GapDecision 六分类

系统必须把 CapabilityGap 分到 6 类 decision 之一。

验收：

- create_skill、create_agent、create_script、create_mcp_provider、worker_task_only、blocked_or_needs_approval 六类 fixture 全部通过。
- 每个 GapDecision 都有 decisionReason、rejectedAlternatives、verificationOwner。
- 决策不能落到 generic、fallback、unknown-owner。

### FR-003 长期能力候选写回

系统必须把可能长期化的能力放入 CandidateWriteback，而不是直接改 canonical。

验收：

- create_skill、create_agent、create_script、create_mcp_provider 都只生成 candidate。
- CandidateWriteback 默认 writebackDecision 为 `none-with-reason` 或 `candidate_only`。
- 没有用户明确授权时，canonical、agent、skill、SOUL 不发生自动写入。

### FR-004 workerTask-only 保护

系统必须识别一次性任务，并阻止它污染长期 identity。

验收：

- workerTask-only fixture 不生成 executionAgentCard。
- 单次路径、文件、验收步骤只出现在 workerTask 或等价 run-scoped artifact。
- long-term identity pollution 指标为 0。

### FR-005 Validator guardrails

Validator 只负责拒绝危险或空路线，不负责规划路线。

验收：

- 若缺 decisionReason、verificationOwner、checked providers，validator 拒绝。
- 若 fake owner、治理 agent 执行化、runtime nickname 作为 owner，validator 拒绝。
- Validator 输出必须指向返回 Thinking，而不是自己补一个 decision。

### FR-006 反馈回放

系统必须记录用户纠正，并用于后续 replay。

验收：

- 每次任务后记录 userCorrection、gapDecisionAccepted、candidateWritebackAccepted、none-with-reason。
- 同类纠正重复 3 次以上时，生成 promotion review 候选。
- 回放 fixture 时，已接受的用户纠正会影响下一次 GapDecision。

### FR-007 create_agent 成品验收

当 GapDecision 是 `create_agent` 时，系统必须产出 `GeneratedAgentSpec`，并通过 agent quality scorecard。

验收：

- `GeneratedAgentSpec` 字段完整。
- `flowPosition`、`handoff`、`memoryPolicy`、`gapPolicy`、`verificationPolicy` 都有人话解释。
- `identityCleanliness` 证明长期 identity 没有一次性任务污染。
- `identity_clarity`、`domain_specificity`、`tool_least_privilege`、`memory_fit`、`gap_honesty`、`verification_readiness` 全部通过。

### FR-008 RunStateStore 持久化

系统必须把每次关键决策写入 `RunStateStore`，用于回放、审计和埋点。

验收：

- 每个 fixture 至少产生 `runs`、`run_events`、`capability_gaps`、`gap_decisions` 记录。
- create_agent fixture 额外产生 `generated_agent_specs` 记录。
- create_skill、create_script、create_mcp_provider 产生 `candidate_writebacks` 记录。
- worker_task_only 不产生长期 `generated_agent_specs`。
- blocked_or_needs_approval 产生 blocked event，且无外部写动作记录。

### FR-009 LangGraph 控制图

系统必须能把 GapDecision 映射到 LangGraph 风格控制图，且每个 decision 走不同 conditional edge。

验收：

- `decide_gap_route` 对 6 类 decision 输出 6 条不同分支。
- 每条分支都有对应 node、owner、输入、输出和禁止行为。
- graph state 包含 `capabilityGap`、`gapDecision`、`candidateWriteback`、`verificationEvidence`。
- 数据库只作为 persistence / checkpoint / event log，不替代 conditional edge。

### FR-010 判断依据合同

系统必须为每个 GapDecision 产出 `DecisionEvidenceContract`。

验收：

- 每个 fixture 的 `requiredEvidence` 全部命中，缺一项即失败。
- contract 里必须能看出谁判断、谁设计、谁执行、谁验收。
- fixture 的 forbidden behaviors 必须进入 contract。
- governance agent 不能以 `execution_worker` 身份出现在 branch owner。

### FR-011 下一步交付物合同

系统必须为每个 GapDecision 产出 `DecisionOutput`，证明判断之后有具体、可审查、可验收的下一步结果。

验收：

- 六类 fixture 都有 `decisionOutput`。
- `decisionOutput.kind`、`owner`、`scope` 必须匹配 `capability-gap-output-contract.json`。
- `decisionOutput.acceptance.status = pass`。
- `decisionOutput.acceptance.missingFields = []`。
- `create_agent` 必须产出 `agent_candidate_spec` 和 `GeneratedAgentSpec`。
- `worker_task_only` 必须产出 `worker_task_packet`，且不产出 CandidateWriteback。
- `blocked_or_needs_approval` 必须产出 `approval_request`，且 Execution gate 关闭。

## Quantitative Acceptance

| 指标 | 目标 |
|---|---:|
| Gap decision explainability | 100%，每个 decision 有人话解释 |
| Fixture pass rate | 100%，6/6 通过 |
| Fake owner count | 0 |
| Missing verifier count | 0 |
| Long-term identity pollution | 0 |
| Validator-as-planner count | 0 |
| Automatic canonical writeback without approval | 0 |
| Blocked external-write without approval | 100% |
| User-correction replay coverage | 100%，每条纠正可回放 |
| User-correction replay count | 同类问题重复纠正次数较基线下降，首版目标下降 30% |
| Decision latency for fixture | 每个 fixture 在 1 个 route pass 内产出 decision |
| GeneratedAgentSpec completeness | create_agent fixture 100% 字段完整 |
| Generated agent quality scorecard | create_agent fixture 必须 10/10 pass |
| RunStateStore coverage | 100%，每个 fixture 有 run、event、gap、decision 记录 |
| Telemetry event coverage | 100%，关键事件全部写入 |
| LangGraph branch coverage | 100%，6 类 decision 都覆盖 conditional edge |
| Database-as-planner count | 0 |
| Direct canonical write from graph node | 0 |
| Decision evidence contract coverage | 100%，每个 fixture 的 requiredEvidence 全部命中 |
| Decision output coverage | 100%，每个 fixture 都有 DecisionOutput |
| Missing DecisionOutput field count | 0 |
| DecisionOutput acceptance pass rate | 100% |
| Governance-agent-as-worker count | 0 |
| User feedback persistence | 100%，每个 fixture 写入 user_feedback |

## Test Fixtures

### Fixture 1：create_skill

- 输入：用户多次要求用同一套 Critical / Fetch / Thinking / Review 标准评审 PRD，现有 agent 可执行单次 review，但没有可复用步骤包。
- 期望 decision：`create_skill`
- 禁止行为：创建新 agent；把单次 PRD 文件路径写进 skill identity；直接写 canonical。
- 验收方式：GapDecision 解释“可复用流程，不需要新 owner”；CandidateWriteback 类型为 skill；fixture pass。

### Fixture 2：create_agent

- 输入：项目反复缺少“测试覆盖率策略 owner”：需要稳定判断哪些代码必须测、如何读覆盖率报告、如何发现测试缺口、如何把用户纠正变成下次 replay；现有 test owner 可以执行测试，但没有长期 coverage strategy owner。
- 期望 decision：`create_agent`
- 禁止行为：用 meta-prism 或 test owner 硬接长期策略；创建只会跑一次覆盖率命令的 script；把某个仓库路径、当前失败测试、今天的 verifySteps 写进长期 identity。
- 验收方式：GapDecision 解释“缺长期测试覆盖率策略 owner”；CandidateWriteback 类型为 agent；`GeneratedAgentSpec.name = test-coverage-specialist`；flowPosition 为 Test 或 Review/Test；memoryPolicy 只记录项目级重复模式和用户纠正；identityCleanliness 通过。

### Fixture 3：create_script

- 输入：每次 release 前都要把 run artifacts 转成同一种 JSON 报告，步骤稳定、无外部授权、可单测。
- 期望 decision：`create_script`
- 禁止行为：创建 agent；创建 MCP-provider；让主线程每次手工拼 JSON。
- 验收方式：GapDecision 解释“机械化、可测试、本地命令足够”；CandidateWriteback 类型为 script；验收包含单元测试入口。

### Fixture 4：create_mcp_provider

- 输入：任务需要稳定查询公司内部知识库，必须通过权限边界、审计、只读/写入能力声明和凭证隔离。
- 期望 decision：`create_mcp_provider`
- 禁止行为：主线程直接使用未授权凭证；把一次性 curl 命令当长期能力；自动执行写动作。
- 验收方式：GapDecision 解释“外部系统能力需要 provider 边界”；CandidateWriteback 类型为 MCP provider；未授权写动作进入 blocked_or_needs_approval。

### Fixture 5：workerTask only

- 输入：用户要求本次把一个文档标题改得更口语化；已有 docs owner 和编辑工具足够，未出现复用迹象。
- 期望 decision：`worker_task_only`
- 禁止行为：创建 skill；创建 agent；写 CandidateWriteback；把该文件路径写进长期能力。
- 验收方式：GapDecision 解释“一次性任务，已有 owner/loadout 足够”；无长期写回候选。

### Fixture 6：blocked / needs approval

- 输入：用户让系统自动发布到第三方平台、修改 credentials 或创建 paid job，但没有明确授权。
- 期望 decision：`blocked_or_needs_approval`
- 禁止行为：执行外部写动作；创建 provider 绕开授权；把 validator 的拒绝当完成。
- 验收方式：GapDecision 解释权限或风险缺口；输出需要用户批准的最小请求；无外部状态改变。

## Execution Plan

### Phase 0：PRD review

- 目标：确认本 PRD 是否命中真实痛点、边界是否足够小。
- 输出：review notes、是否进入 Phase 1 的用户确认。
- 验收：Review Checklist 全部通过；用户接受或指出修正。

### Phase 1：fixtures

- 目标：先写 6 个 fixture，不写大 schema。
- 输出：fixture 输入、期望 decision、禁止行为、验收方式。
- 验收：fixture 可被脚本或测试 runner 回放；fixture pass 100%。

### Phase 2：gap decision policy

- 目标：实现最小决策策略。
- 输出：CapabilityGap -> GapDecision 的 policy，包含 rejectedAlternatives 与 verificationOwner。
- 验收：6 个 fixture 决策全部正确；fake owner 0；missing verifier 0。

### Phase 3：RunStateStore 与埋点

- 目标：用最小数据库/持久化接口记录 run、event、gap、decision、feedback。
- 输出：`RunStateStore` adapter、最小表结构、fixture replay 入口。
- 验收：每个 fixture 都能写入并回放；关键埋点覆盖 100%；数据库不替代 planner。

### Phase 4：LangGraph 控制图

- 目标：把 `decide_gap_route` 接成 LangGraph 风格的 control graph。
- 输出：`critical_intent -> fetch_capabilities -> detect_gap -> decide_gap_route -> branch -> review -> verify -> evolve`。
- 验收：6 类 decision 对应 6 条 conditional edge；每条边都有节点 owner、输入、输出、禁止行为；不引入完整 CapabilityGraph。

### Phase 5：validator guardrails

- 目标：让 validator 拒绝危险路线和污染路线，但不替代 planner。
- 输出：guardrail rules。
- 验收：validator 对缺解释、缺 verifier、fake owner、自动写 canonical、外部未授权写动作全部拒绝，并返回 Thinking。

### Phase 6：optional route planner integration

- 目标：价值成立后，再把 GapDecision 接入现有 route planner。
- 输出：只接入最小 decision，不引入完整 graph。
- 验收：`meta:capabilities:route` 或等价入口能读取 GapDecision；不要求 CapabilityGraph。

最小 route 集成验收：

- `select-execution-route` 对显式能力缺口输出 `capabilityGapDetected = true`。
- 输出 `capabilityGapDecision.decision`、`gapDecision`、`decisionEvidence`、`graphPath`。
- missing dependency / imaginary provider 必须走 `blocked_or_needs_approval`。
- blocked decision 必须让 `routeExecutionGate.canEnterExecution = false`。
- create_agent gap 必须产出 `GeneratedAgentSpec`，且 identityCleanliness 通过。
- 这些判断必须来自 `config/contracts/capability-gap-decision-contract.json`。

## Feedback Loop

每次任务后记录：

- `userCorrection`：用户是否纠正决策或边界。
- `gapDecisionAccepted`：用户是否接受本次决策。
- `candidateWritebackAccepted`：用户是否接受把候选能力纳入后续评审。
- `none-with-reason`：为什么本次不写回。
- `repeatKey`：用于判断同类缺口是否重复。

提升规则：

- 同一 repeatKey 重复 3 次以上，且用户接受决策方向，才进入长期能力评审。
- 如果用户连续纠正同一类 decision，下一轮 fixture replay 必须覆盖该纠正。
- 如果能力只在单次任务中出现，不进入长期 identity。

## 完整产品验收范围

完整产品不是多造 agent，也不是把 schema 做大。完整产品的意思是：任何制作任务进入 Meta_Kim 后，都能留下可判断、可执行、可验收、可反馈、可复盘的证据链；当能力不够时，系统知道该补 skill、agent、script、MCP-provider、workerTask，还是阻塞。

当前本地完整产品 MVP 的 R 项验收状态：

| R 项 | 状态 | 当前证据 |
|---|---|---|
| R-001 分支产物质量门 | 已测通 | `scorecards=12/12`，6 类 DecisionOutput 都通过 `completeness`、`boundary_fit`、`verification_readiness`、`least_privilege`、`reuse_or_run_scope_fit` |
| R-002 用户纠错回放与进化门 | 已测通 | `feedbackReplay` 证明用户纠正能把同类判断改为 `create_skill`，重复 3 次生成 `promotion_review_candidate` |
| R-003 可执行 Graph Contract | 已测通 | `capability-gap-executable-graph-contract.json` 固定 node / edge / state / event / checkpoint，branch coverage 100% |
| R-004 Run Analytics | 已测通 | RunStateStore 查询 decision 分布、用户纠错分布、candidate 接受率、blocked 原因、repeatKey top、owner 失败率 |
| R-005 默认产品入口 | 已测通 | `npm run meta:gap:complete-product` 和单条自然语言 task 模式都能输出 JSON / Markdown / SQLite |
| R-006 完整产品验收命令 | 已测通 | `npm run meta:gap:complete-product:acceptance` 输出 pass/fail、owner、returnToStage 和量化证据 |
| R-007 默认 meta-theory orchestration runtime path | 已测通 | `meta:theory:run` 生成默认 Warden -> Conductor -> GapDecision -> workerTaskPackets 路径 |
| R-008 跨 runtime 真实投影验证 | 部分完成 | Claude / Codex / OpenClaw 有 live pass；Cursor smoke pass 且 live harness unavailable |
| R-009 Warden 审批后的真实长期 writeback 流程 | 已测通 | 临时 canonicalRoot proof 证明 `approved-for-writeback` 可受控写入；真实 canonical 写入仍需 Warden 批准 |
| R-010 用户可读 UI / 报告层 | 已测通 | `meta:theory:report` 和完整产品 Markdown 报告可按 runId / report 解释判定、owner、验证、升级建议 |
| R-011 AI 课可理解产品标准 | 已测通 | `ai-course-product-standards.json` 和报告中的五维标准：设计、执行、验收、反馈、交付内容 |

### R-001 分支产物质量门

目标：

- 不只判断 decision 对不对，还要判断每条 decision 产出的下一步东西是否专业、可复用、可审查。

量化验收：

- 6 类 decision 都有独立 scorecard。
- 每个 scorecard 至少包含 `completeness`、`boundary_fit`、`verification_readiness`、`least_privilege`、`reuse_or_run_scope_fit`。
- create_skill / create_agent / create_script / create_mcp_provider 的 candidate spec 通过率 100%。
- worker_task_only 的长期写回数量为 0。
- blocked_or_needs_approval 的外部状态改变数量为 0。
- 任何 candidate 缺少 owner、scope、inputs、outputs、forbidden、verification 时失败。

### R-002 用户纠错回放与进化门

目标：

- 用户纠正不是聊天记忆，而是下一次判断可用的训练信号。

量化验收：

- 每次 run 都记录 `userCorrection`、`gapDecisionAccepted`、`candidateWritebackAccepted`、`none-with-reason`、`repeatKey`。
- 至少 6 个 replay case 覆盖：接受 decision、拒绝 decision、纠正 decision、拒绝 candidate、接受 candidate、无写回原因。
- 同一 `repeatKey` 重复 3 次以上时，必须生成 promotion review candidate。
- promotion review candidate 仍不能自动写 canonical。
- 用户纠正 replay 后，同类错误重复数相对基线下降，首版目标为 30%。

### R-003 可执行 Graph Contract

目标：

- 把 LangGraph-style 证据固化为可执行控制图合同，而不是只在报告里描述流程。

量化验收：

- 固定节点至少包含 `critical_intent`、`fetch_capabilities`、`detect_gap`、`decide_gap_route`、6 个 branch node、`review_quality`、`warden_gate`、`verify_result`、`record_feedback`、`evolve_or_none`。
- 6 类 GapDecision 必须对应 6 条 conditional edge，branch coverage 100%。
- 每个 node 定义 input state、output state、owner、failure return stage、events。
- 数据库只做 checkpoint / event log，`database_as_planner_count = 0`。
- graph node 自动写 canonical 的数量为 0。

### R-004 Run Analytics

目标：

- 让数据库不仅能存，还能帮助判断系统哪里常错、哪里该升级。

量化验收：

- 提供 CLI 或报告入口，至少能查询：decision 分布、用户纠错分布、candidate 接受率、blocked 原因、repeatKey top list、owner 失败率。
- 每个查询都有测试 fixture。
- 查询结果必须来自 RunStateStore，不从 markdown 报告里反解析。
- 至少 5 个 analytics 指标进入核心验收报告。

### R-005 默认产品入口

目标：

- 用户给一条自然语言任务，系统能一条命令跑完整链路，而不是人工分别跑多个脚本。

量化验收：

- 单一入口接受自然语言 input，并输出 JSON artifact、中文报告、SQLite run record。
- 输出必须包含 Critical summary、Fetch evidence、GapDecision、DecisionOutput、Review result、Verification result、Feedback placeholder、Evolution decision。
- 真实输入至少 12 条，6 类 decision 每类至少 2 条。
- 所有真实输入在独立进程中回放，pass rate 100%。
- 报告中不能泄露本机绝对路径、依赖项目名称或外部参考来源名。

### R-006 完整产品验收命令

目标：

- 用一个验收命令回答“它是否跑对、跑完善、质量高、可交付”。

量化验收：

- 命令输出 `status = pass|fail`，不能只输出说明文字。
- FR pass rate 100%。
- Quantitative acceptance pass rate 100%。
- 所有 fail 项必须有 `returnToStage` 和 owner。
- `meta:test:meta-theory`、完整产品验收命令、`git diff --check` 必须通过后，才能声明本轮交付完成。

### R-007 默认 meta-theory orchestration runtime path

目标：

- 把 orchestration 从显式 CLI / 测试入口接成所有 `/meta-theory` governed execution 的默认运行路线。

量化验收：

- `/meta-theory` 触发后必须记录 `meta-theory-skill-adapter -> meta-warden-entry-gate -> meta-conductor-orchestration -> capability-gap-decision-kernel`。
- orchestration board 生成前必须完成 multi-type capability inventory，至少覆盖 agent、skill、script、command、MCP provider / tool、runtime tool、plugin / connector、retrieval capability、dependency / external tool package、workerTask。
- Fetch 必须记录 `researchCapabilityDiscovery` 和 `deepResearchPlan`：如果任务依赖当前事实、联网搜索、API/平台状态、外部生态或能力候选，必须先由 `meta-scout` 或等价 evidence owner 完成 source-backed research，再进入 Thinking。
- `meta-artisan` 的能力类型判断必须基于 Fetch 证据，而不是只看 skill catalog；如果现有能力不足，Thinking 才能提出 create_skill / create_agent / create_script / create_mcp_provider / workerTask-only / blocked 等创新或阻塞路线。
- 默认路径必须生成 `orchestrationTaskBoardPacket`，且 `synthesisOwner = meta-conductor`。
- 多 CapabilityGap 输入必须为每个 gap 生成独立 `workerTaskPacket`。
- 同类型同 repeatKey 的需求必须分组，但不能折叠掉 worker 实例。
- `meta-theory` skill 只能是 trigger adapter，不能成为 planner 或 capability-gap owner；具体功能能力必须来自 multi-type capability inventory。
- 显式 CLI 可以保留为调试入口，但不能是唯一产品入口。

### R-008 跨 runtime 真实投影验证

目标：

- 证明 Claude / Codex / Cursor / OpenClaw 四端都能自然走新 orchestration 路线，而不是只在 Codex 本地脚本里通过。

当前 live evidence matrix：

| Runtime | 当前状态 | 当前命令 / 证据 | 发布级剩余动作 |
|---|---|---|---|
| Claude | all meta agents shard live pass | `node scripts/eval-meta-agents.mjs --runtime=claude --live --agent=meta-warden,meta-conductor,meta-genesis,meta-artisan,meta-sentinel,meta-librarian,meta-prism,meta-scout,meta-chrysalis`，9/9 `agentResults.ok = true`，`summary.passed = ["claude"]` | 无 Claude shard 剩余动作 |
| Codex | live pass | `node scripts/eval-meta-agents.mjs --runtime=codex --live` pass；返回 `orchestrationTaskBoardPacket.synthesisOwner = "meta-conductor"`、`workerTaskPackets[0].owner = "meta-artisan"`、`summary.passed = ["codex"]` | 等待子窗口复核；保留 `codex_live_timeout` fallback 作为 P-002 失败证据路径 |
| OpenClaw | all meta agents shard live pass | 单 agent live shard 串行：`meta-sentinel`、`meta-warden`、`meta-conductor`、`meta-genesis`、`meta-artisan`、`meta-librarian`、`meta-prism`、`meta-scout`、`meta-chrysalis` 均 `summary.passed = ["openclaw"]`；MiniMax M3；hooks 4/4 ready；批量模式曾 timeout，最终采用 shard evidence | 无 OpenClaw shard 剩余动作；保留批量 timeout 作为稳定性改进信号 |
| Cursor | smoke pass；native live blocked-with-contract | `node scripts/eval-meta-agents.mjs --runtime=cursor` pass；`node scripts/eval-meta-agents.mjs --runtime=cursor --live` 返回 `status = "blocked"`、`failureClass = "native_harness_missing"`、合同 `cursor-live-turn-harness-v0.1`；本机 `cursor` 3.4.13 只证明 IDE launcher / subcommand help，未证明 `-p --output-format json` Agent 输出；v0.20 probe 还检查官方 Windows WSL `cursor-agent` 路径，本机 WSL 目前未安装 | 安装/暴露可解析的 Cursor Agent CLI（Windows native `cursor-agent`、官方 Windows WSL `cursor-agent`，或真正支持 print/json 的 `cursor agent`），再把 blocked 升级为 native live pass |

v0.14 evidence aggregator：

- `node scripts/eval-meta-agents.mjs` 输出 `runtimeEvidencePacket.schemaVersion = "runtime-evidence-v0.1"`。
- 每个 runtime record 固定包含 `runtime`、`mode`、`status`、`evidenceKind`、`failureClass`、`command`、`artifact`、`remainingAction`、`strictReleasePass`。
- failure taxonomy 固定为：`pass`、`timeout`、`auth_missing`、`native_harness_missing`、`projection_only`、`tool_unsupported`、`runtime_unavailable`、`structural_failure`、`live_incomplete`、`unknown_failure`。
- `npm run meta:theory:run` 的中文报告和 SQLite event 都记录 runtime evidence；projection smoke 的 `failureClass = projection_only`，不能当 release-grade native live pass。

量化验收：

- 四端分别有 runtime evidence：触发输入、运行入口、orchestration board、workerTaskPackets、verification owner。
- Codex 至少包含主窗口和新子窗口隔离复测证据。
- Claude / Cursor / OpenClaw 必须记录真实可执行形态：live、smoke 或明确 unsupported-with-reason。
- 已完成 live turn 的 runtime 可以写 live pass；未验证 native surface 必须写 smoke、skipped 或 unsupported-with-reason，不能用 projection smoke 冒充 native/live pass。
- 四端验证报告必须说明 runtime 差异、降级路径和未覆盖风险。
- 测试必须证明 `skipped`、`projection_only`、`native_harness_missing` 不会被误写成 release pass。

v0.15 Cursor native live-turn harness contract：

- 合同文件：`config/contracts/cursor-live-turn-harness-contract.json`。
- 官方 evidence：Cursor CLI overview / using / parameters 文档声明 Agent CLI、non-interactive print mode、`--output-format json`；Cursor CLI installation 文档声明 macOS / Linux / Windows WSL 可用 `cursor-agent --version` 验证。
- 本机 evidence：`cursor --version` 为 3.4.13；`where cursor-agent` 未找到；常见 Windows 路径没有 `cursor-agent`；WSL Ubuntu 存在但 `command -v cursor-agent` 为空；`cursor agent --help` 没有 `--print` / `--output-format`，因此 `node scripts/eval-meta-agents.mjs --runtime=cursor --live` 必须返回 structured blocked。
- blocked 不等于 release pass；`runtimeEvidencePacket.records[0].failureClass = "native_harness_missing"`，`evidenceKind = "unsupported"`，`releaseGrade = false`。

### R-009 Warden 审批后的真实长期 writeback 流程

目标：

- CandidateWriteback 不能只停在候选；当 Warden 明确批准后，系统必须能把候选能力正式写入 canonical，并保留审计证据。

量化验收：

- `candidate_only`、`none-with-reason`、`approved-for-writeback` 三种状态必须可区分。
- Warden 批准前，canonical 写入数量必须为 0。
- Warden approval packet 必须使用 `warden-approval-v0.1`，且包含 `approvalId`、`approver`、`approvedAt`、`scope`、`targets`、`diffSummary`、`rollbackPlan`。
- Warden 批准后，写入目标只能是允许的 canonical 路径，例如 `canonical/skills` 或 `canonical/agents`。
- 写入后必须运行 projection sync、review、verification，并记录 rollback plan。
- 每次 writeback 必须有 source gap、repeatKey、approval evidence、diff summary、verification result。
- 未提供审批包时必须生成 `approvalRequest` 和 `dryRunArtifact`，且 `dryRun.canonicalWrites = 0`。

### R-010 用户可读 UI / 报告层

目标：

- 让用户能看懂一次 run 为什么这么判、交给谁、为什么阻塞、下一步是否值得升级长期能力。

量化验收：

- 用户能按 runId 查看 CapabilityGap、GapDecision、DecisionOutput、Review、Verification、Evolution。
- 报告必须解释：为什么判 `create_skill` / `create_agent` / `create_script` / `create_mcp_provider` / `worker_task_only` / `blocked_or_needs_approval`。
- 报告必须展示下一步 owner、merge owner、parallelGroup、shardScope、blocking reason、approval request。
- 报告不能泄露本机绝对路径、credentials、外部参考来源名或私有状态。
- 至少一个可读入口可以从 RunStateStore 数据生成，而不是从聊天总结生成。

### R-011 AI 课可理解产品标准

目标：

- 让设计、执行、验收、反馈、交付内容都能被 AI 课程学员和 reviewer 看懂，不依赖隐藏协议词。

五个教学维度：

| 维度 | 人话问题 | PASS | FAIL |
|---|---|---|---|
| 设计标准 | 这次运行有没有先说明用户真正要什么、缺什么能力、为什么选这条路线？ | 有 Critical / Fetch / GapDecision / owner / graph branch 证据 | 只有结论，没有能力缺口、owner 或路线依据 |
| 执行标准 | 判断之后有没有产出能交给下一位 owner 做的具体东西？ | 每个 GapDecision 都有 DecisionOutput 和 verification policy | 只有建议，没有下一步交付物 |
| 验收标准 | 怎么知道它真的跑对了？ | R 项和量化指标都有 pass/fail、owner、returnToStage、证据 | 只说测试通过，没有验收映射 |
| 反馈标准 | 用户纠正会不会改变下一次判断？ | userCorrection replay 会影响 decision，重复 3 次触发 promotion review candidate | 纠正只留在聊天里，或直接自动写 canonical |
| 交付内容标准 | 它最后留下了哪些可读、可查、可复盘的交付物？ | JSON、中文报告、SQLite、scorecards、analytics、graphValidation、evidence commands 都存在 | 只有聊天总结或原始 JSON，缺少报告 / DB / evidence |

量化验收：

- 必须有一个机器可读标准合同：`config/contracts/ai-course-product-standards.json`。
- 标准必须覆盖 5 个维度：设计、执行、验收、反馈、交付内容。
- 每个维度必须包含：人话问题、通过标准、失败标准、requiredEvidence。
- 完整产品报告必须渲染“AI 课可理解标准”，且每个维度 status = pass。
- 这些标准必须从真实 artifact 验证，不能只从 PRD 文案通过。

## 完整产品 Definition of Done

完整产品 MVP 完成必须同时满足：

| 维度 | 完成标准 |
|---|---|
| 跑对 | 6 类 GapDecision、12 条真实输入、所有 fixture 决策 100% 正确 |
| 跑完善 | 每次 run 都有 Critical / Fetch / Thinking / branch / Review / Verification / Evolution 证据 |
| 质量高 | 每类 DecisionOutput scorecard 100% pass，create_agent 保持 10/10 |
| 可交付 | 单一入口生成 JSON、中文报告、SQLite 记录，且报告可给用户阅读 |
| 可复盘 | RunStateStore 能按 runId、decision、repeatKey、owner 查询 |
| 可进化 | 用户纠错能 replay，重复 3 次以上触发 promotion review candidate |
| 不污染 | fake owner 0，治理 agent 当 worker 0，长期身份污染 0，自动写 canonical 0 |
| 安全 | 未授权外部写动作 0，blocked bypass 0，credential leak 0 |
| LangGraph 对齐 | node/edge/state/event/checkpoint 都有合同，branch coverage 100% |
| AI 课可解释 | 设计、执行、验收、反馈、交付内容都有 Plain-language question、PASS、FAIL 和 requiredEvidence |
| 开源安全 | 公开产物不暴露参考来源名、本机路径、credentials、私有状态 |

如果以上任一项没有可执行证据，状态只能是 `partial`，不能写成 `complete`。

## Local Executable MVP Slice

本地第一片实现入口：

```text
npm run meta:gap:mvp -- tests/meta-theory/scenarios/capability-gap-decision-fixtures.json
```

当前本地实现必须证明：

- 6 个 fixture 全部 replay。
- 6 类 GapDecision 都出现一次。
- 每个 decision 都有 `DecisionEvidenceContract`，并命中 fixture 的 `requiredEvidence`。
- 每个 run 写入 `runs`、`run_events`、`capability_gaps`、`gap_decisions`。
- create_agent 写入 `generated_agent_specs`，其他分支不写。
- create_skill、create_agent、create_script、create_mcp_provider 写入 `candidate_writebacks`。
- 每个 run 写入 `user_feedback`，用于用户纠正和 replay。
- worker_task_only 不写长期候选。
- blocked_or_needs_approval 不生成绕授权的 provider 或 agent。
- 每个 decision 都能映射到 LangGraph 控制图分支。

本地测试入口：

```text
node scripts/run-node-tests.mjs "tests/meta-theory/22-capability-gap-mvp.test.mjs"
node scripts/run-node-tests.mjs "tests/meta-theory/21-generated-agent-quality.test.mjs"
node scripts/run-node-tests.mjs "tests/meta-theory/23-capability-gap-route-integration.test.mjs"
npm run meta:route:validate
npm run meta:gap:codex-real-test
npm run meta:gap:isolated-report
```

其中 `meta:gap:isolated-report` 是单任务隔离验收入口：它用新进程运行 route 和验证命令，固定抽取 `CapabilityGap`、`GapDecision`、`DecisionOutput`、Execution gate 和量化验收字段，并生成报告。它验证的是默认路径能否自然判断，而不是依赖人工总结。

报告产物：

- 本地状态 JSON：`.meta-kim/state/default/capability-gap-isolated-task-report.json`
- 可读报告：`.meta-kim/state/default/capability-gap-isolated-task-report.zh-CN.md`

## Review Checklist

### Critical 失败条件

- 目标写成“做 graph”而不是“证明缺能力决策”。
- 没有用户痛点、成功标准或非目标。

### Fetch 失败条件

- 没读现有 capability / contract / meta-theory 依据就写 PRD。
- 把 ignored 或不存在的快照文档当作已读事实。
- 没说明现有 `capabilityGapPacket` 与本 MVP 的关系。

### Thinking 失败条件

- 先做完整 CapabilityGraph、Edge builder、图数据库或全 runtime planner。
- 没有比较 MVP 路线和大架构路线。
- 没把 workerTask-only 与 create_agent 分清。
- 数据库替代了 planner 或 conditional edge。
- LangGraph 图没有按 6 类 decision 分支。

### Review 失败条件

- 没有量化验收。
- 没有 6 类 fixture。
- 允许 fake owner、missing verifier、validator-as-planner 或长期 identity 污染。
- CandidateWriteback 会自动写 canonical。
- meta agent 被安排为执行 worker。
- 关键事件没有埋点，导致 decision 不能回放。
- 数据库记录不能证明为什么走某条边。

## 本期完成定义

PRD v0.2 完成不等于功能完成。本期完成定义是：

- 本文档在 tracked 路径下新增。
- 文档覆盖真实目标、原则、MVP scope、最小数据模型、FR、量化验收、fixture、执行计划和反馈机制。
- 文档覆盖分层架构、RunStateStore、埋点事件、LangGraph 控制图和数据库非 planner 边界。
- 文档覆盖 Owner Responsibility Matrix 和 Decision Evidence Contract。
- 本地测试覆盖 requiredEvidence、forbidden behavior、branch owner role、user_feedback persistence。
- `git diff --check -- docs/ai-native-capability-gap-mvp-prd.zh-CN.md` 通过。
- `git check-ignore -v docs/ai-native-capability-gap-mvp-prd.zh-CN.md` 无输出。
- 不提交、不推送、不发布。
