# Meta_Kim for Codex

This file is the Codex entrypoint for maintaining Meta_Kim. Read it as the resident operating guide for this repository, not as a marketing overview.

## Fast Read

If you only keep five rules in mind:

- Meta_Kim is one cross-runtime governance system. Claude Code, Codex, OpenClaw, and Cursor are projections of the same canonical layer.
- `meta-warden` is the normal public front door. Other meta agents are backstage specialists.
- Dispatch is capability-first: describe the capability, search agents / skills / tools / capability indexes, then choose the best owner.
- Long-term behavior lives in `canonical/`, `config/contracts/`, and `config/capability-index/`. Runtime trees are projections unless explicitly documented otherwise.
- User-visible worker names must be coarse English business role-family names such as `frontend`, `backend`, or `test`, not scoped work items or host-generated personal nicknames. Localized trigger words may be recognized as input, but durable governance files stay English.

## Codex Output Rules

- On Windows, do not output raw Windows paths in normal Markdown text. Wrap paths in backticks and prefer forward slashes, for example `D:/path/to/project`.
- Do not paste full diffs or patches into chat after GitHub submit.
- After GitHub submit, report only the branch name, commit hash, PR URL when present, and a short summary.

## What This Repository Is

Do not read Meta_Kim as a folder full of unrelated prompt files.

Read it as:

**a cross-runtime architecture pack for intent amplification, governed through small replaceable meta units and projected into multiple AI runtimes.**

In this repo, `meta` means the smallest governable unit that supports intent amplification. A valid meta unit:

- owns one clear responsibility class
- states what it refuses, not only what it does
- can be reviewed on its own
- can be replaced or rolled back
- does not silently absorb unrelated responsibilities

## Source Of Truth

Edit these for durable behavior:

- `canonical/agents/*.md`
- `canonical/skills/meta-theory/SKILL.md`
- `canonical/skills/meta-theory/references/*.md`
- `canonical/runtime-assets/*`
- `config/contracts/`
- `config/capability-index/`

Treat these as generated mirrors or runtime adapters unless the task explicitly targets runtime wiring:

- `.claude/agents/*.md`
- `.claude/skills/meta-theory/`
- `.claude/hooks/`
- `.claude/settings.json`
- `.mcp.json`
- `.claude/capability-index/`
- `.codex/agents/*.toml`
- `.agents/skills/`
- `.codex/skills/` legacy compatibility mirrors, when present for cleanup
- `.codex/capability-index/`
- `.cursor/agents/*.md`
- `.cursor/skills/meta-theory/`
- `.cursor/mcp.json`
- `.cursor/capability-index/`
- `openclaw/skills/`
- `openclaw/workspaces/*`
- `openclaw/capability-index/`
- `openclaw/openclaw.template.json`

After changing canonical sources, sync projections instead of hand-forking runtime copies.

## Codex Runtime Map

When this repository is opened in Codex:

- `AGENTS.md` is this resident project guide.
- `.codex/agents/*.toml` contains Codex custom-agent mirrors for the Meta_Kim team. Codex is the only target here that uses agent TOML; `worker.toml` and `explorer.toml` are fallback adapters for built-in Codex roles, and `frontend.toml`, `backend.toml`, `test.toml`, `review.toml`, `analysis.toml`, `verify.toml`, and `docs.toml` are business-role adapters for hosts that honor named custom agents. None of these adapters become durable Meta_Kim owners.
- `.agents/skills/meta-theory/SKILL.md` is the Codex project skill mirror. Project-local `.codex/skills/meta-theory/` was a legacy compatibility mirror and should be removed by sync when present. The canonical source is `canonical/skills/meta-theory/SKILL.md`.
- `.codex/hooks.json` and `.codex/hooks/` carry Codex-compatible project hook wiring.
- `codex/config.toml.example` is generated from `canonical/runtime-assets/codex/config.toml.example`.

Cursor parity is maintained through `.cursor/agents/*.md`, `.cursor/skills/meta-theory/`, `.cursor/hooks.json`, `.cursor/hooks/`, `.cursor/mcp.json`, and `.cursor/capability-index/`.

Cross-runtime format boundary:

- Claude Code agents: `.claude/agents/*.md` with YAML frontmatter.
- Codex agents: `.codex/agents/*.toml` with `name`, `description`, `developer_instructions`, and optional ASCII `nickname_candidates`. Do not copy Codex TOML fields into Claude Code, Cursor, or OpenClaw.
- Cursor agents: `.cursor/agents/*.md` with YAML frontmatter plus `.cursor/rules/*.mdc` and `AGENTS.md` context.
- OpenClaw agents: `openclaw/workspaces/<agent>/` identity/workspace files plus `openclaw/openclaw.template.json`.

## Capability-First Dispatch

Meta_Kim does not start with "call agent X". It starts with "what capability is needed?"

For every non-query governed task, run capability search before execution. If the task touches runtime behavior, inspect `config/runtime-capability-matrix.json`. If it touches macOS, Windows, or WSL2, inspect `config/os-compatibility-matrix.json`. If it touches external reusable capability, inspect `config/capability-index/dependency-project-registry.json`. Reference-only projects are not dependencies; distill useful ideas into Meta_Kim stage data such as `config/governance/decision-pattern-catalog.json`.

Use this order:

