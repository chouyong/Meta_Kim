## Findings

Reviewer: Claude (Opus 5), acting as the independent read-only reviewer for this round.
Method: `Claude CLI read-only safe-mode`; tools limited to Read; no command execution, no writes, no delegation to Codex, subagents, Agent tools, or other models.

Artifact under review: `.meta-kim/recovery/cross-model-lock-skill-staging-20260826/deploy_project_chain_mutex_v2.ps1`, read in full at 183 lines. The notice's declared hash `c458...c835` was accepted as given (hashing is unavailable under read-only tooling); the file content read is consistent with the R2 change description, and differs from the R3C-reviewed 167-line version, so the R3C `GO` correctly does not carry over.

### F4 closure — `touched` is now recorded before the candidate copy (CLOSED)
In the install loop (`deploy_project_chain_mutex_v2.ps1:117-133`), `[void]$touched.Add($entry)` at line 127 precedes `File.Copy(candidate -> target)` at line 128. A mid-stream copy failure that leaves a truncated target now makes the entry eligible for rollback, which was the exact R3C F4 gap.

Placement is correct on both sides of the boundary:
- For `TargetExisted` entries, `$entry.BackupPath` is assigned at line 119 and the backup is created and hash-verified at lines 120-124, all strictly before the `touched.Add`. So any entry present in `touched` with `TargetExisted = $true` is guaranteed to have a non-null, hash-verified `BackupPath`. The rollback branch at line 157 cannot dereference a null backup path.
- If the backup copy or backup hash check throws, the entry is *not* in `touched`, and the target has not been modified at that point. Skipping it in rollback is the correct behavior, not a leak.

### `touched` early recording does not delete user files (PASS)
The delete branch (lines 159-161) fires only when `$entry.TargetExisted` is `$false`. That flag is set during the pre-pass at line 90, and the pre-pass is fail-closed for both directions: an entry with an `original/` baseline whose target is absent throws (lines 106-108), and an entry without a baseline whose target exists is only tolerated when the existing bytes already equal the candidate hash (lines 95-104). So `TargetExisted = $false` means the pre-pass observed no file at that path, and the delete is scoped to a file this deployment created. The delete is additionally guarded by a `Test-Path -PathType Leaf` (line 159), so a path that turned into a directory or vanished does not raise.

The one theoretical exposure is a TOCTOU window: if an external process creates a file at a `TargetExisted = $false` path between the pre-pass (line 90) and rollback, that file would be deleted. This is inherent to the pre-pass/apply split, unchanged from the previously approved design, and the paths are deployment-owned skill locations. Not blocking.

### F5 closure — rollback is per-entry contained and continues (CLOSED)
The `catch` block (lines 149-172) captures `$deploymentError = $_` first, snapshots `$touched.ToArray()`, reverses it (lines 151-152), and wraps each entry's restore/delete in its own `try/catch` (lines 155-165). A failure on one entry appends `"$($entry.Id): message"` to `$rollbackFailures` and the loop proceeds to the remaining entries. Reverse order is preserved across failures because the failure is contained inside the loop body rather than terminating the loop, which was the R3C F5 gap under `$ErrorActionPreference = 'Stop'`.

### Original root cause is preserved in both exits (PASS)
- No rollback failures: `throw $deploymentError` (line 171) rethrows the original `ErrorRecord` unchanged.
- One or more rollback failures: `throw [System.Exception]::new($rollbackMessage, $deploymentError.Exception)` (lines 168-169) carries the original deployment message inline *and* retains `$deploymentError.Exception` as the inner exception, plus every aggregated rollback failure. The operator loses neither the root cause nor the recovery failures. The `-join` inside the interpolated subexpression is well-formed.

### Backup verification baseline is correct (F8 from R3C closed)
`$entry.TargetSha256` is captured at line 94 from the live target, inside the `if ($entry.TargetExisted)` branch — i.e. it is the pre-deployment target hash, taken before any write. The backup comparison at lines 121-124 compares the freshly created `.bak` against that same pre-deployment value using `-cne`; both sides pass through `Get-Sha256` (line 17) which lowercases, so the case-sensitive operator is safe. The baseline is the right one: it is not the candidate hash and not a post-copy re-read. `TargetSha256` is non-null on every path that reads it, because backup creation and target hashing are gated by the identical `TargetExisted` condition.

