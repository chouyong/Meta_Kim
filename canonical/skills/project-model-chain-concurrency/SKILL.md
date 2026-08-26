---
name: project-model-chain-concurrency
description: Coordinate external model CLI chains by physical project identity so the same project is mutually exclusive across Codex, Claude Code, and future runtimes while different projects can run concurrently. Use before cross-model review, development, verification, or any runtime-to-runtime CLI invocation that can act on a project.
allowed-tools: Read Bash(powershell:*)
---

# Project Model Chain Concurrency

Use one runtime-neutral lock contract for external model CLI chains. This Skill owns concurrency only; it does not own review protocol, development scope, temporary-file cleanup, or Git publication.

## First Action

Before reading a review notice, writing a receipt, creating temporary model input, or starting another model CLI:

1. Resolve the exact existing project directory.
2. Dot-source `scripts/project_model_chain_concurrency.ps1` from the current runtime's global Skill installation.
3. Call `Enter-ProjectModelChainLock -ProjectRoot <path> -TimeoutMilliseconds 0`.
4. Stop fail-closed if acquisition fails.

Keep the returned lease in the same PowerShell invocation and release it in `finally` with `Exit-ProjectModelChainLock -Lease $lease`.
Release on the same thread that acquired the lease; a wrong-thread attempt fails without consuming it.

## Contract

- The key is derived from the physical Windows directory identity, not the path text.
- Case, slash direction, trailing separators, dot segments, junctions, symbolic links, substituted drives, and short/long aliases to one physical directory share a key.
- The same physical project is mutually exclusive across all external model-chain directions.
- Different physical projects may run concurrently in independent processes.
- `META_KIM_PROJECT_MODEL_CHAIN_ACTIVE` blocks recursive model chains. During migration, `CODEX_CLAUDE_CLI_CHAIN_ACTIVE` is also checked and set.
- Lock names contain only a versioned namespace and SHA-256 digest; raw project paths never enter the name.
- Missing directories, files passed as project roots, identity lookup failures, recursive calls, and lock contention all fail closed before model-chain side effects.
- The current adapter is verified only on Windows. Do not claim POSIX symlink/inode safety until a device/inode implementation and regression exist.

## Compatibility Bridge

New consumers acquire both the previous V2 mutex and the runtime-neutral mutex in a fixed order. This keeps already-running V2 consumers mutually exclusive during migration. Do not remove the bridge until every known consumer has migrated and all older Codex/Claude processes have exited.

Detailed caller and migration rules are in `references/integration-contract.md`.

## Verification

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test_project_model_chain_concurrency.ps1
```

The test must exercise actual child processes and must not invoke any model.
