## Findings

Reviewer: Claude (Opus 5), acting as the independent read-only reviewer.
Method: `Claude CLI read-only safe-mode`; tools limited to Read/Glob/Grep; no command execution, no writes, no delegation to Codex, subagents, or other models.

Artifact under review: `.meta-kim/recovery/cross-model-lock-skill-staging-20260826/deploy_project_chain_mutex_v2.ps1` (read at 167 lines, matching the notice's declared evidence file path).

### F1 — V1 gate is correctly fail-closed (PASS)
`$legacyMutex.WaitOne(0)` (line 75) is non-blocking, and a `false` result throws (lines 80-82) before any filesystem mutation. `AbandonedMutexException` is caught and treated as acquired (lines 77-79), which matches .NET semantics: ownership is transferred to the caller when the previous owner died. Release happens in the outer `finally` (lines 157-167) with a nested `finally` that always calls `Dispose()`, and release is guarded by `$legacyAcquired`, so `ReleaseMutex` cannot be called by a non-owner. Ordering is correct for the stated safety property: `catch` (rollback) executes before `finally` (release), so V1 is never released while a partially applied set is on disk.

### F2 — Drift whitelist is exact and closed (PASS)
For each entry (lines 84-112) the target is accepted only when its SHA-256 equals the candidate hash or the D-drive `original/` hash (lines 91-103). Both sides are normalized to lowercase by `Get-Sha256` (line 17), so the `-notin` comparison is well-formed. Two additional rules are enforced correctly:
- Missing candidate → throw (lines 85-87).
- Target absent while an `original/` baseline exists → throw "Expected installed target is missing" (lines 104-106), so an upgrade entry cannot silently become a fresh install.
- Conversely, for the 7 new helper/test/eval entries (no `OriginalPath`), an existing target is only tolerated if it is already byte-identical to the candidate. An unknown pre-existing file at those paths is rejected. This is the desired closed behavior.

Validation is a full pre-pass over all 15 entries before the first byte is written (the write loop starts at line 115), so a drifted target anywhere aborts with zero mutations.

### F3 — Ordering, backup, and per-file hash verification (PASS)
The install loop sorts by `Order, Id` (line 115), yielding helper/test/eval (10/20) → SKILL.md (30) → invokers (40) → rules (50). Helpers therefore exist before any invoker that dot-sources `project_chain_mutex.ps1` is installed; I confirmed the candidate invoker hard-fails if the helper is absent (`candidate/codex-review/scripts/invoke_claude_review.ps1:29-33`). Backups are written under the D-drive staging root in a UTC-millisecond-stamped directory (line 71) using `Copy(..., overwrite: false)` (line 118); all 15 `Id` values are unique, so `.bak` names cannot collide. Each destination is re-hashed and compared case-sensitively against the candidate hash immediately after copy (lines 123-126).

### F4 — `touched` is recorded after the copy, not before (non-blocking defect)
Line 121 performs the copy and line 122 registers the entry in `$touched`. If `File.Copy` itself throws after writing partial content (disk-full or mid-stream I/O error), the entry is absent from `$touched` and the rollback loop (lines 147-154) will skip it, leaving a truncated target on disk even though a valid `.bak` exists beside it. Recording the entry before attempting the copy would close this in-script. Bounded because: open-time failures (ACL, sharing violation) leave the target untouched; the run throws loudly; and the backup remains recoverable manually. The notice's Known Gaps already concede disk-full/host-level failures.

### F5 — Rollback loop has no per-file error containment (non-blocking defect)
With `$ErrorActionPreference = 'Stop'`, a failure restoring one file inside the rollback loop (lines 147-154) aborts the loop, so the remaining touched files are never restored, and the new exception replaces the original — `throw $deploymentError` (line 155) is never reached, so the operator loses the root cause. A per-entry `try/catch` that continues and aggregates failures alongside the original error would make rollback best-effort rather than all-or-abort. Bounded because a locked target cannot be restored by any PowerShell path, which the notice discloses.

### F6 — Directories created during validation are not rolled back (informational)
`CreateDirectory` on target parents (lines 108-111) is not tracked in `$touched`, so a failed run can leave empty `scripts\` / `evals\` directories. No half-upgrade risk; residue only.

### F7 — V1 does not exclude newly installed V2 invokers (informational)
The candidate invokers no longer take `Local\CodexClaudeCliSingleChainV1`; they take the project-scoped V2 mutex. Consequently, in the window between Order 40 (invokers installed) and Order 50 completion (rules installed), a freshly launched V2 invoker is not blocked by the deployer's V1 hold. Effect is limited to running V2 code against not-yet-updated rules text; the locking contract itself stays correct in both directions. The window is short and no mixed helper/invoker pairing is reachable, since helpers precede invokers.

### F8 — Backup integrity is not verified (informational)
Backup copies are not re-hashed after creation, so a silently corrupt `.bak` would be restored as-is during rollback. Low likelihood; noted for completeness.

No blocking defect was found on the reviewed question: the deployer cannot begin while a V1 chain is live, cannot overwrite an unrecognized target, and restores or deletes every file it successfully replaced before releasing V1.

## Actions Executed and Not Executed

Executed (read-only):
- Read the notice, the deployer script, and `MUTEX_V2_VERIFICATION_R1.md`.
- Read the candidate Codex-side invoker and both copies of `validate_review_exchange.ps1` solely to confirm the deployer's install ordering and entry-table coverage assumptions.
- Globbed the staging tree (34 files) to check the 15-entry table against what exists under `candidate/` and `original/`.
- Grepped for `CodexClaudeCliSingleChain` to confirm which components still reference V1.

Not executed:
- No deployment, no command or script execution, no Bash.
- No Write/Edit of any file, including the plan file: creating a C-drive review document is forbidden by the notice's Forbidden Actions, so this receipt is returned inline rather than written to disk. The receipt file at the notice's target path was not created by me.
- No hash recomputation (`Get-FileHash` unavailable under read-only tooling), so the notice's EVIDENCE SHA-256 values and `NOTICE_SHA256` were not independently verified.
- No Codex, subagent, Agent tool, or other model invoked. No commit, push, credential access, or outbound message.

## Review Scope

Answered exactly one question: whether `deploy_project_chain_mutex_v2.ps1` installs the V2 candidate fail-closed and transactionally while a legacy V1 chain may exist, rejects unknown target drift, and restores every touched file after a mid-run failure. Covered: V1 acquire/release, drift whitelist, new-vs-existing file existence rules, backup creation, overwrite ordering, `touched` bookkeeping timing, reverse-order rollback, new-file deletion, destination hash verification, and `finally` structure.

Out of scope and not assessed: helper mutex-identity correctness, regression scripts, invoker business semantics, SKILL.md wording, and release readiness.

## Evidence Gaps

- No fault-injection run exists; F4 and F5 are source-level inferences about exception paths, not observed behavior.
- Declared SHA-256 values in the notice (deployer, verification doc, `NOTICE_SHA256`) were accepted as given; I could not recompute them.
- The `PREDEPLOY_HASH_BASELINE_PASS` claim of 8 clean installed targets concerns `%USERPROFILE%` paths outside the project; I did not inspect the installed tree.
- Post-deployment verification (installed hashes plus a re-run of the mutex regression) has not happened and remains required.

## Residual Risks

- A mid-stream copy failure can leave one truncated target unrestored (F4); a rollback-time failure can halt recovery of the remaining files and mask the original error (F5).
- `File.Copy` provides no cross-file atomicity; correctness depends on the V1 gate, the D-drive backups, and the rollback path.
- Host-level events — ACL changes, disk exhaustion, process kill, power loss — can leave a half-applied set no PowerShell `catch` can repair; the timestamped backup directory is then the only recovery route.
- Empty directories may persist after a failed run (F6).
- A V2 invoker started during the late deployment window may run with stale rules text (F7).

FINAL_DECISION: GO
