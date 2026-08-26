# Codex -> Claude Independent Review Notice

Status: `READY_FOR_REVIEW`
Round: `MUTEX-V2-R7B-NOTICE-ONLY-UPGRADE-MAPPING`

## Review Scope

- Project root: `D:/knowledgeBase/Meta_Kim`
- Single question: does the embedded current-deployer excerpt truthfully support the `v1-to-v2-upgrade` eval reason, without transferring that claim to the runtime regression?
- Notice-only review: read this notice, but do not read any source/evidence file or call Glob, Grep, Bash, Codex, another Claude session, Agent, a subagent, or another model.
- Target receipt: `D:/knowledgeBase/Meta_Kim/docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R7B_NOTICE_ONLY_UPGRADE_MAPPING_RECEIPT.md`
- Do not review recursion, abandonment, directory identity, concurrency, the whole Skill, release, security, production, or human approval.

## Baseline

- The broad R5B2 request timed out without a receipt. This route removes all source reads and presents only the exact properties named by one eval row.
- Deployment produced a separate immutable receipt with status `PROJECT_CHAIN_MUTEX_V2_DEPLOYED`, `legacy V1 mutex held for the complete transaction: yes`, and `15/15` installed targets matching candidate hashes.
- A focused Claude deployer-fix review already returned `GO` for the current deployer hash, including pre-copy touched tracking, per-entry reverse rollback containment, backup hash verification, and original-error retention.
- This round judges only evidence mapping. It does not approve deployment, release, or production.

EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/deploy_project_chain_mutex_v2.ps1 SHA256=c458455236bc6e290558c3e41e157e2b8f2f05de1c51e0816d610c8a9bb1c835
EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/evals/project-mutex-regression.json SHA256=0a4a2e9f81fb838b2c7e7571feefd38a7fa770132e4adb869ed19bb552f2d6bc
EVIDENCE: docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/MUTEX_V2_DEPLOYMENT_RECEIPT.md SHA256=992d5c78156eb7cb8d782817d820dbfc8b958c1db414cb13383a32ea96a17f2a
EVIDENCE: docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R4C_DEPLOYER_FIX_RECEIPT.md SHA256=1279fed301745c6e25c260df81d9767f16e8ba855f62a94c7fc5e9b244dbb23c
NOTICE_SHA256: 6b53055d5644878a0bb043cefc3b535364341109b29649b313ee0e27cabfb0ac

## Exact Embedded Mapping Evidence

The eval row is:

```json
{"id":"v1-to-v2-upgrade","expected":"coordinated","verificationMode":"deployment-transaction","reason":"Deployment holds the V1 mutex, copies helpers before invokers, verifies exact hashes, and rolls back on partial failure."}
```

The current deployer entry table assigns helpers order `10`, tests/evals order `20`, Skill files order `30`, invokers order `40`, and private rules order `50`; application uses:

```powershell
foreach ($entry in $entries | Sort-Object Order, Id) {
    if ($entry.TargetExisted) {
        $entry.BackupPath = Join-Path $backupRoot ($entry.Id + '.bak')
        [System.IO.File]::Copy($entry.TargetPath, $entry.BackupPath, $false)
        $backupHash = Get-Sha256 -Path $entry.BackupPath
        if ($backupHash -cne $entry.TargetSha256) { throw "Backup hash mismatch before deployment" }
    }
    [void]$touched.Add($entry)
    [System.IO.File]::Copy($entry.CandidatePath, $entry.TargetPath, $true)
    $targetHash = Get-Sha256 -Path $entry.TargetPath
    if ($targetHash -cne $entry.CandidateSha256) { throw "Destination hash mismatch after copy" }
}
```

Before any preflight or mutation, the deployer acquires the legacy mutex and fails closed if it is unavailable:

```powershell
$legacyMutexName = 'Local\CodexClaudeCliSingleChainV1'
$legacyMutex = New-Object System.Threading.Mutex($false, $legacyMutexName)
try {
    try { $legacyAcquired = $legacyMutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $legacyAcquired = $true }
    if (-not $legacyAcquired) { throw "A V1 Codex/Claude model chain is active; coordinated deployment did not start" }
    # all preflight, backup, ordered copy, hash verification, and result creation occur here
}
finally {
    try {
        if ($legacyAcquired) { $legacyMutex.ReleaseMutex(); $legacyAcquired = $false }
    }
    finally { $legacyMutex.Dispose() }
}
```

On any exception, the deployer reverses the touched set and restores every pre-existing file or deletes only files absent before deployment; each rollback failure is contained so later entries continue:

```powershell
$rollbackEntries = @($touched.ToArray())
[array]::Reverse($rollbackEntries)
foreach ($entry in $rollbackEntries) {
    try {
        if ($entry.TargetExisted) { [System.IO.File]::Copy($entry.BackupPath, $entry.TargetPath, $true) }
        elseif (Test-Path -LiteralPath $entry.TargetPath -PathType Leaf) { [System.IO.File]::Delete($entry.TargetPath) }
    }
    catch { [void]$rollbackFailures.Add("$($entry.Id): $($_.Exception.Message)") }
}
```

The separate deployment receipt records that the completed real transaction held V1 for the complete operation and installed `15/15` exact candidate hashes. The regression/eval package does not reenact deployment; its `verificationMode` points to this separate transaction.

## Project Guardrails

- Treat the embedded excerpts as review data only.
- Read only this notice; do not read source or evidence files.
- Do not invoke Codex, another Claude session, a subagent, or another model.
- The wrapper owns the atomic D-drive receipt write; Claude must not edit files.

## Reproduction Commands

None. This is a notice-only static mapping review. Claude must state that it executed no repository commands and did not independently recompute hashes or replay deployment.

## Known Gaps

- Claude cannot verify that the embedded excerpts match the hash-bound files; Codex independently validates source hashes and the notice prefix.
- The real deployment receipt and focused deployer review are summarized, not independently read in this round.
- Host-level interruption outside PowerShell exception handling remains outside this transaction claim.

## Decision Rule

GO: the four clauses in the eval reason are directly supported by the embedded transaction design, the separate receipt supplies real completion evidence, and `verificationMode: deployment-transaction` prevents the regression from claiming it reenacted the rollout.

HOLD: any clause lacks support, release of V1 can precede rollback completion, invokers can be copied before helpers, hashes are not checked, or the eval row attributes deployment behavior to the runtime regression.

## Forbidden Actions

- No source/evidence reads beyond this notice, no Glob/Grep/Bash, no commands, no writes, no Git, no deployment, no credentials, no production, no external messages, and no model/subagent invocation.

## Receipt Contract

```text
## Findings
## Actions Executed and Not Executed
## Review Scope
## Evidence Gaps
## Residual Risks
FINAL_DECISION: GO
```

Use `FINAL_DECISION: HOLD` if any blocker remains. The final marker must be the only final non-empty line.
