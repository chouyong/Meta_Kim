# Runtime Capability Matrix

Meta_Kim does not treat runtime names as proof of capability. A runtime capability claim must say what is supported, how it is triggered, where it is configured, which OS paths matter, and what evidence backs the claim.

The canonical data lives in `config/runtime-capability-matrix.json`. Use `npm run meta:runtime:probe` for local evidence and `npm run meta:runtime:validate` for static checks.

## Runtime Notes

- Claude Code: strongest local projection for agents, skills, hooks, MCP, and subagent context. Windows shell behavior still needs explicit PowerShell/CMD/Git Bash/WSL handling.
- Codex: supports AGENTS.md, project skills, hooks, MCP, sandbox/approval, and explicit subagents. Subagents must not be auto-spawned unless the user or task explicitly requires them. Non-managed hooks need trust review.
- OpenClaw: workspace-first runtime with skills, workspaces, browser/tools, and hook-style automation. Treat Windows native and WSL2 separately, and mark third-party skills as risk before enabling.
- Cursor: light governance projection until native agents, hooks, and choice surfaces are verified. Rules and MCP are useful context/execution surfaces, not proof of native choice popups.

## Pass / Fail

- Pass: every platform capability has support, trigger, OS support, and evidence.
- Fail: `support = native` with `confidence = unverified`.
- Fail: Cursor hooks or native choice are marked native without proof.
- Fail: Windows/macOS paths are collapsed into one assumption.