```text
Need capability
-> Search repo canonical capability index
-> Search runtime mirror indexes
-> Search local runtime inventory
-> Search available skills and tools
-> Choose the best owner by boundary fit
-> Dispatch with explicit scope, deliverable, review owner, and verification owner
```

Capability-index fetch order:

```text
config/capability-index/
-> .claude/.codex/.cursor/openclaw capability-index mirrors
-> .meta-kim/state/{profile}/capability-index/
-> explicit compatibility degradation or capabilityGapPacket
```

Hardcoding a specific agent name before discovery is a shortcut, not the canonical method.

For a real execution demand, the default path must prove the whole provider chain before mutation: capability discovery, execution-agent search and selection, execution-agent creation capability search, skill search and selection, skill creation capability search, MCP provider search, command/runtime tool selection, and verification owner/path selection. This must happen as the natural Fetch -> Thinking route, not as a validator or hook rescue after the route is already weak.

### Mechanical Enforcement (Cross-Runtime)

Capability-first has a mechanical hook path on Claude Code, Codex, and Cursor, but the default mode is progressive. During the grace window it warns unless `META_KIM_CAPABILITY_GATE=block` is set; do not describe the default as immediate hard-deny. Hooks are last-resort fuses for key behavior only. They should block missing intent, missing Fetch evidence, missing capability discovery, missing owner/loadout, known-unsupported runtime/OS, missing memory strategy, or unsafe meta-agent mutation. They should not block merely because optional packet parameters are absent; detailed completeness belongs to validators, Review, and public-ready gates.

- **Claude Code**: enforced via the PreToolUse hook `enforce-agent-dispatch.mjs` (deny payload `{hookSpecificOutput.permissionDecision: "deny"}` when the effective mode is `block`). The gate covers `Agent` dispatches in stages `execution`, `review`, `meta_review`, `verification`, `evolution` unless `fetchRecord.capabilitySearchPerformed === true`. Discovery stages `critical`, `fetch`, `thinking` are exempt except for execution-intent dispatch before design-time readiness.
- **Codex CLI**: enforced via PreToolUse hook (same `enforce-agent-dispatch.mjs` script projected to `.codex/hooks/`). Matcher includes `"Bash|apply_patch|Edit|Write|MultiEdit|NotebookEdit|Agent|spawn_agent"`, but Codex hook coverage is runtime-version dependent; do not treat it as an all-tool policy engine. Registered at `scripts/runtime-hook-mapping.mjs:213-219`.
- **Cursor**: mechanically enforced via the official `preToolUse` hook surface with `failClosed: true` (crash defaults to deny). Uses exit code 2 + stderr deny reason or stdout JSON `{"permission":"deny",...}`. Registered at `scripts/runtime-hook-mapping.mjs:269-280`.
- **OpenClaw**: current Meta_Kim tool-blocking enforcement is declarative-only — hard refusal prose in workspace `HEARTBEAT.md` and `SOUL.md` (`executionBlock=true`). OpenClaw internal hooks cover command/lifecycle automation, and typed plugin hooks are the official blocking/canceling policy surface, but Meta_Kim has not installed a typed plugin enforcement adapter yet.

Override knob (all hook-equipped runtimes): `META_KIM_CAPABILITY_GATE=progressive|block|warn|off` (default `progressive`; set `block` env for immediate hard deny). Set `warn` to emit stderr warnings without denying, or `off` to disable the gate entirely. Runtime-payload schema selector: `META_KIM_HOOK_RUNTIME=claude|codex|cursor`.

Canonical hook source: `canonical/runtime-assets/claude/hooks/enforce-agent-dispatch.mjs`. The current runtime matrix and limits are documented in this Mechanical Enforcement section; do not add a separate source-of-truth document for the same rule.

#### Local hook extensions (fork-only, non-canonical)

This fork (`chouyong/Meta_Kim`) registers four additional hook entries on top of the canonical enforce-dispatch set. They are local optimizations, not part of upstream `KimYx0207/Meta_Kim`. `npm run meta:doctor:governance` will report them as a hook-set mismatch by design — the diff is expected and not a drift to fix.

| Hook entry | Event | Purpose |
|---|---|---|
| `activate-meta-theory-spine.mjs` | `UserPromptSubmit` | Eager-activate the 8-stage spine on natural-language entry, before Critical, so `enforce-agent-dispatch` has spine state to reason about. |
| `graphify-context.mjs` | `PreToolUse` (Read/Grep/Glob) | Inject `graphify-out/` knowledge-graph context hint into read-tool calls so the answerer prefers `graphify query` over raw scans. |
| `meta-kim-memory-save.mjs --event session-start` | `SessionStart` | Boot the local MCP Memory Service health banner and seed the session with prior memory tags. |
| `meta-kim-memory-save.mjs --event user-prompt` | `UserPromptSubmit` | Persist each user prompt as untrusted recalled-memory context for cross-session continuity. |

Codex parity: the same four entries are mirrored in `.codex/hooks/` and read at session start by Codex; behavior is identical with `META_KIM_HOOK_RUNTIME=codex` schema. Cursor and OpenClaw do not yet receive these fork-only hooks. To bring this fork in line with canonical, remove the four entries above from `.claude/settings.json` and `.codex/hooks.json`; to keep them, treat `doctor:governance`'s hook-set "fail" as informational.

## Meta-Theory Activation

