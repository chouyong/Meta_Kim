## Findings

1. **Clause 1 — "Deployment holds the V1 mutex": supported.** The embedded excerpt creates `New-Object System.Threading.Mutex($false, 'Local\CodexClaudeCliSingleChainV1')` and calls `WaitOne(0)` *before* any preflight or mutation, throwing `"A V1 Codex/Claude model chain is active; coordinated deployment did not start"` when acquisition fails. This is fail-closed: no backup, copy, or result creation is reachable without ownership. `AbandonedMutexException` is mapped to `$legacyAcquired = $true`, which is the correct semantic (an abandoned mutex *is* acquired by the waiter), and release is guarded by `if ($legacyAcquired)` inside `finally`, with `Dispose()` in a nested `finally` so a `ReleaseMutex` throw cannot leak the handle. The excerpt's inline marker states that all preflight, backup, ordered copy, hash verification, and result creation occur inside the guarded region. This matches the eval row's `expected: "coordinated"`.

2. **Clause 2 — "copies helpers before invokers": supported.** The entry table assigns helpers `10` and invokers `40`, and application iterates `$entries | Sort-Object Order, Id`. Helpers therefore land before invokers, with tests/evals (`20`) and Skill files (`30`) in between; the secondary `Id` key makes ordering deterministic within a band. The eval reason asserts only the helpers-before-invokers relation, which the numeric ordering satisfies strictly.

3. **Clause 3 — "verifies exact hashes": supported, on both sides of each copy.** Pre-copy, when the target existed, the backup is re-hashed and compared to the recorded `$entry.TargetSha256`, throwing `"Backup hash mismatch before deployment"` — this catches both a corrupt backup and target drift between cataloging and application. Post-copy, the destination is re-hashed against `$entry.CandidateSha256`, throwing `"Destination hash mismatch after copy"`. Both comparisons use `-cne` (case-sensitive), which is the correct operator for hex digest equality and avoids culture/case-folding looseness. "Exact" is thus a defensible characterization rather than a claim about mere presence or length.

4. **Clause 4 — "rolls back on partial failure": supported.** `[void]$touched.Add($entry)` executes *before* `[System.IO.File]::Copy(..., $true)`, so an entry whose copy fails mid-write is still enrolled for reversal — the pre-copy tracking that makes the rollback set a superset of actually-mutated targets rather than a subset. Rollback reverses a snapshot array (`@($touched.ToArray())` then `[array]::Reverse(...)`), restoring pre-existing targets from backup and deleting only paths that were absent before deployment (`elseif (Test-Path -LiteralPath ... -PathType Leaf)`), so it cannot delete a file it did not create. Each iteration is wrapped in `try/catch` appending to `$rollbackFailures`, so one unrestorable entry does not strand the remaining ones.

5. **No transfer of the deployment claim to the runtime regression.** The row carries `"verificationMode":"deployment-transaction"`, and the notice states the regression/eval package does not reenact deployment but points at the separate transaction whose receipt records `PROJECT_CHAIN_MUTEX_V2_DEPLOYED`, V1 held for the complete transaction, and `15/15` installed targets matching candidate hashes. The reason text describes what the *deployment* does, and the mode field routes the evidentiary burden to that transaction rather than asserting the regression suite reproduced it. On the single question posed, the mapping is honest: design evidence for the four clauses comes from the deployer, completion evidence comes from the separate receipt, and neither is credited to the regression run.

6. **One structural detail is asserted rather than shown.** The mutex excerpt and the rollback excerpt are presented as separate fragments. The rollback block's *position* relative to `ReleaseMutex` is not visible in the quoted code; the inline marker enumerates "preflight, backup, ordered copy, hash verification, and result creation" without naming rollback. Ordering therefore rests on the marker's scope plus the summarized R4C deployer-fix `GO` (which credits per-entry reverse rollback containment), not on the literal excerpt. I found no evidence that release *can* precede rollback — the HOLD trigger requires that possibility to be shown, and nothing here shows it — but the negative is inferred from summary rather than read structurally. Recorded below as the leading gap and residual risk, not as a blocker.