`Copy(..., overwrite: false)` at line 120 keeps `.bak` collisions fail-closed, and all 15 `Id` values in the entry table (lines 50-66) are distinct, so no two entries contend for one `.bak` name.

### Unchanged properties spot-checked, not re-reviewed
V1 acquisition remains non-blocking with `WaitOne(0)`, `AbandonedMutexException` treated as acquired, fail-closed throw before any mutation (lines 75-83); release is guarded by `$legacyAcquired` in the outer `finally` with a nested `finally` for `Dispose` (lines 173-183). Ordering is still `catch` before `finally`, so V1 is never released while a partially applied set is on disk. Entry order 10/20 → 30 → 40 → 50 is unchanged. Per the notice these were not re-audited beyond confirming the new code does not disturb them.

### F6 remains open (informational, unchanged)
Target parent directories created at lines 110-113 are not tracked in `$touched`, so a failed run can leave empty `scripts\` / `evals\` directories. Residue only; no half-upgrade risk.

No blocking defect was found on the reviewed question. R3C's F4 and F5 are both closed, F8 is closed as a side effect, and the fixes introduce no new null-dereference, no loss of reverse ordering, no misdirected delete, and no loss of the original exception.

## Actions Executed and Not Executed

Executed (read-only):
- Read the notice, the current deployer script in full, `MUTEX_V2_DEPLOYER_VERIFICATION_R2.md`, and `CLAUDE_REVIEW_MUTEX_V2_R3C_DEPLOYER_RECEIPT.md`.
- Traced the four claimed fixes against source lines and checked the null-safety and ordering invariants they depend on.

Not executed:
- No deployment, no command, script, or Bash execution.
- No Write/Edit of any file. No receipt file was created at the notice's target path, and no C-drive review document was created; this receipt is returned inline. No plan file was written.
- No hash recomputation, so the notice's three EVIDENCE SHA-256 values and `NOTICE_SHA256` were not independently verified.
- No Codex, Claude sub-session, subagent, Agent tool, or other model invoked. No commit, push, credential access, or outbound message.

## Review Scope

Answered exactly one question: whether the current deployer hash closes R3C's F4 (`touched` recorded after the copy) and F5 (rollback loop without per-entry containment), and whether backup hash verification, early `touched` registration, continue-style reverse rollback, and original-exception retention introduce any new blocking defect.

Covered: backup creation/verification ordering and its comparison baseline; `BackupPath` and `TargetSha256` null-safety on every reachable path; `touched` registration point relative to backup and copy; correctness of the delete-vs-restore branch selection; reverse-order preservation under per-entry failure; aggregation and inner-exception construction; interaction of the new code with the pre-existing V1 gate and release ordering.

Out of scope and not re-assessed per the notice: V1 acquisition semantics, target drift whitelist, and entry ordering as standalone questions; helper mutex identity; regression scripts; invoker business semantics; SKILL.md wording; release readiness.

## Evidence Gaps

- Declared SHA-256 values in the notice were accepted as given; recomputation is unavailable under read-only tooling. My review binds to the file content I read, which matches the R2 description of the current hash.
- The R2 AST parse, the 15-file isolated success deployment, and the third-helper copy-failure multi-entry rollback are Codex-run results reported in `MUTEX_V2_DEPLOYER_VERIFICATION_R2.md`; I did not reproduce them.
- A second failure inside rollback itself was not simulated by anyone; that path is reviewed from source only, as the notice's Known Gaps concede.
- Installed targets under `%USERPROFILE%` were not inspected. Post-deployment verification of installed hashes plus a mutex regression re-run has not happened and remains required.

## Residual Risks

- Host-level events (power loss, process kill, ACL change mid-rollback, disk exhaustion during backup creation) are outside any PowerShell `catch`; the timestamped D-drive backup directory is then the only recovery route.
- `File.Copy` gives no cross-file atomicity; correctness still rests on the V1 gate, the verified backups, and the rollback path.
- If rollback fails for an entry whose target is locked, that target stays in its deployed state; the aggregated message plus inner exception identify it by `Id`, but manual restore from the backup root is required.
- TOCTOU: a file created externally at a `TargetExisted = $false` target path between the pre-pass and rollback would be deleted by rollback.
- Empty target-parent directories may persist after a failed run (F6).

FINAL_DECISION: GO
