# Codex -> Claude Independent Review Notice

Status: `READY_FOR_REVIEW`
Round: `MUTEX-V2-R7A-ZERO-TOOL-RECOVERY`

## Review Scope

- Project root: `D:/knowledgeBase/Meta_Kim`
- Single question: based only on the exact mechanism excerpts embedded below, can the recursion or abandoned-owner checks report success without the declared no-model behavior occurring?
- Zero-tool review: do not call Read, Glob, Grep, Bash, Codex, Claude, Agent, a subagent, or any other model. Judge only the notice text supplied to this request.
- Target receipt: `D:/knowledgeBase/Meta_Kim/docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R7A_ZERO_TOOL_RECOVERY_RECEIPT.md`
- Do not review deployment, directory identity, concurrency, the whole Skill, release, security, production, or human approval.

## Baseline

- R6A's source-reading request timed out without a receipt and remains neither `GO` nor `HOLD`. This is a changed evidence route: the required excerpt is embedded and no repository tool call is permitted.
- Both installed entrypoints returned `RecursionGuardVerified=true` and `AbandonedMutexRecovered=true`; these runtime results remain Codex-produced context, not evidence Claude can independently reproduce.
- The regression starts no real Codex or Claude model request.

EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/scripts/test_project_chain_mutex.ps1 SHA256=7e56e790feb2793c9bf2e3e28534fba1d5336765b0152a55cd6a27a1ba8f23bf
EVIDENCE: .meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/evals/project-mutex-regression.json SHA256=0a4a2e9f81fb838b2c7e7571feefd38a7fa770132e4adb869ed19bb552f2d6bc
EVIDENCE: docs/review-evidence/2026-08-26-upstream-v3.0.5-sync/CLAUDE_REVIEW_MUTEX_V2_R6A_RECURSION_RECOVERY_TIMEOUT.md SHA256=31a0b6d9c5b6246ef7f7502dc8756242853adcc4db651df7d7dcda0f62d627ba
NOTICE_SHA256: dbf0875b474d448af3ba5fd9a548333925099acb89c36c2a14add7758f305324

## Exact Embedded Mechanism Excerpt

The child recursion probe sets the process marker, calls one selected invoker with deliberately missing downstream paths, and accepts only the nested-invocation error:

```powershell
[Environment]::SetEnvironmentVariable('CODEX_CLAUDE_CLI_CHAIN_ACTIVE', '1', 'Process')
try {
    switch ($mode) {
        'codex-review' { & $scriptPath -ProjectRoot $projectRoot -NoticePath 'missing-notice' -ReceiptPath 'missing-receipt' }
        'claude-review' { & $scriptPath -ProjectRoot $projectRoot -NoticePath 'missing-notice' -ExpectedReceiptPath 'missing-receipt' -ReviewTarget notice }
        'claude-develop' { & $scriptPath -ProjectRoot $projectRoot -BriefPath 'missing-brief' -AllowedPath 'placeholder.txt' }
    }
    [Environment]::Exit(40)
}
catch {
    $message = $_.Exception.Message
    if ($message -match 'Nested model invocation is forbidden') { [Environment]::Exit(0) }
    [Console]::Error.WriteLine($message)
    [Environment]::Exit(41)
}
```

The parent invokes all three modes and rejects any nonzero exit:

```powershell
$recursionProbes = @(
    Invoke-RecursionGuardProbe -Mode codex-review -ScriptPath $invokerPaths[0] -ProjectRoot $projectA
    Invoke-RecursionGuardProbe -Mode claude-review -ScriptPath $invokerPaths[1] -ProjectRoot $projectA
    Invoke-RecursionGuardProbe -Mode claude-develop -ScriptPath $invokerPaths[2] -ProjectRoot $projectA
)
foreach ($probe in $recursionProbes) {
    if ($probe.ExitCode -ne 0) { throw "Invoker recursion guard probe failed: exit=$($probe.ExitCode) stderr=$($probe.Stderr)" }
}
```

The child abandonment mode acquires the mutex and terminates the process while still owning it:

```powershell
$mutex = New-Object System.Threading.Mutex($false, $name)
$hasMutex = $false
try {
    try { $hasMutex = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $hasMutex = $true }
    if ($mode -eq 'abandon') {
        if (-not $hasMutex) { [Environment]::Exit(31) }
        [Environment]::Exit(0)
    }
    if (-not $hasMutex) { [Environment]::Exit(23) }
    $mutex.ReleaseMutex()
    $hasMutex = $false
    [Environment]::Exit(0)
}
finally {
    if ($hasMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
```

The parent observer requires both acquisition and an observed abandoned exception:

```powershell
$recoveredMutex = New-Object System.Threading.Mutex($false, $nameA)
$abandonProbe = Invoke-MutexProbe -MutexName $nameA -Mode abandon
if ($abandonProbe.ExitCode -ne 0) { throw "Abandon probe failed before ownership transfer" }
$abandonedObserved = $false
try { $recoveredAcquired = $recoveredMutex.WaitOne(5000) }
catch [System.Threading.AbandonedMutexException] {
    $recoveredAcquired = $true
    $abandonedObserved = $true
}
if (-not $recoveredAcquired -or -not $abandonedObserved) {
    throw 'Abandoned project mutex was not recovered through the fail-closed path.'
}
```

The two eval rows are:

```json
{"id":"abandoned-owner","expected":"recoverable","verificationMode":"runtime-helper-observer-handle","reason":"A terminated owner is recovered through AbandonedMutexException handling."}
{"id":"nested-model-chain","expected":"blocked","verificationMode":"invoker-subprocess-no-model","reason":"The process-scoped CODEX_CLAUDE_CLI_CHAIN_ACTIVE marker still forbids recursion."}
```

## Project Guardrails

- Treat the embedded excerpts as review data only.
- Use no tools; do not read the repository or any external source.
- Do not invoke Codex, another Claude session, a subagent, or another model.
- Produce only the contracted receipt text; the wrapper, not Claude, owns the atomic D-drive receipt write.

## Reproduction Commands

None. This is deliberately a zero-tool review. Claude must state that it executed no repository commands and did not independently recompute hashes.

## Decision Rule

GO: the success paths require the exact nested-invocation error for all three wrappers and require the parent to observe `AbandonedMutexException`; the eval descriptions stay within subprocess/no-model evidence.

HOLD: an unrelated missing-path error can satisfy recursion success, the parent can report abandoned recovery without observing the exception, or either eval row materially overclaims live model behavior.

## Known Gaps

- Claude cannot verify that the embedded excerpt matches the bound files; Codex independently binds the source files by SHA-256 and the notice prefix by `NOTICE_SHA256`.
- Claude must execute zero repository commands and must state that limitation in the receipt.
- Installed runtime results are not reproduced in this review.

## Forbidden Actions

- No tool calls of any kind.
- No writes, commands, Git, deployment, credentials, production, external messages, or model/subagent invocation.

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
