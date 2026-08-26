[CmdletBinding()]
param(
    [string]$HelperPath = '',
    [string]$TempParent = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'This regression currently requires Windows.'
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($HelperPath)) {
    $HelperPath = Join-Path $scriptRoot 'project_model_chain_concurrency.ps1'
}
$resolvedHelper = (Resolve-Path -LiteralPath $HelperPath -ErrorAction Stop).Path
. $resolvedHelper

function Invoke-ChildScript {
    param([string]$Source)

    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($Source))
    $powershellPath = (Get-Command powershell.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $powershellPath
    $startInfo.Arguments = "-NoProfile -NonInteractive -EncodedCommand $encoded"
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    [void]$startInfo.EnvironmentVariables.Remove('META_KIM_PROJECT_MODEL_CHAIN_ACTIVE')
    [void]$startInfo.EnvironmentVariables.Remove('CODEX_CLAUDE_CLI_CHAIN_ACTIVE')
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) {
            throw 'Child probe failed to start.'
        }
        if (-not $process.WaitForExit(15000)) {
            $process.Kill()
            $process.WaitForExit()
            throw 'Child probe timed out.'
        }
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            Stdout = $process.StandardOutput.ReadToEnd()
            Stderr = $process.StandardError.ReadToEnd()
        }
    }
    finally {
        $process.Dispose()
    }
}

function ConvertTo-ProbeLiteral {
    param([string]$Value)
    return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Value))
}

