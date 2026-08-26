# Integration Contract

## Public API

```powershell
$lease = Enter-ProjectModelChainLock -ProjectRoot $root -TimeoutMilliseconds 0
try {
    # Resolve request artifacts and start exactly one external model chain.
}
finally {
    if ($lease) {
        Exit-ProjectModelChainLock -Lease $lease
    }
}
```

- `Get-ProjectModelChainMutexName` returns the runtime-neutral diagnostic name.
- `Get-ProjectModelChainLegacyMutexName` exists only for migration tests and compatibility shims.
- `Get-ProjectChainMutexName` is a deprecated compatibility alias that returns the legacy V2 name.
- A lease must be released on the same PowerShell thread that acquired it. A wrong-thread release fails before disposing handles or marking the lease released, so the acquiring thread can still recover.

## Caller Rules

- Acquire before notice/brief parsing, receipt creation, temporary schema creation, version probes that launch the target CLI, or any model request.
- Hold the lease only while the external model CLI chain is live. Do not hold it while waiting for human review or an asynchronous file handoff.
- Never create a runtime-specific lock algorithm, namespace, or recursion flag.
- Do not reuse the lock for ordinary Git, build, test, or editing operations.
- Do not log the project identity input or raw project path as lock telemetry.

## Migration Order

1. Install the public Skill in every participating runtime home.
2. Change all consumers to the public `Enter`/`Exit` API.
3. Replace copied legacy helpers with thin shims that dot-source the public helper.
4. Verify public Skill hashes, consumer bindings, same-project blocking, different-project overlap, alias identity, abandoned recovery, recursion, and partial-acquisition rollback.
5. After every old process has exited, remove the compatibility bridge in a separately reviewed release.

The bridge computes the physical-directory digest once, then acquires `Local\CodexClaudeCliProjectChainV2-<digest>` before `Local\MetaKimProjectModelChainV1-<digest>`. All new consumers use the same order; a failed second acquisition releases the first.
