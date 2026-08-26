# Project-Scoped Cross-Model Mutex V2 Deployment Receipt

Deployment date: 2026-08-26

## Transaction Result

- Status: `PROJECT_CHAIN_MUTEX_V2_DEPLOYED`
- Legacy V1 mutex held for the complete transaction: yes
- Installed target count: `15`
- Installed targets matching exact candidate SHA-256: `15/15`
- Backup root: `D:/knowledgeBase/Meta_Kim/.meta-kim/recovery/cross-model-lock-skill-staging-20260826/deployment-backups/20260826T050852695Z`
- Existing-file backup count: `8`
- Backups matching exact D-drive `original/` SHA-256: `8/8`

No review notice, receipt, verification summary, or other audit document was created on the C drive. C-drive writes were limited to the three runtime Skill packages and the two private runtime rule files that the user explicitly authorized.

## Installed Files

- Three `project_chain_mutex.ps1` helpers
- Two `test_project_chain_mutex.ps1` regressions
- Two `project-mutex-regression.json` eval contracts
- Three `SKILL.md` entries
- Three CLI invokers
- Codex private `AGENTS.md`
- Claude private `CLAUDE.md`

Shared helper SHA-256:

`0add2c04b4d80e64608982a2109afa05391e76ffe57de07e9c0ff4a324759e77`

Shared regression SHA-256:

`7e56e790feb2793c9bf2e3e28534fba1d5336765b0152a55cd6a27a1ba8f23bf`

## Installed Syntax Verification

- Installed PowerShell files parsed: `9`
- AST parse errors: `0`

## Installed Runtime Regression

The installed Codex-side and installed Claude-side test entrypoints were each run with explicit C-drive installed roots and an explicit D-drive `-TempParent`.

Both returned:

```json
{
  "Status": "PROJECT_CHAIN_MUTEX_TEST_PASS",
  "SameProjectBlocked": true,
  "DifferentProjectConcurrent": true,
  "EquivalentPathsShareKey": true,
  "PhysicalAliasSharesKey": true,
  "DriveRootPreserved": true,
  "RecursionGuardVerified": true,
  "MutexNameRedactsPath": true,
  "AbandonedMutexRecovered": true
}
```

- Codex-side temporary residue: `0`
- Claude-side temporary residue: `0`

## Independent Review Boundary

Current-code Claude read-only `GO` receipts exist for:

- Windows physical-directory identity and mutex-name construction
- Fixed deployer exception and rollback paths
- All three invoker mutex/recursion integrations
- Three Skill entries and two private rule contracts

The regression-source review round timed out with no complete receipt and remains neither `GO` nor `HOLD`. It is not hidden or promoted. Executable evidence for that surface is the pre-deployment two-sided pass plus the installed two-sided pass.

## Rollback Boundary

The D-drive backup remains present until the upstream branch is committed, pushed, merged, and fetched back successfully. Final cleanup may remove the task-owned staging and backup root only after installed hashes and remote Git closure are both reverified.
