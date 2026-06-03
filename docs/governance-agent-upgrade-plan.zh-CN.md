# Meta_Kim 治理 Agent 升级方案

## 文档控制

- 版本：v0.1
- 状态：Implementation memo; not a PRD source
- Owner：Meta_Kim / meta-warden
- 目标：说明治理层 agent 应该参考什么、吸收什么、拒绝什么，以及下一步怎么改。
- 单一产品源：Capability Gap / LangGraph / orchestration 的产品设定只以 `docs/ai-native-capability-gap-mvp-prd.zh-CN.md` 为准；本文只记录治理 agent 升级实现备忘。

## Critical：真实目标

这次不是继续做文件清理，也不是批量造 agent。

真实目标是：让 Meta_Kim 的治理层 agent 能稳定设计出“抽象但专业”的 agent。也就是说，当系统走到 `create_agent` 分支时，不只是产出一个看起来完整的 spec，而是能证明：

- 为什么这是长期 owner，不是一次性 workerTask。
- 为什么是 agent，不是 skill / script / MCP provider。
- 这个 agent 的专业边界、输入输出、记忆、工具槽、验收方式是什么。
- Genesis、Artisan、Prism、Warden 各自判断了什么，不能混成一个万能判断者。
- 结果能被 RunStateStore / LangGraph / scorecard 回放和验证。

成功标准：

- `npm run meta:core:mvp:acceptance` 必须通过。
- `create_agent` 分支必须产出可评测的 `GeneratedAgentSpec`。
- 每个治理站点必须有固定输出包，能被测试读取。
- 长期 agent identity 不写单次文件路径、ticket、今日任务、临时验收步骤。
- 修改后不能把任何参考系统的架构、目录、prompt wording 或 owner 层级搬进 Meta_Kim。

## Fetch：抽象成什么标准

### 1. 专业角色标准

可吸收的判断：

- agent 名称应该像专业岗位，不像一次性任务。
- 描述里明确“什么时候用”，不要只写“这个 agent 很强”。
- 说清楚和相邻 agent 的区别。
- 说清楚在上游/下游哪个位置工作。
- 说清楚好输出应该包含哪些部分。

拒绝：

- 不能复制任何 marketplace、catalog、runtime adapter 或批量 agent 数量路线。
- 不能把“agent 多”当作当前核心目标。

### 2. 能力设计与评测标准

可吸收的判断：

- 技能/agent 设计前必须先锁定 edge cases、I/O、成功标准、依赖。
- 能被测试的能力必须有测试。
- 重复出现的机械步骤才沉淀脚本。
- 把大段细节放进 reference，不要把每个 meta agent 都写成百科全书。
- 解释为什么，而不是堆命令式口号。

拒绝：

- 不能把治理 agent 当成 skill 来写。
- 不能因为某个参考标准强调 skill，就把 `create_agent` 缺口强行改成 `create_skill`。
- 不能照搬外部 skill 文件结构作为 Meta_Kim agent identity 结构。

### 3. 产品流程与交付节奏标准

可吸收的判断：

- `flowPosition`：每个 agent 设计要知道自己处在 Critical / Fetch / Thinking / Review / Verification / Evolution 哪个位置。
- handoff：上游给什么，下游拿什么。
- 不同阶段输出不同，不要把所有内容塞进一个 agent。

拒绝：

- 不能复制任何工具流、skill catalog 或命令目录。
- 不能让某个工具包长期绑定进治理 agent identity。

### 4. 记忆、信任策略、回放标准

可吸收的判断：

- `memoryPolicy` 必须写允许记什么、禁止记什么。
- repo / project 级信任策略必须清楚，避免跨项目污染。
- 运行证据要能回放，而不是靠上下文记忆。
- 同步/写回要可重跑、可拒绝、可审计。

拒绝：

- 不能复制外部数据库/图/同步架构。
- 不能把长期记忆系统等同于治理 agent。
- 不能让 memory provider 绕过 Warden 的 writeback gate。

### 5. 子 agent 使用边界标准

可吸收的判断：

- agent 创建前必须证明角色清晰、专业、成功标准明确。
- 工具权限和完成标准必须一起定义。
- 并行 agent 只用于可拆分的独立工作流。

拒绝：

- 不能把 subagent 当作万能执行者。
- 不能让 meta agent 变成 implementation worker。
- 不能用 subagent 数量替代质量。

## Thinking：该怎么改

当前 Meta_Kim 已经有：

- `docs/ai-native-capability-gap-mvp-prd.zh-CN.md`
- `config/contracts/agent-design-quality-contract.json`
- `scripts/run-core-mvp-acceptance.mjs`
- 6 类 GapDecision fixtures
- RunStateStore / LangGraph 风格 trace / core MVP 验收报告

真正缺口不是“没有 PRD”，而是治理 agent 的站点输出还不够产品化。下一步应该补一个统一的 agent-design station contract，然后小范围改五个核心治理 agent。

吸收外部优秀项目时要先做冲突判断：如果外部参考和 Meta_Kim 已有流程、三层记忆、RunStateStore、LangGraph 控制图重叠，保留 Meta_Kim 的结构，只吸收它背后的判断标准。也就是说，不能把参考项目的目录、图、数据库、agent 层级或 prompt wording 搬进来；只能把它们转译成 Meta_Kim 自己的 station output。