Do not require humans to know or type command words. Treat ordinary natural-language executable requests as the primary entry path when they imply durable planning, execution, review, verification, prioritization, repair suggestions, or a validation checklist. Examples include "帮我整理成优先级、修复建议和验证清单", "这个页面不好看，帮我弄高级一点", "帮我规划并开始处理", or "review this and fix what matters".

Explicit triggers such as `/meta-theory`, `meta-theory`, `meta theory`, `run meta theory`, `execute meta theory`, `元理论`, or a `meta-theory` skill mention are maintainer shortcuts, not required user behavior.

Use the entry classifier behavior as the user-facing rule:

- plain durable work in natural language enters governed `standard_path`
- subjective or taste-dependent work enters Critical clarification before Fetch
- pure read-only questions stay on `fast_path`
- explicit meta-theory requests enter `regulated_path`

Codex must first run:

```text
Critical -> Fetch -> Thinking
```

That means:

- Critical locks the real outcome, pain/value, audience, success standard, non-goals, and only asks questions that change execution
- Fetch gathers evidence and capability facts that change the route, risk, owner, scope, or acceptance criteria
- Thinking selects expert lenses, compares viable paths, rejects weak paths, resolves owners/capabilities, and writes worker work orders before Execution
- Review checks whether Critical, Fetch, and Thinking were good enough before judging final output polish
- Execution work is dispatched to agents, skills, commands, MCP capabilities, runtime tools, or workers selected by Thinking instead of collapsing into the main thread

For Codex, explicit meta-theory activation is also explicit permission to use subagents. The main thread scopes, delegates, reviews, and synthesizes; it does not become the all-purpose executor for complex work.

### Production Correctness Before Execution

Meta-theory work must be correct before production starts, not rescued by Review or Verification after the fact.

Before editing files, inspect the current worktree and source files that will be changed: `git status --short`, `git diff --stat`, targeted diffs, targeted source reads, and repo-scoped search. This read-before-edit step belongs to Critical/Fetch. A hook that blocks read-only inspection is a governance defect to route to Sentinel/Conductor, not a reason to work blind.

Required internal stage records:

- Critical: `realIntent`, `successCriteria`, `nonGoals`, `blockingUnknowns`, `noQuotaClarification`
- Fetch: `evidence`, `decisionImpactMap`, `capabilityDiscovery`, `capabilityGap`, `contradictionLog`
- Thinking: `designFrame`, `workType`, `expertLens`, `consideredLanes`, `omittedLanesWithReason`, `workerTaskPackets`, `dependencyPolicy`
- Review: checks upstream Critical/Fetch/Thinking quality before result polish

Normal chat output for these stages must be localized, compact, and human-readable. Packet field names such as `realIntent`, `decisionImpactMap`, or `workerTaskPackets` may appear when useful, but they must be paired with human labels instead of being dumped as unexplained English keys.

Governance-quality fallback is forbidden. Missing intent, evidence, design, owner, capability, dependency readiness, or worker work order means `block`, `return_to_stage`, or `capabilityGapPacket`. Runtime compatibility fallback may remain for host limitations such as a chat card instead of a popup, but it does not count as governance readiness.

## Business Flow Before Execution

For executable work, plan the business flow before writing code or changing files. This is a dynamic workflow step, not a fixed checklist: classify the user's natural-language intent, choose lanes from evidence and dependency signals, and record omitted lanes with reasons. A web app, for example, may need separate lanes for:

- product direction
- UX flow
- UI system
- frontend
- backend
- database
- auth / security
- motion / interaction polish
- tests / QA
- release / install path
- feedback and evolution

Hard rules before Execution:

- Fuzzy goals require intent amplification and an acceptance record.
- Multi-path work requires best-path selection.
- Multi-lens judgment uses dynamic lens discovery; user-mentioned books, people, or theories are seeds/fallbacks, not a fixed list.
- Execution requires owner + weapon + verification owner.
- Dependency projects require input/output contracts before use.
- Codex subagents require explicit request or explicit governed task need, and hooks require trust review.
- OpenClaw skills require third-party risk and sandbox review.
- Cursor capabilities remain unknown/partial until verified; do not mark them native from projection files alone.
- Public-ready requires verification plus intent acceptance; workflow completion alone is not user-goal completion.
- Evolution must write back or record none-with-reason.

Not every task needs every lane. Do not force every wish-style request through the same lane set; omitted lanes should be intentional. The business-flow blueprint should explain:

- what user pain/value and success standard the run serves
- what capability is needed
- which existing agent / skill / tool was found
- whether an owner is reused, upgraded, or newly created
- which expert lenses are relevant and which are explicitly not applicable
- which lanes can run in parallel
- who merges the outputs
- how the result will be reviewed and verified

## Agent Display Names

Separate these three names:

- `ownerAgent`: the real governance or execution owner, for example `meta-conductor` or `frontend-developer`
- `roleDisplayName`: the short user-visible English business role family, for example `frontend`, `backend`, or `test`
- `runtimeInstanceAlias`: the host runtime's incidental nickname, if any

Rules:

- Do not show host-generated personal names as the primary agent name.
- Prefer short role names over long task descriptions.
- Do not put concrete work items into `roleDisplayName`; put shard or task scope in `roleInstanceId`, `shardScope`, `parallelGroup`, `dependsOn`, `mergeOwner`, and collision boundaries.
- If the same owner runs multiple parallel instances, keep the same coarse `roleDisplayName` and separate instances with `roleInstanceId`.

