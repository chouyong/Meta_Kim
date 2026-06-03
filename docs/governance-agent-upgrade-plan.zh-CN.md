# Meta_Kim 治理 Agent 升级方案

## 文档控制

- 版本：v0.1
- 状态：Draft for implementation
- Owner：Meta_Kim / meta-warden
- 目标：说明治理层 agent 应该参考什么、吸收什么、拒绝什么，以及下一步怎么改。

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
- 修改后不能把 gstack、gbrain、wshobson/agents 的架构搬进 Meta_Kim。

## Fetch：参考什么最好

### 1. `wshobson/agents`：专业 agent 设定参考

参考价值：

- 公开 GitHub 仓库，当前 README 显示约 84 plugins、192 agents、156 skills、102 commands。
- 它的强项是“专业岗位 agent”的命名、触发、职责边界、能力列表、工作流位置、与其他 agent 的区别。
- 它还强调一个 source-of-truth 生成多 runtime 原生投影，这和 Meta_Kim 的跨 runtime 投影方向相近。

Meta_Kim 可以吸收：

- 专业 role naming：agent 名称应该像专业岗位，不像一次性任务。
- 描述里明确“什么时候用”，不要只写“这个 agent 很强”。
- Key Distinctions：说清楚和相邻 agent 的区别。
- Workflow Position：说清楚在上游/下游哪个位置工作。
- Output Examples：说清楚好输出应该包含哪些部分。

Meta_Kim 不能吸收：

- 不能复制它的 plugin marketplace 架构。
- 不能复制它的 agent 数量路线。
- 不能把“多 agent catalog”当作当前核心目标。
- 不能照搬它的 runtime adapter 结构。

### 2. Anthropic `skill-creator`：技能与评测方法参考

参考价值：

- Anthropic 官方 `skills` 仓库说明 skill 是带 `SKILL.md` 的自包含目录，用于让 Claude 动态加载专业任务能力。
- `skill-creator` 明确强调：先问边界、输入输出、成功标准、依赖；再写 skill；客观可验证任务要配测试；迭代时看测试运行结果。
- 它强调 progressive disclosure：入口保持小，细节放到 references / scripts / assets。
- 它强调“解释为什么”，而不是堆 ALWAYS / NEVER。

Meta_Kim 可以吸收：

- 技能/agent 设计前必须先锁定 edge cases、I/O、成功标准、依赖。
- 能被测试的能力必须有测试。
- 重复出现的机械步骤才沉淀脚本。
- 把大段细节放进 reference，不要把每个 meta agent 都写成百科全书。

Meta_Kim 不能吸收：

- 不能把治理 agent 当成 skill 来写。
- 不能因为 skill-creator 强调 skill，就把 create_agent 缺口改成 create_skill。
- 不能照搬 Anthropic 的 Skill 文件结构作为 Meta_Kim agent identity 结构。

### 3. gstack：产品流程和交付节奏参考

参考价值：

- 本地已安装 gstack 技能集，覆盖 QA、review、ship、benchmark、design、devex、context 等开发流程。
- gstack 的强项不是 agent identity，而是把工作放在产品流程位置里：什么时候 plan、什么时候 review、什么时候 ship、什么时候 retro。

Meta_Kim 可以吸收：

- `flowPosition`：每个 agent 设计要知道自己处在 Critical / Fetch / Thinking / Review / Verification / Evolution 哪个位置。
- handoff：上游给什么，下游拿什么。
- 不同阶段输出不同，不要把所有内容塞进一个 agent。

Meta_Kim 不能吸收：

- 不能复制 gstack 的 skill catalog。
- 不能把 gstack 的工具流当作 Meta_Kim 的治理架构。
- 不能让 gstack 技能长期绑定进某个治理 agent identity。

### 4. gbrain：记忆、信任策略、回放参考

参考价值：

- 本地 gstack 文档把 gbrain 描述为 agent 的持久知识库，支持跨会话记忆、代码搜索、MCP 注册、repo trust policy。
- gbrain 的强项是：记忆可查、写入有策略、不同 repo 有 read-write / read-only / deny 边界、同步过程可重跑。

Meta_Kim 可以吸收：

- `memoryPolicy` 必须写允许记什么、禁止记什么。
- repo / project 级信任策略必须清楚，避免跨项目污染。
- 运行证据要能回放，而不是靠上下文记忆。
- 同步/写回要可重跑、可拒绝、可审计。

Meta_Kim 不能吸收：

- 不能复制 gbrain 的数据库/图/同步架构。
- 不能把长期记忆系统等同于治理 agent。
- 不能让 memory provider 绕过 Warden 的 writeback gate。

### 5. Anthropic Claude Code Advanced Patterns：subagent 使用边界参考

参考价值：

- Anthropic 资料强调 subagent 适合清晰、专业、工具权限明确、有成功标准的角色。
- subagent 更适合轻量返回结论、并行探索和上下文管理，不适合主线程失去监督的复杂不清任务。