### 要新增的统一合同

建议新增：

`config/contracts/governance-agent-design-station-contract.json`

它定义五个站点输出：

| 站点 | Owner | 输出包 | 负责判断 |
|---|---|---|---|
| Boundary Station | `meta-genesis` | `agentBoundaryDecision` | 这是不是长期 agent；边界是否抽象专业；拒绝项是否清楚 |
| Loadout Station | `meta-artisan` | `agentLoadoutDecision` | 需要哪些抽象能力槽；哪些能力 run-scoped；哪些 provider 被拒绝 |
| Memory Station | `meta-librarian` | `agentMemoryDecision` | 允许记什么、禁止记什么、证据归 RunStateStore 还是长期记忆 |
| Review Station | `meta-prism` | `agentDesignReview` | 是否假专业、假 owner、身份污染、缺 verifier、弱路径未拒绝、外部参考是否被转译而非复制 |
| Gate Station | `meta-warden` | `agentCandidateGateDecision` | 是否允许进入 CandidateWriteback；是否需要退回 Thinking / Genesis / Artisan / Librarian / Prism |

### 要改的 agent

#### 1. meta-genesis

新增或强化：

- `agentBoundaryDecision` 输出格式。
- 长期 owner 证明：为什么不是 workerTask。
- 抽象专业证明：替换 agent 名后是否仍成立。
- 拒绝单次任务绑定：路径、ticket、todayTask、scopeFiles 不得进入 identity。

#### 2. meta-artisan

新增或强化：

- `agentLoadoutDecision` 输出格式。
- loadout ROI：覆盖度、复用频率、上下文成本、学习成本。
- durable vs run-scoped 分离：长期只写抽象 capability slots，具体 skill/tool 本轮绑定。
- provider rejection：为什么不用某个 skill / script / MCP。

#### 3. meta-librarian

新增或强化：

- `agentMemoryDecision` 输出格式。
- memory scope：none、run-scoped、project-scoped、cross-project-readonly / denied / approved。
- allowed / forbidden memory：长期能记什么，哪些一律只能留在 run packet 或 RunStateStore。
- replay source：判断证据归数据库事件、记忆文件还是源文档。
- writeback gate：任何长期记忆写回必须经过 Warden。

#### 4. meta-prism

新增或强化：

- `agentDesignReview` 输出格式。
- 直接使用 `agent-design-quality-contract` 的维度。
- 必须能失败：generic agent、task-bound identity、dependency architecture copy、missing verifier、single-path reasoning。
- Review 先查上游 Critical / Fetch / Thinking 是否够，不只看最终文字。

#### 5. meta-warden

新增或强化：

- `agentCandidateGateDecision` 输出格式。
- 明确通过/退回/阻断。
- 只有在 Genesis + Artisan + Prism 证据完整时才允许 CandidateWriteback。
- 如果只是兼容性 fallback，不能算治理完成。

### 不建议现在改的部分

- 不先造完整 CapabilityGraph。
- 不先建图数据库。
- 不批量创建 agent。
- 不把 9 个 meta agent 全部大改。
- 不把任何参考系统的目录结构搬进来。
- 不把 `GeneratedAgentSpec` 直接自动写入 canonical agent 文件。

## Review：为什么这是最好的下一步

这个方案最好，是因为它对准了当前核心痛点：

1. 你的核心问题是“治理层能不能设计出抽象但专业的 agent”，不是“有没有更多 agent”。
2. 现在验收门已经能证明核心 MVP 通过，但还缺对治理 agent 内部站点产物的强约束。
3. 可吸收标准的共同点不是“架构更大”，而是：
   - 专业角色清楚；
   - 触发条件清楚；
   - 输入输出清楚；
   - 测试和评估清楚；
   - runtime 差异不污染源定义；
   - memory / writeback 有边界。
4. 用 station contract 能保持简单、可控、可扩展、解耦、分层：
   - 简单：只加一个合同。
   - 可控：五个输出包都有验收。
   - 可扩展：以后可以加 station，不必重写架构。
   - 解耦：Genesis / Artisan / Prism / Warden 各管一段。
   - 有数据：RunStateStore 可以记录每个 station output。

## 下一步执行顺序

1. 新增 `governance-agent-design-station-contract.json`。
2. 新增测试：合同必须包含五个 station、必填字段、失败条件。
3. 小范围修改 `meta-genesis`、`meta-artisan`、`meta-librarian`、`meta-prism`、`meta-warden`，只补 station output，不重写整篇。
4. 扩展 `run-core-mvp-acceptance.mjs`，检查 station contract 存在且五站点可映射。
5. 跑：
   - `npm run meta:core:mvp:acceptance`
   - `npm run meta:test:meta-theory`
   - `git diff --check`

## Source Boundary

公开治理文件只保留 Meta_Kim 自己的标准。具体调研来源、仓库名、链接和对照笔记只能放在研究材料或依赖注册中，不能进入长期 agent identity、PRD 主体、station contract 或 public-ready prompt。