## Eight-Stage Spine

Meta_Kim's execution backbone is:

```text
Critical -> Fetch -> Thinking -> Execution -> Review -> Meta-Review -> Verification -> Evolution
```

The 11-phase business workflow is separate:

```text
direction -> planning -> execution -> review -> meta_review -> revision -> verify -> summary -> feedback -> evolve -> mirror
```

The relationship is simple:

- the 8-stage spine governs execution logic
- the business workflow governs run packaging and deliverable closure
- business phases do not rename or replace the spine

## Hidden Governance Packets

A governed run should leave enough structure to audit what happened. Important packets include:

- `taskClassification`
- `cardPlanPacket`
- `businessFlowBlueprintPacket`
- `agentBlueprintPacket`
- `dispatchEnvelopePacket`
- `workerTaskPacket`
- `reviewPacket`
- `revisionResponses`
- `verificationResults`
- `summaryPacket`
- `evolutionWritebackPacket`

Do not claim a run is public-ready unless verification passed, summary closure exists, a single primary deliverable was maintained, and the deliverable chain is closed.

## Planning Files

When `planning-with-files` is installed and the task is not a pure query, create persistent planning state at Stage 3:

- `task_plan.md`
- `findings.md`
- `progress.md`

Do not infer that `planning-with-files` is missing only because it is absent from `.agents/skills/`. It is a core external dependency declared in `config/skills.json` and normally installed into runtime home skill directories such as `~/.codex/skills/planning-with-files/`, `~/.claude/skills/planning-with-files/`, `~/.cursor/skills/planning-with-files/`, or `~/.openclaw/skills/planning-with-files/`. Check the manifest, global runtime homes, and `npm run discover:global` before declaring it unavailable.

These files supplement protocol packets. They do not replace `businessFlowBlueprintPacket`, `dispatchEnvelopePacket`, or verification evidence. The Conductor or the main thread acting as Conductor is the sole writer.

## The Nine Meta Agents

- `meta-warden`: coordination, arbitration, final synthesis, Warden gate
- `meta-conductor`: workflow, stage sequencing, business-flow blueprint, rhythm control
- `meta-genesis`: `SOUL.md`, identity, persona, prompt architecture
- `meta-artisan`: skill / MCP / tool fit, capability loadout
- `meta-sentinel`: safety boundaries, permissions, hooks, rollback
- `meta-librarian`: memory, continuity, context policy
- `meta-prism`: quality review, drift detection, anti-slop review
- `meta-scout`: external capability discovery and evaluation
- `meta-chrysalis`: evolution signal aggregation and writeback coordination through Warden's gate

Meta agents govern. They do not become generic implementation workers when a better execution specialist exists.

## Correct Execution Shape

Anti-pattern:

```text
User: build a notification system
Assistant: immediately edits ten files as one undifferentiated worker
```

Correct pattern:

```text
User: build a notification system
Assistant:
1. Critical: clarify material ambiguity
2. Fetch: discover existing capabilities
3. Thinking: map lanes, owners, dependencies, and merge plan
4. Execution: dispatch bounded work to the right agents / skills
5. Review: inspect outputs against quality and boundaries
6. Meta-Review: verify the review standard when risk is high
7. Verification: run fresh checks
8. Evolution: record reusable patterns or decide no writeback
```

## Graphify

This repository has a knowledge graph under `graphify-out/`.

Rules:

- For broad architecture or codebase questions, use existing `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` as navigation indexes when present.
- Do not run a startup freshness gate merely because a graph exists. At the start of a run, check only whether graph artifacts are present and useful enough for navigation.
- Treat Graphify as a project map, not the final source of truth. Use graph queries or subgraph extraction to find relevant modules, concepts, and file anchors, then verify route-changing claims against the target source files.
- Agent and worker context should receive only graph slices, short hints, and file anchors relevant to that worker. Do not inject the full `graph.json`, full `GRAPH_REPORT.md`, or broad graph dumps into every worker.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Dirty `graphify-out/` files can be expected after hooks or incremental updates; dirty graph files are not a reason to skip graph context.
- `npm run meta:graphify:check` and `npm run meta:validate` compare the graph's built commit with current `git rev-parse HEAD` and fail when `GRAPH_REPORT.md` is stale. Use this as a verification/release/public-ready gate, not as a routine run-start cost.
- After modifying code files, run `npm run meta:graphify:rebuild` to keep the graph current across Windows, macOS, and Linux.

## Maintenance Loop

After changing canonical behavior, contracts, hooks, or runtime-facing docs:

1. `npm run meta:sync`
2. `npm run discover:global`
3. `npm run meta:check`
4. `npm run meta:check:global`
5. `npm run meta:release:smoke` before routine patch/minor release; use `npm run meta:verify:all` only for larger, risky, runtime, install, hook, dependency, or explicitly release-grade changes

Use these supporting commands as needed:

- `npm run meta:validate`
- `npm run meta:check:runtimes`
- `npm run meta:check:sync-coverage`
- `npm run meta:doctor:governance`
- `npm run meta:eval:agents`
- `npm run meta:eval:agents:live`
- `npm run meta:validate:run -- <artifact.json>`
- `npm run meta:index:runs -- <artifact-dir-or-file>`
- `npm run meta:query:runs -- --owner <agent>`
- `npm run migrate:meta-kim -- <source-dir> --apply`
- `npm run meta:graphify:check`
- `npm run meta:graphify:rebuild`
- `npm run meta:deps:install`
- `npm run meta:deps:install:all-runtimes`
- `npm run meta:deps:update`
- `npm run meta:deps:update:all-runtimes`
- `npm run meta:sync:global`
- `npm run prompt:next-iteration`