Meta_Kim 可以吸收：

- agent 创建前必须证明角色清晰、专业、成功标准明确。
- 工具权限和完成标准必须一起定义。
- 并行 agent 只用于可拆分的独立工作流。

Meta_Kim 不能吸收：

- 不能把 subagent 当作万能执行者。
- 不能让 meta agent 变成 implementation worker。
- 不能用 subagent 数量替代质量。

## Thinking：该怎么改

当前 Meta_Kim 已经有：

- `docs/ai-native-capability-gap-mvp-prd.zh-CN.md`
- `docs/meta-kim-capability-governance-langgraph-plan.zh-CN.md`
- `config/contracts/agent-design-quality-contract.json`
- `scripts/run-core-mvp-acceptance.mjs`
- 6 类 GapDecision fixtures
- RunStateStore / LangGraph 风格 trace / core MVP 验收报告

真正缺口不是“没有 PRD”，而是治理 agent 的站点输出还不够产品化。下一步应该补一个统一的 agent-design station contract，然后小范围改四个核心治理 agent。

### 要新增的统一合同

建议新增：

`config/contracts/governance-agent-design-station-contract.json`

它定义四个站点输出：

| 站点 | Owner | 输出包 | 负责判断 |
|---|---|---|---|
| Boundary Station | `meta-genesis` | `agentBoundaryDecision` | 这是不是长期 agent；边界是否抽象专业；拒绝项是否清楚 |
| Loadout Station | `meta-artisan` | `agentLoadoutDecision` | 需要哪些抽象能力槽；哪些能力 run-scoped；哪些 provider 被拒绝 |
| Review Station | `meta-prism` | `agentDesignReview` | 是否假专业、假 owner、身份污染、缺 verifier、弱路径未拒绝 |
| Gate Station | `meta-warden` | `agentCandidateGateDecision` | 是否允许进入 CandidateWriteback；是否需要退回 Thinking / Genesis / Artisan / Prism |

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

#### 3. meta-prism

新增或强化：

- `agentDesignReview` 输出格式。
- 直接使用 `agent-design-quality-contract` 的维度。
- 必须能失败：generic agent、task-bound identity、dependency architecture copy、missing verifier、single-path reasoning。
- Review 先查上游 Critical / Fetch / Thinking 是否够，不只看最终文字。

#### 4. meta-warden

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
- 不把 gstack/gbrain/wshobson 的目录结构搬进来。
- 不把 `GeneratedAgentSpec` 直接自动写入 canonical agent 文件。

## Review：为什么这是最好的下一步

这个方案最好，是因为它对准了当前核心痛点：

1. 你的核心问题是“治理层能不能设计出抽象但专业的 agent”，不是“有没有更多 agent”。
2. 现在验收门已经能证明核心 MVP 通过，但还缺对治理 agent 内部站点产物的强约束。
3. 外部优秀项目的共同点不是“架构更大”，而是：
   - 专业角色清楚；
   - 触发条件清楚；
   - 输入输出清楚；
   - 测试和评估清楚；
   - runtime 差异不污染源定义；
   - memory / writeback 有边界。
4. 用 station contract 能保持简单、可控、可扩展、解耦、分层：
   - 简单：只加一个合同。
   - 可控：四个输出包都有验收。
   - 可扩展：以后可以加 station，不必重写架构。
   - 解耦：Genesis / Artisan / Prism / Warden 各管一段。
   - 有数据：RunStateStore 可以记录每个 station output。

## 下一步执行顺序

1. 新增 `governance-agent-design-station-contract.json`。
2. 新增测试：合同必须包含四个 station、必填字段、失败条件。
3. 小范围修改 `meta-genesis`、`meta-artisan`、`meta-prism`、`meta-warden`，只补 station output，不重写整篇。
4. 扩展 `run-core-mvp-acceptance.mjs`，检查 station contract 存在且四站点可映射。
5. 跑：
   - `npm run meta:core:mvp:acceptance`
   - `npm run meta:test:meta-theory`
   - `git diff --check`

## 参考源

- wshobson/agents：https://github.com/wshobson/agents
- wshobson authoring guide：https://github.com/wshobson/agents/blob/main/docs/authoring.md
- wshobson plugin eval：https://github.com/wshobson/agents/blob/main/docs/plugin-eval.md
- Anthropic skills：https://github.com/anthropics/skills
- Anthropic skill-creator：https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
- Anthropic Claude Code Advanced Patterns：https://resources.anthropic.com/hubfs/Claude%20Code%20Advanced%20Patterns_%20Subagents%2C%20MCP%2C%20and%20Scaling%20to%20Real%20Codebases.pdf
- gstack：https://github.com/garrytan/gstack
- gbrain：https://github.com/garrytan/gbrain
