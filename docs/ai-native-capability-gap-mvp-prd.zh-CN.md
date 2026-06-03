# Meta_Kim AI-native Capability Gap MVP PRD

## 文档控制

- 版本：v0.2
- 状态：Draft for review
- Owner：meta-conductor 负责 PRD 与执行节奏，meta-warden 负责最终边界门禁
- 建议目标版本：v2.9.0-alpha.1 先做 fixture 和决策策略验证；价值成立后再进入 v2.9.0
- 产物类型：MVP PRD / 执行计划
- 本期判断脊柱：Critical / Fetch / Thinking / Review

## Executive Summary

本期只证明一件事：当 Meta_Kim 发现缺能力时，默认路径能自然判断该创建 skill、agent、script、MCP-provider、只发 workerTask，还是阻塞等待授权，而不是让主线程硬做、万能 owner 硬接，或靠 validator 事后补救。

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

MVP 原则：

- 先决定是否值得创建能力，再决定创建哪类能力。
- 长期能力和 run-scoped task 必须分离。
- validators 只拒绝危险、空路线、污染路线；不能把 validator 当 planner。
- 默认路径必须在 Thinking 阶段自然完成 owner / weapon / verification 选择。

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

## Test Fixtures

### Fixture 1：create_skill

- 输入：用户多次要求用同一套 Critical / Fetch / Thinking / Review 标准评审 PRD，现有 agent 可执行单次 review，但没有可复用步骤包。
- 期望 decision：`create_skill`
- 禁止行为：创建新 agent；把单次 PRD 文件路径写进 skill identity；直接写 canonical。
- 验收方式：GapDecision 解释“可复用流程，不需要新 owner”；CandidateWriteback 类型为 skill；fixture pass。

### Fixture 2：create_agent

- 输入：用户项目长期需要“数据隐私影响评估 owner”，需要稳定责任、拒绝项、输入输出和复用边界；现有 skill/script 只能做检查清单。
- 期望 decision：`create_agent`
- 禁止行为：用 meta-sentinel 直接当执行 worker；用 checklist skill 伪装 owner；用 runtime nickname 当 roleDisplayName。
- 验收方式：GapDecision 解释“缺长期责任 owner”；CandidateWriteback 类型为 agent；executionAgentCard 不含路径、今天任务或 verifySteps。

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

### Phase 3：validator guardrails

- 目标：让 validator 拒绝危险路线和污染路线，但不替代 planner。
- 输出：guardrail rules。
- 验收：validator 对缺解释、缺 verifier、fake owner、自动写 canonical、外部未授权写动作全部拒绝，并返回 Thinking。

### Phase 4：optional route planner integration

- 目标：价值成立后，再把 GapDecision 接入现有 route planner。
- 输出：只接入最小 decision，不引入完整 graph。
- 验收：`meta:capabilities:route` 或等价入口能读取 GapDecision；不要求 CapabilityGraph。

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

### Review 失败条件

- 没有量化验收。
- 没有 6 类 fixture。
- 允许 fake owner、missing verifier、validator-as-planner 或长期 identity 污染。
- CandidateWriteback 会自动写 canonical。
- meta agent 被安排为执行 worker。

## 本期完成定义

PRD v0.2 完成不等于功能完成。本期完成定义是：

- 本文档在 tracked 路径下新增。
- 文档覆盖真实目标、原则、MVP scope、最小数据模型、FR、量化验收、fixture、执行计划和反馈机制。
- `git diff --check -- docs/ai-native-capability-gap-mvp-prd.zh-CN.md` 通过。
- `git check-ignore -v docs/ai-native-capability-gap-mvp-prd.zh-CN.md` 无输出。
- 不提交、不推送、不发布。