`npm run meta:release:smoke` is the default maintainer release check for low-risk prompt/doc/governance iterations. It runs projection sync, default capability-discovery smoke, and meta-theory tests. `npm run meta:verify:all` remains the full release-grade suite: runtime sync checks, project validation, graphify health, global sync checks, smoke-level runtime acceptance, setup tests, and meta-theory tests.

## Release Modes

Routine patch/minor releases should stay fast. If the change is prompt text, docs, changelog, version metadata, or narrow governance wording with no runtime wiring change, the default release path is:

1. `npm run meta:sync`
2. `npm run meta:capabilities:smoke`
3. `npm run meta:test:meta-theory`
4. `git diff --check`

This can be run directly as `npm run meta:release:smoke`, followed by `git diff --check`.

Upgrade to full release-grade verification only when the task changes install/update behavior, global sync, hooks, runtime matrix, provider registry, dependency compatibility, runtime probes, package contents, security-sensitive behavior, or when the user explicitly asks for full/live/release-grade evidence.

Release-grade work is stricter than a local green check. In that mode, before commit, push, tag, changelog/release-note update, or publication, the run must have current evidence for:

- all declared runtime install/update targets; if machine-local defaults select only one runtime, use explicit all-runtime target selection
- project sync, global sync, and global hooks when hooks are in scope
- runtime matrix, provider registry, dependency compatibility, and runtime probe
- a real execution-demand route that naturally selects owner, creation providers, skill, MCP provider, command/runtime tool, and verification owner/path
- live Claude, Codex, and OpenClaw evidence when those live targets are declared

Do not treat structural smoke, systemMessage/UI warning output, auth-present checks, skipped/needsAuth states, or config-only proof as live pass evidence. Those are valid diagnostics, not live completion. Validators and gates protect against empty or dangerous routes; they are not the primary mechanism that makes the default path correct.

## Install And Packaging Notes

- Node must satisfy the `package.json` engine requirement.
- `package.json` uses a `files` whitelist so GitHub / npm tarballs include the full `canonical/` tree.
- `node setup.mjs` installs selected platform projections and graphify wiring idempotently.
- Runtime target selection has two layers: repo defaults in `config/sync.json`, machine-active targets in `.meta-kim/local.overrides.json`.
- MCP Memory Service uses port `8000`.
- `stop-memory-save.mjs` saves session summaries to the MCP Memory Service on session end.

## Reading Order

For maintainers:

1. `README.md` or `README.zh-CN.md`
2. `AGENTS.md`
3. `CLAUDE.md` when touching Claude Code behavior
4. This `AGENTS.md` Mechanical Enforcement section when changing cross-runtime trigger, hook, review, verification, stop, or writeback behavior
5. `canonical/skills/meta-theory/references/dev-governance.md` for the long-form governed execution contract

## 重启交接记录（2026-05-21）

以下内容是本次会话的交接记录，供重启电脑后继续工作使用。

### 一、本地仓库状态

- 当前目录：`D:/knowledgeBase/Meta_Kim`
- 本地代码已从你的 fork 克隆完成。
- `origin`：`https://github.com/chouyong/Meta_Kim.git`
- `upstream`：`https://github.com/KimYx0207/Meta_Kim.git`
- 当前分支：`main`

### 二、与 upstream 的同步结果

已执行并确认：

- `git fetch upstream`
- 比较了 `main`、`origin/main`、`upstream/main`

结果：

- `main` = `e1ec4f99f15ab6eb72e8a16f2f56c6b1f6ac5d84`
- `origin/main` = `e1ec4f99f15ab6eb72e8a16f2f56c6b1f6ac5d84`
- `upstream/main` = `e1ec4f99f15ab6eb72e8a16f2f56c6b1f6ac5d84`
- `git rev-list --left-right --count main...upstream/main` 结果为 `0 0`

结论：

- 当前本地仓库已经和 `upstream` 最新代码完全同步。

补充：

- `git status` 时出现过 `C:/Users/zhouy/.config/git/ignore` 的权限警告。
- 该警告不影响仓库克隆、fetch 和同步判断。

### 三、项目用途说明

这个仓库不是传统意义上“启动一个网站”或“运行一个后端服务”的项目。

它的核心用途是：

- 为 `Claude Code`、`Codex`、`OpenClaw`、`Cursor` 提供一层统一的治理和工作流配置
- 通过 `canonical/` 作为源，再投影到各运行时目录

### 四、已确认的使用入口

已检查的关键文件：

- `README.zh-CN.md`
- `docs/QUICKSTART.md`
- `package.json`
- `bin/meta-kim.mjs`
- `setup.mjs`

已确认的入口和命令：

- 安装入口：`node setup.mjs`
- 快速检查：`node setup.mjs --check`
- 中文安装：`node setup.mjs --lang zh-CN`
- npm 脚本安装入口：`npm run meta:setup:install`

### 五、常用命令记录

安装完成后常用命令：

