## Findings

1. **[P3] all three invokers / `project_chain_mutex.ps1`**: The "shared helper" is three physically separate copies (`codex-review/scripts/project_chain_mutex.ps1`, `claude-review/scripts/project_chain_mutex.ps1`, `claude-develop/scripts/project_chain_mutex.ps1`), each dot-sourced from its own `$PSScriptRoot`. Line-for-line structure is identical (same symbols at lines 107/124/128/150/157/160, same `Local\CodexClaudeCliProjectChainV2-$digest` at line 160), so the three directions do compute the same name today, but mutual exclusion rests on copy-equality maintained by convention rather than on one file. The notice pins a SHA256 for only one copy.
   - Why it matters: a future edit to one copy silently splits the lock namespace, and each side would still report `MutexKeyVersion: v2` while no longer excluding the other. Non-blocking for this round because the identity is derived (volume serial + file index, or `path:` off-Windows), not from anything copy-local.

2. **[P3] `claude-review/scripts/invoke_codex_review.ps1:2152-2172`** (DryRun release branch): `ReleaseMutex` failure is recorded as `MutexReleaseResult = 'error:<Type>'` and `$hasMutex` is left `$true`, whereas the non-DryRun branch (2194-2202) lets a release failure propagate. `Dispose()` still runs in the inner `finally`, and `Assert-DryRunEvidenceFacts:225` requires `MutexReleaseResult -ceq 'released'`, so a swallowed failure still fails the run closed via the evidence gate rather than being lost.
   - Why it matters: the two branches differ in where the failure surfaces; the DryRun path depends on the evidence assertion (which runs after the `finally`, at 2217) rather than on the throw itself. Behaviourally fail-closed, but the asymmetry is worth knowing before deployment.

Verified equal across all three invokers, with no defect found:

