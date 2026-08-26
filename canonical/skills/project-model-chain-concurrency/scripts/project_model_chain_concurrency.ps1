Set-StrictMode -Version Latest

$script:ProjectModelChainEnvironmentVariable = 'META_KIM_PROJECT_MODEL_CHAIN_ACTIVE'
$script:LegacyProjectModelChainEnvironmentVariable = 'CODEX_CLAUDE_CLI_CHAIN_ACTIVE'

if (-not ('MetaKim.ProjectModelChainNativeV1' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace MetaKim
{
    public static class ProjectModelChainNativeV1
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct ByHandleFileInformation
        {
            public uint FileAttributes;
            public System.Runtime.InteropServices.ComTypes.FILETIME CreationTime;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastAccessTime;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastWriteTime;
            public uint VolumeSerialNumber;
            public uint FileSizeHigh;
            public uint FileSizeLow;
            public uint NumberOfLinks;
            public uint FileIndexHigh;
            public uint FileIndexLow;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern SafeFileHandle CreateFile(
            string fileName,
            uint desiredAccess,
            uint shareMode,
            IntPtr securityAttributes,
            uint creationDisposition,
            uint flagsAndAttributes,
            IntPtr templateFile);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetFileInformationByHandle(
            SafeFileHandle fileHandle,
            out ByHandleFileInformation fileInformation);
    }
}
'@
}

function Resolve-ProjectModelChainRootPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $resolved = Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $resolved.Path -PathType Container)) {
        throw "ProjectRoot must be an existing directory: $ProjectRoot"
    }

    $fullPath = [System.IO.Path]::GetFullPath($resolved.Path)
    $pathRoot = [System.IO.Path]::GetPathRoot($fullPath)
    if ($fullPath.Length -gt $pathRoot.Length) {
        $fullPath = $fullPath.TrimEnd('\', '/')
    }
    return $fullPath
}

function ConvertTo-ProjectModelChainExtendedDirectoryPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if ($Path.StartsWith('\\?\', [System.StringComparison]::Ordinal)) {
        return $Path
    }
    if ($Path.StartsWith('\\', [System.StringComparison]::Ordinal)) {
        return '\\?\UNC\' + $Path.Substring(2)
    }
    return '\\?\' + $Path
}

function Get-WindowsProjectModelChainDirectoryIdentity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $extendedPath = ConvertTo-ProjectModelChainExtendedDirectoryPath -Path $ProjectRoot
    $shareMode = [uint32](1 -bor 2 -bor 4)
    $openExisting = [uint32]3
    $backupSemantics = [uint32]0x02000000
    $handle = [MetaKim.ProjectModelChainNativeV1]::CreateFile(
        $extendedPath,
        [uint32]0,
        $shareMode,
        [IntPtr]::Zero,
        $openExisting,
        $backupSemantics,
        [IntPtr]::Zero)

    if ($handle.IsInvalid) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        $handle.Dispose()
        throw "Could not open ProjectRoot for physical directory identity; Win32 error $errorCode."
    }

    try {
        $information = New-Object 'MetaKim.ProjectModelChainNativeV1+ByHandleFileInformation'
        if (-not [MetaKim.ProjectModelChainNativeV1]::GetFileInformationByHandle($handle, [ref]$information)) {
            $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "Could not read ProjectRoot physical directory identity; Win32 error $errorCode."
        }

        return ('win32:{0:x8}:{1:x8}{2:x8}' -f
            $information.VolumeSerialNumber,
            $information.FileIndexHigh,
            $information.FileIndexLow)
    }
    finally {
        $handle.Dispose()
    }
}

function Get-ProjectModelChainIdentity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'Project model-chain physical identity is not implemented for this operating system.'
    }

    $root = Resolve-ProjectModelChainRootPath -ProjectRoot $ProjectRoot
    return Get-WindowsProjectModelChainDirectoryIdentity -ProjectRoot $root
}

function Get-ProjectModelChainDigest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $identity = Get-ProjectModelChainIdentity -ProjectRoot $ProjectRoot
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($identity)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Get-ProjectModelChainMutexName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $digest = Get-ProjectModelChainDigest -ProjectRoot $ProjectRoot
    return "Local\MetaKimProjectModelChainV1-$digest"
}

function Get-ProjectModelChainLegacyMutexName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $digest = Get-ProjectModelChainDigest -ProjectRoot $ProjectRoot
    return "Local\CodexClaudeCliProjectChainV2-$digest"
}

function Get-ProjectChainMutexName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    return Get-ProjectModelChainLegacyMutexName -ProjectRoot $ProjectRoot
}

function Resolve-ProjectChainRootPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    return Resolve-ProjectModelChainRootPath -ProjectRoot $ProjectRoot
}