- `npm run meta:status`
- `npm run meta:sync`
- `npm run meta:validate`
- `npm run meta:doctor:governance`
- `npm run meta:check`
- `npm run meta:verify:all`

用途说明：

- `meta:status`：查看当前安装和投影状态
- `meta:sync`：把 canonical 配置同步到 `.claude/`、`.codex/` 等运行时目录
- `meta:validate`：校验项目完整性
- `meta:doctor:governance`：做治理相关自检
- `meta:check`：执行同步检查和校验
- `meta:verify:all`：执行更完整的全量校验

### 六、环境确认

本机当前已确认：

- Node 版本：`v25.0.0`
- 项目要求：`>= 22.13.0`

结论：

- Node 版本满足项目运行要求。

### 七、后续建议动作

重启电脑后，建议按这个顺序继续：

1. 进入仓库目录：`D:/knowledgeBase/Meta_Kim`
2. 先执行环境检查：`node setup.mjs --check`
3. 如准备正式安装，执行：`node setup.mjs --lang zh-CN`
4. 安装后查看状态：`npm run meta:status`
5. 如需同步运行时配置，执行：`npm run meta:sync`

### 八、下次继续时可直接承接的任务

重启后可以直接继续以下任一项：

- 实际执行 `node setup.mjs --lang zh-CN` 完成安装
- 检查安装后给 `Codex` / `Claude Code` 写入了哪些配置
- 继续梳理本仓库的目录结构和维护方式
- 开始修改仓库内容，并在修改后执行 `meta:sync` 与 `meta:validate`

## Meta_Kim Memory Service 修复记录（2026-05-28）

### 问题现象

开机后弹出 `Meta_Kim MCP Memory Service` 警告，提示服务启动失败，或 `http://127.0.0.1:8000` 没有变为 healthy。Codex 启动时也可能出现 MCP startup incomplete，但 `mempalace-docker`、`modao-proto-mcp` 与这个弹窗不是同一个服务。

### 根因

- 开机脚本位于 `C:/Users/zhouy/.meta-kim/mcp-memory-start.ps1`。
- 原脚本强制设置了 `HF_HUB_OFFLINE=1` 和 `TRANSFORMERS_OFFLINE=1`。
- 本机没有完整缓存 `sentence-transformers/all-MiniLM-L6-v2`，而离线模式禁止联网下载模型。
- `mcp-memory-service` 因 embedding 模型初始化失败，无法启动 HTTP 服务。
- 后续复测又发现 Windows 当前 TCP excluded port range 包含 `11351-11450`，Ollama 默认端口 `11434` 落在该保留区间内，因此 `ollama serve` 会报 `listen tcp 127.0.0.1:11434 ... forbidden by its access permissions`。
- 因为 `11434` 不能监听，依赖 Ollama embedding 的 Memory Service 开机检查会误判 Ollama 不可用，并弹出 `Meta_Kim MCP Memory Service` 警告。

### 已采用的修复

本机已经安装并运行 Ollama，且存在 `nomic-embed-text` 模型。因此修复方式是不再依赖 Hugging Face 下载，而是让 Memory Service 使用 Ollama 的 OpenAI-compatible embedding API：

- `OLLAMA_HOST=127.0.0.1:11734`
- `MCP_EXTERNAL_EMBEDDING_URL=http://127.0.0.1:11734/v1/embeddings`
- `MCP_EXTERNAL_EMBEDDING_MODEL=nomic-embed-text`
- `MCP_MEMORY_STORAGE_BACKEND=sqlite_vec`
- `MCP_ALLOW_ANONYMOUS_ACCESS=true`
- `NO_PROXY=127.0.0.1,localhost`
- 保留本机代理：`HTTP_PROXY=http://127.0.0.1:18080`、`HTTPS_PROXY=http://127.0.0.1:18080`、`ALL_PROXY=socks5://127.0.0.1:1080`

脚本同时会先检查：

1. `http://127.0.0.1:8000/api/health` 是否已经 healthy。
2. `http://127.0.0.1:11734/v1/embeddings` 是否能用 `nomic-embed-text` 返回 embedding。
3. 如果 embedding 不可用，先用 `OLLAMA_HOST=127.0.0.1:11734` 后台启动 `ollama serve`。
4. 只有 Ollama embedding 可用时才启动 `memory.exe server --http`。

已通过 `setx OLLAMA_HOST 127.0.0.1:11734` 写入用户级持久环境变量，避免 Ollama 桌面程序下次登录时继续尝试默认的 `11434`。

### 验证结果

已执行完整复测：

- 停止旧的 `memory.exe`。
- 运行 `C:/Users/zhouy/.meta-kim/mcp-memory-start.ps1`。
- 访问 `http://127.0.0.1:11734/api/tags`，能看到 `nomic-embed-text:latest`。
- 访问 `http://127.0.0.1:11734/v1/embeddings`，能返回 embedding。
- 访问 `http://127.0.0.1:8000/api/health`。
- 返回 `{"status":"healthy"}`。
- 确认 `8000` 由单个 `memory.exe`/`python.exe` 子进程监听，没有残留的 `mcp-memory-start.ps1`。

### 下次排障顺序

如果再次出现这个弹窗，优先按以下顺序检查：

