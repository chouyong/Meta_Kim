## Findings

Reviewer: Claude CLI (Opus 5), read-only safe-mode. Sole file reviewed: `.meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/scripts/project_chain_mutex.ps1` (161 lines, as staged).

No blocking defect found for the single question. Basis:

1. Alias identity (junction vs canonical) — `Get-WindowsProjectDirectoryIdentity` (lines 96–103) calls `CreateFile` with `FILE_FLAG_BACKUP_SEMANTICS` (0x02000000) and **without** `FILE_FLAG_OPEN_REPARSE_POINT`, so a junction is traversed and the handle refers to the target directory. `GetFileInformationByHandle` therefore yields the target's `VolumeSerialNumber` + `FileIndexHigh/Low` for both the canonical path and the junction alias, so both collapse to one identity string and one mutex name. `desiredAccess = 0` is sufficient for metadata query, and share mode 1|2|4 avoids blocking other openers.
2. Distinctness — the identity `win32:<vsn:x8>:<idxHigh:x8><idxLow:x8>` (lines 118–121) uses fixed-width hex, so the volume and the two index halves cannot be ambiguously re-partitioned; distinct physical directories on any volume produce distinct strings, and the SHA-256 in `Get-ProjectChainMutexName` preserves that distinctness.
3. Drive-root preservation — `Resolve-ProjectChainRootPath` (lines 60–64) trims trailing separators only when `$fullPath.Length -gt $pathRoot.Length`. For `D:\` both lengths are 3, so the root separator is kept and `CreateFile` receives the valid `\\?\D:\`. For `D:\knowledgeBase\Meta_Kim` the trim applies harmlessly. For `\\server\share`, `GetPathRoot` returns the whole string, so no trim, and conversion yields `\\?\UNC\server\share`.
4. Extended-path handling — in `ConvertTo-WindowsExtendedDirectoryPath` the `\\?\` test (line 76) precedes the `\\` test (line 79), so already-extended and `\\?\UNC\` inputs are not double-prefixed; plain UNC is correctly rewritten with the `UNC\` form rather than `\\?\\\server`.
5. No path leakage — on Windows the pre-hash identity contains no path text at all; the returned name is `Local\CodexClaudeCliProjectChainV2-<64 lowercase hex>` (lines 154, 160), lowercase-invariant, session-local, ~110 chars, well under kernel object name limits.
6. Mechanics that could have been blocking and are not: `[ref]$information` against the `out` parameter is the supported PowerShell marshalling form; `Marshal.GetLastWin32Error()` reads the value cached at the P/Invoke boundary, so the intervening `$handle.IsInvalid` access does not clobber it; `Dispose()` on an invalid `SafeFileHandle` is safe; failure paths throw rather than falling back to a path-derived name.

Non-blocking observations (advisory only, not HOLD grounds):
- `Resolve-Path ... .Path` returns a PowerShell-provider path; for a non-filesystem or PSDrive-qualified root (e.g. `TestDrive:\x`) `GetFullPath`/`CreateFile` would fail. `.ProviderPath` would be strictly more robust.
- `GetFileInformationByHandle` file index is documented as not guaranteed stable/unique on ReFS (truncated 128-bit ID), and NTFS indices may be reused after deletion; both are tolerable for a lock-name derivation but are real theoretical collision sources.
- A `\\.\`-style device path would be mis-rewritten as `\\?\UNC\.\...`; not a realistic ProjectRoot.

## Actions Executed and Not Executed

Executed: read the notice; read the candidate helper in full; reasoned about Win32 semantics from source text only.
Not executed: no commands, no hashing or SHA-256 verification of the EVIDENCE lines, no writes/edits (including no receipt file, since the run is read-only), no git operations, no deployment, no credential access, no external messaging, no Codex/Claude sub-session/subagent/other-model invocation. I did not read the R2A timeout document, tests, invoker, deployer, or release material.

## Review Scope

Only the single question in the notice: whether the Windows implementation gives canonical path and junction alias the same non-path-revealing mutex name, different physical directories different names, and preserves drive roots. Only `project_chain_mutex.ps1` was examined. Excluded by the notice: non-Windows fallback correctness, test sufficiency, invoker/deployer, post-install behavior, docs, and release state.

## Evidence Gaps

- Cannot compute or confirm the declared SHA-256 values for the helper, the R2A document, or the notice itself; file identity is assumed from the stated path.
- Cannot execute the helper, so junction equivalence, drive-root opening, and redaction are argued from source semantics rather than observed output.
- Codex's regression run (path equivalence, junction, drive root, redaction assertions) is asserted in the notice and was neither reproduced nor inspected.
- No verification that the staged candidate matches what would be deployed.

## Residual Risks

- ReFS/128-bit file-ID truncation and NTFS index reuse could theoretically map two distinct directories to one mutex name.
- Provider-path vs filesystem-path handling in `Resolve-ProjectChainRootPath` may throw for PSDrive-qualified inputs.
- `Add-Type` occurs at import time; a constrained language mode or blocked compilation environment would break the helper before any identity logic runs.
- Identity is not stable across volume re-imaging or file-system-level directory recreation; that is inherent to index-based identity, not a defect.
- Because hashing was not verified, an unnoticed staging drift would invalidate this review.

FINAL_DECISION: GO