- **Recursion guard first, and before any lock.** `invoke_claude_review.ps1:233-235`, `invoke_codex_develop.ps1:236-238`, `invoke_codex_review.ps1:1805-1807` all test `CODEX_CLAUDE_CLI_CHAIN_ACTIVE` at `'Process'` scope and `throw` before `New-Object System.Threading.Mutex` (275 / 279 / 1851 respectively). A nested invocation therefore never touches the mutex at all.
- **Helper presence is a hard precondition.** Each script checks `Test-Path` on `project_chain_mutex.ps1` and throws `'Project-scoped model-chain mutex helper is missing.'` before dot-sourcing (lines 29-33 / 30-34 / 46-50). No fallback name is synthesised when the helper is absent.
- **Mutex name comes only from physical project identity.** All three call `Resolve-ProjectChainRootPath` then `Get-ProjectChainMutexName -ProjectRoot $root` (237-238 / 240-241 / 1822-1823). The digest input is `win32:<VolumeSerialNumber>:<FileIndexHigh><FileIndexLow>` from `GetFileInformationByHandle` (`project_chain_mutex.ps1:118-121`), so junctions/symlinks/case/trailing-slash variants of the same directory collapse to one name and distinct projects cannot collide. No user name, session id, or fixed global string participates; the prefix is `Local\`, never `Global\`.
- **Contention fails closed.** `WaitOne(0)` (non-blocking) with `AbandonedMutexException` → `$hasMutex = $true` (correct .NET semantics: the wait succeeded and ownership transferred), then `if (-not $hasMutex) { throw ... }` naming the mutex. No timeout, no retry, no proceed-anyway path (280-286 / 284-290 / 1890-1896).
- **Chain flag is set inside the held lock and cleared in a `finally`.** 317/349, 362/388, 1995/2085. The flag is process-scope so children inherit it; the clearing `finally` is nested inside the mutex `finally`, so ordering is release-after-clear on every path including throw.
- **Release/Dispose on all paths.** Each script wraps its whole body in `try { ... } finally { try { if ($hasMutex) { ReleaseMutex; $hasMutex = $false } } finally { Dispose } }` (368-378 / 400-410 / 2152-2210). `Dispose` is in an inner `finally`, so it runs even if `ReleaseMutex` throws. The early `return` on the DryRun path (305 / 324) exits through the same `finally`.
- **No residual V1 lock.** `CodexClaudeCliSingleChainV1` appears nowhere in any invoker or helper. Its only occurrences are the two `test_project_chain_mutex.ps1` regression guards that assert the V1 name is absent (`:176`), and prose in `claude-review/SKILL.md:45` / `codex-review/SKILL.md:52`. `invoke_codex_review.ps1:222` additionally enforces `^Local\\CodexClaudeCliProjectChainV2-[0-9a-f]{64}$` on the DryRun-reported name.

## Actions Executed and Not Executed

Executed (read-only): read the notice; read all four EVIDENCE-pinned files in full (`invoke_claude_review.ps1`, `invoke_codex_review.ps1` in two pages, `invoke_codex_develop.ps1`, `codex-review/scripts/project_chain_mutex.ps1`); one Glob over `candidate/**/*.ps1`; two Greps for `CodexClaudeCli*` and for the mutex/recursion symbol set (`New-Object System.Threading.Mutex`, `WaitOne`, `ReleaseMutex`, `Dispose`, `AbandonedMutex`, `Local\`/`Global\`, `SingleChain`, `UserName`) across the whole candidate tree.

Not executed: no command, script, test, or `DryRun` run; no `git` invocation; no SHA256 recomputation of the pinned files; no Write/Edit anywhere, including no C-drive document; no Codex, Claude sub-session, subagent, or other model called; no credential access; no outbound message. I did not read the two `test_project_chain_mutex.ps1` files beyond the grep hits, nor `validate_review_exchange.ps1`, `SKILL.md`, or the rules files, as they are out of the stated scope.

## Review Scope

Reviewer: Claude (Opus 5), method `Claude CLI read-only safe-mode`, tools limited to Read/Glob/Grep, working from `D:/knowledgeBase/Meta_Kim` at baseline `c63676224786c57fd242fffa36766174f47bc5c6`.

Scope was exactly the notice's single question: for each of the three staged candidate invokers, the recursion-env check order, helper presence/load, mutex name source, `WaitOne`/`AbandonedMutexException` handling, contention error, chain-env set/clear, nested `try`/`finally`, `ReleaseMutex`, `Dispose`, and the absence of any V1 or fixed global mutex. Excluded per the notice and not assessed: model prompts, response parsing and receipt schemas, auth/retry/timeout classification, the job-object process-ownership machinery in `invoke_codex_review.ps1` (lines ~382-1500), helper internals beyond how they produce the name, tests, and deployers.

## Evidence Gaps

- I did not verify the pinned SHA256 values; hashing requires an excluded tool. Findings therefore describe the file contents as read today, on Codex's assertion that the worktree is clean at the stated baseline.
- I did not byte-compare the three `project_chain_mutex.ps1` copies. Equality is inferred from identical symbol line numbers in the grep output plus identical content in the one copy I read in full — sufficient for "same name today", not a proof of byte-identity. This is the basis of finding 1.
- Codex's claims that the shared regression passed, that `RecursionGuardVerified=true`, and that same/different-project behaviour was confirmed from both entry points are unverified by me: I executed nothing. The recursion and contention conclusions above rest on reading the code paths, not on observing them run.
- `Get-WindowsProjectDirectoryIdentity` relies on `GetFileInformationByHandle` returning a stable `VolumeSerialNumber`/`FileIndex` for the directory. That is a runtime property of the filesystem (and does not hold on all remote/UNC filesystems); I could not measure it, only read the call. The off-Windows `path:` fallback (`project_chain_mutex.ps1:140`) is unexercised on this platform.
- The three invokers are staged and undeployed, so I reviewed candidate text, not what is currently installed.

## Residual Risks

- Copy drift between the three helper files would split the lock namespace while both sides still self-report `MutexKeyVersion: v2` (finding 1). A single shared file, or a deploy-time hash equality check across the three copies, would remove the risk rather than document it.
- The lock is `Local\`, so it serialises only within one Windows session/user context. Two different logon sessions on the same machine operating the same project would not exclude each other. This matches the stated intent ("only by project physical identity"), but it is a real boundary of the guarantee.
- `WaitOne(0)` means a legitimate second chain gets an immediate throw, not a queue. That is the intended fail-closed behaviour and does correctly prevent overlap; the operational cost is that a concurrent operator sees a hard failure and must rerun.
- If `GetFileInformationByHandle` ever returns a non-stable identity for the same directory (network redirector, some virtualised mounts), the digest changes and two chains on the same project would take different mutexes. The helper throws when the handle cannot be opened, so an unavailable identity fails closed; an unstable-but-readable identity would not.
- Finding 2's DryRun path depends on `Assert-DryRunEvidenceFacts` to convert a swallowed release failure into a failure, and that assertion runs after the `finally` block. It is reachable and does fire, but the guarantee is one step less direct than the non-DryRun throw.

Nothing found requires blocking: the mutex/recursion integration is consistent across the three invokers, keyed only to project physical identity, fails closed on contention, and releases and disposes on every success and exception path, with no V1 or fixed global lock remaining.

FINAL_DECISION: GO