1. 确认 `11434` 是否仍在 Windows excluded port range：`netsh interface ipv4 show excludedportrange protocol=tcp`。如果 `11351-11450` 仍存在，不要再用 `11434`。
2. 确认 Ollama 已在替代端口启动：访问 `http://127.0.0.1:11734/api/tags`。
3. 确认 embedding 可用：访问 `http://127.0.0.1:11734/v1/embeddings`，模型使用 `nomic-embed-text`。
4. 确认 Memory Service 健康：访问 `http://127.0.0.1:8000/api/health`。
5. 查看日志：`C:/Users/zhouy/.meta-kim/mcp-memory.err.log`。
6. 如出现多个 `memory.exe` 或残留 `mcp-memory-start.ps1`，先清理残留进程，再单实例启动。
7. 如果日志提示 external embedding dimension 为 `768`，这是 `nomic-embed-text` 的维度提示；只要健康检查通过，不是启动失败。

## Codex Memory Hook 超时修复记录（2026-05-28）

### 问题现象

Codex 启动或提交提示词时出现：

- `SessionStart hook (failed): error: hook timed out after 10s`
- `UserPromptSubmit hook (failed): error: hook timed out after 10s`

### 根因

- Codex hook 外层超时时间是 10 秒。
- `canonical/runtime-assets/shared/hooks/meta-kim-memory-save.mjs` 的 `UserPromptSubmit` 路径会串行执行多次 `/api/search` 和 `/api/memories`。
- 每次 HTTP 请求原超时上限较长，Memory Service 稍慢或 Ollama embedding 冷启动时，整条 hook 链路会超过 10 秒。

### 已采用的修复

- 将通用 Memory Service HTTP 默认超时降到较短预算：
  - `META_KIM_MEMORY_HTTP_TIMEOUT_MS` 默认 `1000`。
  - `META_KIM_MEMORY_HEALTH_TIMEOUT_MS` 默认 `300`。
- 为 Codex 单独增加快速预算：
  - `META_KIM_CODEX_RECALL_BUDGET_MS` 默认 `2500`。
  - `META_KIM_CODEX_POST_BUDGET_MS` 默认 `1200`。
- Codex 的 recall 改为快速路径：
  - 只取一个主查询。
  - 并行读取 search 和 recent memories。
  - 超过预算直接返回空召回，不阻塞 Codex。
- Memory 写入也加预算，超时就跳过本轮写入，保证 hook 不拖死 Codex。

### 修改和同步位置

- canonical 源：`D:/knowledgeBase/Meta_Kim/canonical/runtime-assets/shared/hooks/meta-kim-memory-save.mjs`
- 项目 Codex hook：`D:/knowledgeBase/Meta_Kim/.codex/hooks/meta-kim-memory-save.mjs`
- 用户全局 Codex hook：`C:/Users/zhouy/.codex/hooks/meta-kim-memory-save.mjs`

已运行：

- `npm run meta:sync`
- `npm run meta:check`
- `graphify update .`

### 验证结果

已验证：

- `node --check` 通过：canonical hook、项目 `.codex` hook、用户全局 hook。
- 模拟 `SessionStart` 输出合法 `hookSpecificOutput` JSON，约 `1.3s` 返回。
- 模拟 `UserPromptSubmit` 输出合法 `hookSpecificOutput` JSON，后续在 Memory Service healthy 后约 `514ms` 返回。
- `http://127.0.0.1:8000/api/health` 返回 `{"status":"healthy"}`。
- 用户全局 hook 文件前 4 字节为 `23 21 2F 75`，即 `#!/u`，确认无 UTF-8 BOM。

### 下次排障顺序

如果再次出现 Codex hook timeout：

1. 先确认 `http://127.0.0.1:8000/api/health` 是否 healthy。
2. 确认 `http://127.0.0.1:11734/v1/embeddings` 是否能返回 embedding。
3. 用模拟输入运行用户全局 hook，观察耗时是否低于 10 秒。
4. 检查 `C:/Users/zhouy/.codex/hooks/meta-kim-memory-save.mjs` 是否包含 `fastRecallMemories`、`withTimeout`、`META_KIM_CODEX_RECALL_BUDGET_MS`。
5. 如果要临时停用自动启动 Memory Service，可设置 `META_KIM_DISABLE_MEMORY_AUTOSTART=1`。

## Codex Memory Hook 上下文注入修复记录（2026-05-28）

### 问题现象

其他 Codex 终端启动或提交提示词时出现：

- `SessionStart hook (failed): hook returned invalid session_start JSON output`
- `UserPromptSubmit hook (failed): hook returned invalid user_prompt_submit JSON output`

### 根因

`meta-kim-memory-save.mjs` 原先在 `SessionStart` / `UserPromptSubmit` 时向 stdout 输出旧的跨运行时 JSON：

```json
{"systemMessage":"...","message":"...","continue":true}
```

当前 Codex hook 校验不接受这个格式，因此即使 hook 退出码为 0，也会被 Codex 判定为 invalid JSON output。

### 已采用的修复

Codex 侧 memory hook 保持两项能力：

1. 继续把会话检查点写入 Meta_Kim MCP Memory Service。
2. 继续向 Codex 注入 recalled memory context。