function Invoke-RawMutexProbe {
    param(
        [string]$MutexName,
        [switch]$Abandon
    )

    $mode = if ($Abandon) { 'abandon' } else { 'probe' }
    $source = @'
$name = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__NAME__'))
$mode = '__MODE__'
$mutex = [Threading.Mutex]::new($false, $name)
$acquired = $false
try {
    try { $acquired = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $acquired = $true }
    if (-not $acquired) { [Environment]::Exit(23) }
    if ($mode -eq 'abandon') { [Environment]::Exit(0) }
    $mutex.ReleaseMutex()
    $acquired = $false
    [Environment]::Exit(0)
}
finally {
    if ($acquired) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
'@
    $source = $source.Replace('__NAME__', (ConvertTo-ProbeLiteral -Value $MutexName)).Replace('__MODE__', $mode)
    return Invoke-ChildScript -Source $source
}

function Invoke-HelperProbe {
    param([string]$ProjectRoot)

    $source = @'
$helper = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__HELPER__'))
$root = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__ROOT__'))
. $helper
$lease = $null
try {
    $lease = Enter-ProjectModelChainLock -ProjectRoot $root -TimeoutMilliseconds 0
    [Environment]::Exit(0)
}
catch {
    if ($_.Exception.Message -match 'holds mutex') { [Environment]::Exit(23) }
    [Console]::Error.WriteLine($_.Exception.Message)
    [Environment]::Exit(24)
}
finally {
    if ($lease) { Exit-ProjectModelChainLock -Lease $lease }
}
'@
    $source = $source.Replace('__HELPER__', (ConvertTo-ProbeLiteral -Value $resolvedHelper)).Replace('__ROOT__', (ConvertTo-ProbeLiteral -Value $ProjectRoot))
    return Invoke-ChildScript -Source $source
}

$tempBase = if ([string]::IsNullOrWhiteSpace($TempParent)) {
    [System.IO.Path]::GetTempPath()
}
else {
    $candidate = (Resolve-Path -LiteralPath $TempParent -ErrorAction Stop).Path
    if (-not (Test-Path -LiteralPath $candidate -PathType Container)) {
        throw 'TempParent must be an existing directory.'
    }
    $candidate
}
$tempRoot = Join-Path $tempBase ("project-model-chain-{0}" -f [Guid]::NewGuid().ToString('N'))
$projectA = Join-Path $tempRoot 'Project-A'
$projectB = Join-Path $tempRoot 'Project-B'
$projectChild = Join-Path $projectA 'child'
$projectAlias = Join-Path $tempRoot 'Project-A-Junction'
$lease = $null
$heldNewMutex = $null
$heldNewAcquired = $false

try {
    [void][System.IO.Directory]::CreateDirectory($projectA)
    [void][System.IO.Directory]::CreateDirectory($projectB)
    [void][System.IO.Directory]::CreateDirectory($projectChild)
    New-Item -ItemType Junction -Path $projectAlias -Target $projectA -ErrorAction Stop | Out-Null

    $nameA = Get-ProjectModelChainMutexName -ProjectRoot $projectA
    $legacyNameA = Get-ProjectModelChainLegacyMutexName -ProjectRoot $projectA
    $equivalentNames = @(
        (Get-ProjectModelChainMutexName -ProjectRoot ($projectA + '\')),
        (Get-ProjectModelChainMutexName -ProjectRoot $projectA.ToUpperInvariant()),
        (Get-ProjectModelChainMutexName -ProjectRoot $projectA.Replace('\', '/')),
        (Get-ProjectModelChainMutexName -ProjectRoot (Join-Path $projectA '.')),
        (Get-ProjectModelChainMutexName -ProjectRoot (Join-Path $projectChild '..')),
        (Get-ProjectModelChainMutexName -ProjectRoot $projectAlias)
    )
    if ($equivalentNames | Where-Object { $_ -cne $nameA }) {
        throw 'Equivalent paths did not share the runtime-neutral mutex key.'
    }
    $nameB = Get-ProjectModelChainMutexName -ProjectRoot $projectB
    if ($nameA -ceq $nameB) {
        throw 'Different physical projects produced the same mutex key.'
    }
    if ($nameA -notmatch '^Local\\MetaKimProjectModelChainV1-[0-9a-f]{64}$') {
        throw "Malformed runtime-neutral mutex name: $nameA"
    }
    if ($legacyNameA -notmatch '^Local\\CodexClaudeCliProjectChainV2-[0-9a-f]{64}$') {
        throw "Malformed compatibility mutex name: $legacyNameA"
    }
    if ((Get-ProjectChainMutexName -ProjectRoot $projectA) -cne $legacyNameA) {
        throw 'Deprecated mutex-name alias no longer maps to the compatibility lock.'
    }
    if ($nameA.IndexOf('Project-A', [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw 'Mutex name leaked the project path.'
    }

    $driveRoot = [System.IO.Path]::GetPathRoot($projectA)
    if ((Resolve-ProjectModelChainRootPath -ProjectRoot $driveRoot) -cne $driveRoot) {
        throw 'Drive-root normalization changed the root.'
    }
    if ((Get-ProjectModelChainMutexName -ProjectRoot $driveRoot) -cne
        (Get-ProjectModelChainMutexName -ProjectRoot $driveRoot.Replace('\', '/'))) {
        throw 'Drive-root aliases produced different keys.'
    }

    $lease = Enter-ProjectModelChainLock -ProjectRoot $projectA
    if ([Environment]::GetEnvironmentVariable('META_KIM_PROJECT_MODEL_CHAIN_ACTIVE', 'Process') -ne '1' -or
        [Environment]::GetEnvironmentVariable('CODEX_CLAUDE_CLI_CHAIN_ACTIVE', 'Process') -ne '1') {
        throw 'Enter did not set both recursion markers.'
    }
    $foreignPowerShell = [PowerShell]::Create()
    try {
        [void]$foreignPowerShell.AddScript(@'
param($helperPath, $foreignLease)
. $helperPath
try {
    Exit-ProjectModelChainLock -Lease $foreignLease
    'UNEXPECTED_SUCCESS'
}
catch {
    $_.Exception.Message
}
'@).AddArgument($resolvedHelper).AddArgument($lease)
        $foreignReleaseResult = @($foreignPowerShell.Invoke())
        $foreignReleaseText = ($foreignReleaseResult | Out-String).Trim()
        if ($foreignReleaseText -notmatch 'must be released on the acquiring thread') {
            $foreignErrors = ($foreignPowerShell.Streams.Error | Out-String).Trim()
            throw "Foreign-thread release did not fail closed: output=$foreignReleaseText errors=$foreignErrors"
        }
        if ($lease.Released) {
            throw 'Foreign-thread release consumed the lease and prevented owner-thread recovery.'
        }
    }
    finally {
        $foreignPowerShell.Dispose()
    }
    if ((Invoke-HelperProbe -ProjectRoot $projectA).ExitCode -ne 23) {
        throw 'A second runtime-neutral consumer was not blocked for the same project.'
    }
    if ((Invoke-HelperProbe -ProjectRoot $projectB).ExitCode -ne 0) {
        throw 'An independent project could not run concurrently.'
    }
    if ((Invoke-RawMutexProbe -MutexName $legacyNameA).ExitCode -ne 23) {
        throw 'A legacy V2 consumer was not blocked by the compatibility bridge.'
    }
    if ((Invoke-RawMutexProbe -MutexName $nameA).ExitCode -ne 23) {
        throw 'The runtime-neutral mutex was not held.'
    }
    Exit-ProjectModelChainLock -Lease $lease
    $lease = $null
    if ([Environment]::GetEnvironmentVariable('META_KIM_PROJECT_MODEL_CHAIN_ACTIVE', 'Process') -or
        [Environment]::GetEnvironmentVariable('CODEX_CLAUDE_CLI_CHAIN_ACTIVE', 'Process')) {
        throw 'Exit did not restore recursion markers.'
    }

    $heldNewMutex = [Threading.Mutex]::new($false, $nameA)
    $heldNewAcquired = $heldNewMutex.WaitOne(0)
    if (-not $heldNewAcquired) {
        throw 'Could not acquire the new mutex for partial-acquisition rollback.'
    }
    if ((Invoke-HelperProbe -ProjectRoot $projectA).ExitCode -ne 23) {
        throw 'Partial-acquisition probe did not fail on the held new mutex.'
    }
    if ((Invoke-RawMutexProbe -MutexName $legacyNameA).ExitCode -ne 0) {
        throw 'Partial acquisition did not release the compatibility mutex.'
    }
    $heldNewMutex.ReleaseMutex()
    $heldNewAcquired = $false
    $heldNewMutex.Dispose()
    $heldNewMutex = $null

    if ((Invoke-RawMutexProbe -MutexName $nameA -Abandon).ExitCode -ne 0) {
        throw 'Could not create an abandoned runtime-neutral mutex.'
    }
    $lease = Enter-ProjectModelChainLock -ProjectRoot $projectA -TimeoutMilliseconds 5000
    Exit-ProjectModelChainLock -Lease $lease
    $lease = $null

    foreach ($marker in @('META_KIM_PROJECT_MODEL_CHAIN_ACTIVE', 'CODEX_CLAUDE_CLI_CHAIN_ACTIVE')) {
        [Environment]::SetEnvironmentVariable($marker, '1', 'Process')
        try {
            $blocked = $false
            try {
                $unexpectedLease = Enter-ProjectModelChainLock -ProjectRoot $projectA
                Exit-ProjectModelChainLock -Lease $unexpectedLease
            }
            catch {
                $blocked = $_.Exception.Message -match 'Nested model invocation is forbidden'
            }
            if (-not $blocked) {
                throw "Recursion marker was not enforced: $marker"
            }
        }
        finally {
            [Environment]::SetEnvironmentVariable($marker, $null, 'Process')
        }
    }

    $invalidFile = Join-Path $tempRoot 'not-a-directory.txt'
    [System.IO.File]::WriteAllText($invalidFile, 'x')
    foreach ($invalidRoot in @((Join-Path $tempRoot 'missing'), $invalidFile)) {
        $failedClosed = $false
        try {
            $unexpectedLease = Enter-ProjectModelChainLock -ProjectRoot $invalidRoot
            Exit-ProjectModelChainLock -Lease $unexpectedLease
        }
        catch {
            $failedClosed = $true
        }
        if (-not $failedClosed) {
            throw "Invalid ProjectRoot did not fail closed: $invalidRoot"
        }
    }

    [pscustomobject]@{
        Status = 'PROJECT_MODEL_CHAIN_CONCURRENCY_TEST_PASS'
        SameProjectBlocked = $true
        DifferentProjectsConcurrent = $true
        PhysicalAliasesShareKey = $true
        CompatibilityBridgeVerified = $true
        PartialAcquisitionRolledBack = $true
        AbandonedMutexRecovered = $true
        RecursionMarkersVerified = $true
        ThreadAffinityFailClosed = $true
        InvalidRootsFailClosed = $true
        MutexNamesRedactPaths = $true
    } | ConvertTo-Json -Compress
}
finally {
    if ($lease) {
        Exit-ProjectModelChainLock -Lease $lease
    }
    if ($heldNewMutex) {
        if ($heldNewAcquired) {
            $heldNewMutex.ReleaseMutex()
        }
        $heldNewMutex.Dispose()
    }
    [Environment]::SetEnvironmentVariable('META_KIM_PROJECT_MODEL_CHAIN_ACTIVE', $null, 'Process')
    [Environment]::SetEnvironmentVariable('CODEX_CLAUDE_CLI_CHAIN_ACTIVE', $null, 'Process')
    if (Test-Path -LiteralPath $projectAlias) {
        [System.IO.Directory]::Delete($projectAlias)
    }
    if (Test-Path -LiteralPath $tempRoot) {
        [System.IO.Directory]::Delete($tempRoot, $true)
    }
}