function Restore-ProjectModelChainEnvironment {
    param(
        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$OriginalEnvironment
    )

    foreach ($variableName in @(
        $script:ProjectModelChainEnvironmentVariable,
        $script:LegacyProjectModelChainEnvironmentVariable
    )) {
        [Environment]::SetEnvironmentVariable(
            $variableName,
            $OriginalEnvironment[$variableName],
            'Process')
    }
}

function Enter-ProjectModelChainLock {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [ValidateRange(0, 2147483647)]
        [int]$TimeoutMilliseconds = 0
    )

    $environmentNames = @(
        $script:ProjectModelChainEnvironmentVariable,
        $script:LegacyProjectModelChainEnvironmentVariable
    )
    $originalEnvironment = [ordered]@{}
    foreach ($variableName in $environmentNames) {
        $value = [Environment]::GetEnvironmentVariable($variableName, 'Process')
        $originalEnvironment[$variableName] = $value
        if (-not [string]::IsNullOrEmpty($value)) {
            throw "Nested model invocation is forbidden because $variableName is already set."
        }
    }

    $root = Resolve-ProjectModelChainRootPath -ProjectRoot $ProjectRoot
    $digest = Get-ProjectModelChainDigest -ProjectRoot $root
    $mutexNames = @(
        "Local\CodexClaudeCliProjectChainV2-$digest",
        "Local\MetaKimProjectModelChainV1-$digest"
    )
    $entries = New-Object 'System.Collections.Generic.List[object]'
    $environmentSet = $false

    try {
        foreach ($mutexName in $mutexNames) {
            $mutex = New-Object System.Threading.Mutex($false, $mutexName)
            $acquired = $false
            try {
                try {
                    $acquired = $mutex.WaitOne($TimeoutMilliseconds)
                }
                catch [System.Threading.AbandonedMutexException] {
                    $acquired = $true
                }
                if (-not $acquired) {
                    throw "Another external model chain for this project holds mutex $mutexName."
                }
                [void]$entries.Add([pscustomobject]@{
                    Name = $mutexName
                    Mutex = $mutex
                    Acquired = $true
                })
                $mutex = $null
            }
            finally {
                if ($mutex) {
                    if ($acquired) {
                        $mutex.ReleaseMutex()
                    }
                    $mutex.Dispose()
                }
            }
        }

        foreach ($variableName in $environmentNames) {
            [Environment]::SetEnvironmentVariable($variableName, '1', 'Process')
        }
        $environmentSet = $true

        return [pscustomobject]@{
            PSTypeName = 'MetaKim.ProjectModelChainLease'
            ProjectRoot = $root
            MutexName = $mutexNames[1]
            LegacyMutexName = $mutexNames[0]
            MutexEntries = @($entries.ToArray())
            OriginalEnvironment = $originalEnvironment
            OwnerManagedThreadId = [System.Threading.Thread]::CurrentThread.ManagedThreadId
            Released = $false
        }
    }
    catch {
        if ($environmentSet) {
            Restore-ProjectModelChainEnvironment -OriginalEnvironment $originalEnvironment
        }
        for ($index = $entries.Count - 1; $index -ge 0; $index -= 1) {
            $entry = $entries[$index]
            try {
                if ($entry.Acquired) {
                    $entry.Mutex.ReleaseMutex()
                }
            }
            finally {
                $entry.Mutex.Dispose()
            }
        }
        throw
    }
}

function Exit-ProjectModelChainLock {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Lease
    )

    if ($Lease.PSObject.TypeNames -notcontains 'MetaKim.ProjectModelChainLease') {
        throw 'Lease is not a project model-chain lock lease.'
    }
    if ($Lease.Released) {
        return
    }
    $currentThreadId = [System.Threading.Thread]::CurrentThread.ManagedThreadId
    if ([int]$Lease.OwnerManagedThreadId -ne $currentThreadId) {
        throw "Project model-chain lock must be released on the acquiring thread; owner=$($Lease.OwnerManagedThreadId) current=$currentThreadId."
    }

    $errors = New-Object 'System.Collections.Generic.List[string]'
    for ($index = $Lease.MutexEntries.Count - 1; $index -ge 0; $index -= 1) {
        $entry = $Lease.MutexEntries[$index]
        try {
            if ($entry.Acquired) {
                $entry.Mutex.ReleaseMutex()
            }
        }
        catch {
            [void]$errors.Add($_.Exception.Message)
        }
        finally {
            try {
                $entry.Mutex.Dispose()
            }
            catch {
                [void]$errors.Add($_.Exception.Message)
            }
        }
    }

    try {
        Restore-ProjectModelChainEnvironment -OriginalEnvironment $Lease.OriginalEnvironment
    }
    catch {
        [void]$errors.Add($_.Exception.Message)
    }
    $Lease.Released = $true

    if ($errors.Count -gt 0) {
        throw "Project model-chain lock release failed: $($errors -join '; ')"
    }
}
