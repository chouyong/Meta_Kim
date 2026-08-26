# Project-Scoped Mutex V2 Deployer Verification R2

Evidence date: 2026-08-26

Current deployer SHA-256:

`c458455236bc6e290558c3e41e157e2b8f2f05de1c51e0816d610c8a9bb1c835`

## Why R2 Exists

Claude R3C returned `GO` for the prior deployer hash but reported two non-blocking exception-path findings:

1. The active entry entered `touched` only after `File.Copy`, so a mid-stream partial write could be skipped by rollback.
2. One rollback-time exception stopped all later restores and masked the original deployment error.

The deployer was changed after that receipt, so the earlier `GO` remains historical evidence and does not approve the current hash.

## Fixes

- Store the pre-deployment target SHA-256 in each entry.
- Verify every backup SHA-256 before adding the entry to the mutation set.
- Add each entry to `touched` before attempting the candidate copy, making partial-write recovery eligible.
- Catch rollback failures per entry, continue the reverse rollback, aggregate all rollback failure messages, and retain the original deployment exception as the inner exception.

## Fresh Verification

PowerShell AST result:

- Parse errors: `0`

Isolated success fixture:

- Status: `PROJECT_CHAIN_MUTEX_V2_DEPLOYED`
- Destination count: `15`
- Destination hashes matching declared candidates: `15/15`

Isolated failure fixture:

- Injected failure: make the third helper destination a directory so `File.Copy` fails after the first two new helpers were installed.
- Deployment failure observed: yes
- Previously written helper files removed by reverse rollback: yes
- Pre-existing Skill and rule targets remained equal to their original hashes: yes
- The injection directory itself remained as fixture-owned state and was removed with the exact test root during cleanup.

Cleanup evidence:

- `deployer-integration-*` temporary directory residue: `0`
- New `deployment-backups/*` directory residue: `0`

## Remaining Boundary

The integration fixture proves the success path and a multi-entry copy-failure rollback path. It does not simulate power loss, process kill, ACL change during rollback, or disk exhaustion during backup creation. Those host-level failures remain bounded by exact D-drive backups and fail-closed status reporting, not by a cross-file atomic filesystem transaction.