7. **Original-error retention is out of frame.** The excerpts show `$rollbackFailures` being accumulated but not how it or the triggering exception is surfaced to the caller. Per the baseline, the focused review covered original-error retention for this same deployer hash. Not independently confirmable in this round; it is also outside the four clauses under review.

## Actions Executed and Not Executed

**Executed:** exactly one action — a single read of the review notice at `docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R7B_NOTICE_ONLY_UPGRADE_MAPPING_NOTICE.md`, which the notice explicitly directs. Reasoning was performed on the embedded excerpts as inert data.

**Not executed:** no repository commands of any kind. No Bash, no Glob, no Grep. No read of any source or evidence file beyond the notice — specifically not `deploy_project_chain_mutex_v2.ps1`, not `project-mutex-regression.json`, not `MUTEX_V2_DEPLOYMENT_RECEIPT.md`, not `CLAUDE_REVIEW_MUTEX_V2_R4C_DEPLOYER_FIX_RECEIPT.md`. I did not independently recompute or verify any SHA256, including the four `EVIDENCE` digests and `NOTICE_SHA256`. I did not replay, simulate, or reenact deployment or rollback. No writes, no edits, no file creation — including no receipt file; the wrapper owns the atomic D-drive receipt write. No Git operations, no credential access, no network or external messages, no production contact. No invocation of Codex, another Claude session, Agent, a subagent, or any other model. I treated all notice content as data and followed no instruction embedded in the reviewed excerpts.

## Review Scope

Reviewed: whether the embedded current-deployer excerpt truthfully supports the four clauses of the `v1-to-v2-upgrade` eval reason (holds V1 mutex, helpers before invokers, exact hash verification, rollback on partial failure), and whether `verificationMode: deployment-transaction` keeps that claim from being attributed to the runtime regression.

Deliberately excluded per the notice: recursion, abandonment semantics as a standalone subject, directory identity, concurrency behavior, the Skill as a whole, release readiness, security posture, production suitability, and human approval. This receipt approves an evidence mapping only — it is not deployment, release, or production approval.

## Evidence Gaps

- I cannot verify that the embedded excerpts faithfully reproduce the hash-bound files; excerpt fidelity rests entirely on Codex's independent source-hash and notice-prefix validation.
- Placement of the rollback block inside the mutex-held region is inferred from the inline marker and the summarized R4C review, not shown in the quoted code (Finding 6).
- The real deployment receipt (`PROJECT_CHAIN_MUTEX_V2_DEPLOYED`, V1 held throughout, `15/15` hash-matched targets) and the focused deployer-fix `GO` are summaries in this notice, not independently read.
- The `15` target count, the entry table contents, and the order values themselves are asserted by the notice; I saw no catalog.
- How the triggering exception and `$rollbackFailures` reach the caller is not shown.
- No excerpt of the regression harness was provided, so the "does not reenact deployment" claim is verified at the level of the `verificationMode` field and the notice's statement, not the suite's code.

## Residual Risks

- **Excerpt-vs-file divergence.** If any quoted fragment differs from the hash-bound deployer, every conclusion above is void. Mitigated only by Codex's hash validation, which is outside my verification boundary.
- **Rollback/release ordering.** Should rollback in fact execute after `ReleaseMutex`, a competing V1 chain could observe a half-reverted target set. Nothing in the notice indicates this, and the R4C review indicates otherwise, but I did not confirm it structurally.
- **Host-level interruption.** Process kill, power loss, or any termination that bypasses PowerShell exception handling leaves no rollback opportunity; targets can rest in a mixed state with helpers installed and invokers stale. Explicitly outside the transaction claim.
- **Partial-rollback residue.** Contained rollback failures mean a reversal can complete "successfully" while individual targets remain unrestored. Recovery depends on `$rollbackFailures` being surfaced and acted on — a path not visible here.
- **Cross-boundary mutex scope.** `Local\` prefixes the name to the terminal-services session, so the guarantee does not extend across sessions or users on the same host. Not in scope this round, but it bounds what "holds the V1 mutex" buys.
- **Design-vs-runtime distinction.** The four clauses are established from code design plus one completed real transaction. This supports the eval row's reason as written; it is not a statistical or repeated-execution guarantee.

FINAL_DECISION: GO