但 stdout 输出格式改为 Codex 接受的事件专用格式：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "..."
  }
}
```

`SessionStart` 时 `hookEventName` 为 `SessionStart`，`UserPromptSubmit` 时 `hookEventName` 为 `UserPromptSubmit`。

### 修改位置

- 项目 hook：`D:/knowledgeBase/Meta_Kim/.codex/hooks/meta-kim-memory-save.mjs`
- canonical 源：`D:/knowledgeBase/Meta_Kim/canonical/runtime-assets/shared/hooks/meta-kim-memory-save.mjs`
- 用户全局 hook：`C:/Users/zhouy/.codex/hooks/meta-kim-memory-save.mjs`

用户全局 hook 文件需要保持 UTF-8 无 BOM；如果 PowerShell 写入时产生 BOM，Node 会在 shebang 第一行报 `Invalid or unexpected token`。

### 验证结果

已验证：

- `node --check` 三份 `meta-kim-memory-save.mjs` 均通过。
- 模拟 `SessionStart` 输出合法 JSON，且 `hookSpecificOutput.hookEventName` 为 `SessionStart`。
- 模拟 `UserPromptSubmit` 输出合法 JSON，且 `hookSpecificOutput.hookEventName` 为 `UserPromptSubmit`。
- 用户全局 hook 文件前 4 字节为 `35 33 47 117`，即 `#!/u`，确认没有 UTF-8 BOM。
- 已运行 `graphify update .`。

### 下次排障顺序

如果再次出现 Codex hook JSON output 错误，优先检查：

1. `C:/Users/zhouy/.codex/hooks/meta-kim-memory-save.mjs` 是否仍使用 `hookSpecificOutput.additionalContext`。
2. `hookSpecificOutput.hookEventName` 是否匹配当前事件：`SessionStart` 或 `UserPromptSubmit`。
3. 用户全局 hook 文件是否无 BOM。
4. 用模拟输入运行 hook，确认 stdout 是单个合法 JSON 对象。
5. 如果上下文重复注入，检查全局 hook 和项目 hook 是否同时启用；重复不等同于 JSON output 错误。

## 上游同步与 Codex Hook 去重合并记录（2026-05-28）

### 上游同步结果

已通过本机 HTTP 代理 `http://127.0.0.1:18080` 执行：

- `git fetch upstream`
- `git fetch origin`
- `git merge --ff-only upstream/main`

同步后：

- `main` = `upstream/main` = `3e8c2e5e0d44723ed970283103e1ffd23a3b7814`
- `git rev-list --left-right --count main...upstream/main` 结果为 `0 0`
- 本地 `main` 相对 `origin/main` 领先上游同步带来的提交，推送前应先确认是否要更新 fork。

### 合入的上游默认设计

上游 `canonical/runtime-assets/shared/hooks/meta-kim-memory-save.mjs` 已包含跨全局 / 项目 hook 的去重逻辑：

- `DEDUPE_WINDOW_MS = 10000`
- `stableHookId(payload, runtime, cwd, event, prompt)`
- `shouldSkipDuplicate(payload, runtime, cwd, event, prompt)`
- `META_KIM_DISABLE_HOOK_DEDUPE=1` 可关闭去重

该逻辑使用 `runtime + event + cwd + session_id/turn_id + prompt` 生成稳定 ID，并在系统临时目录 `meta-kim-hook-dedupe` 中写 marker。全局 hook 和项目 hook 同时触发同一 Codex 事件时，先执行的一方写入 marker，后执行的一方在 10 秒窗口内静默跳过。

### 本地保留的 Codex 输出修复

合并上游去重逻辑时，保留了 Codex 当前版本需要的 stdout 格式：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "..."
  }
}
```

因此最终行为是：

1. 全局 hook 和项目 hook 可以同时存在。
2. 同一个 Codex 事件只保存 / 注入一次上下文。
3. Codex runtime 使用 `hookSpecificOutput.additionalContext`。
4. Claude runtime 仍使用 `hookSpecificOutput.additionalContext`。
5. Cursor runtime 仍使用 `{ "prompt": "..." }`。

### 修改和同步位置

- canonical 源：`D:/knowledgeBase/Meta_Kim/canonical/runtime-assets/shared/hooks/meta-kim-memory-save.mjs`
- 项目 Codex hook：`D:/knowledgeBase/Meta_Kim/.codex/hooks/meta-kim-memory-save.mjs`
- 用户全局 Codex hook：`C:/Users/zhouy/.codex/hooks/meta-kim-memory-save.mjs`

已运行 `npm run meta:sync`，将 canonical 变更投影到项目运行时目录。

### 验证结果

已验证：

- `node --check` 通过：canonical hook、项目 `.codex` hook、用户全局 hook。
- 用户全局 hook 前 4 字节为 `35 33 47 117`，即 `#!/u`，确认无 UTF-8 BOM。
- 快速连续运行同一模拟 `UserPromptSubmit`：项目 hook 输出一次，紧接着全局 hook 静默，证明去重生效。
- `npm run meta:check` 通过。
- `graphify update .` 已运行。

### 下次排障顺序

如果再次出现重复注入，优先检查：

1. 三份 `meta-kim-memory-save.mjs` 是否都有 `shouldSkipDuplicate`。
2. Codex 分支是否为 `runtime === "claude" || runtime === "codex"` 时输出 `hookSpecificOutput.additionalContext`。
3. 是否设置了 `META_KIM_DISABLE_HOOK_DEDUPE=1`。
4. 两次 hook 触发是否超过 `DEDUPE_WINDOW_MS`。
5. 模拟测试时要在同一个 shell 调用中连续运行项目 hook 和全局 hook，避免人工/模型处理时间超过 10 秒窗口。

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
