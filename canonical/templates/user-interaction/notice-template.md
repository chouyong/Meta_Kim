# Notice Template (No Popup)

Use this template for informational updates that do not require user choice.

## Format

```markdown
Meta governance active: {Current Stage} ({stageIndex}/{stageTotal}, {percent}%)

Completed: {completed stages or "none"}
Current: {plain-language work happening now}
Next: {next stage or "none"}
Blocked: {blocker or "none"}
```

This is the user-visible rendering of the `runStatusEnvelope` stored under `.meta-kim/state/{profile}/active-run.json` and `.meta-kim/state/{profile}/runs/{runId}/status.json`. It must stay short and must not expose internal protocol fields such as `Preflight`, `nativeChoiceSurface`, `conversation_fallback`, packet ids, or protocol traces unless the user explicitly asks for debug/audit/protocol details.

Render the labels and stage purpose in the user's explicit output language first, or latest input language when no explicit language was chosen. Keep only canonical protocol stage labels such as `Critical` and `Fetch` in English.

## Example

```markdown
Meta governance active: Thinking (3/8, 38%)

Completed: Critical, Fetch
Current: comparing viable paths and shaping the execution plan
Next: Execution
Blocked: none
```

## When to Use

- Stage transitions (Critical → Fetch → Thinking → ...)
- Progress updates during long-running operations
- Informational status that does not require branching logic
- User asks whether meta-theory governance is active or what stage it is in
