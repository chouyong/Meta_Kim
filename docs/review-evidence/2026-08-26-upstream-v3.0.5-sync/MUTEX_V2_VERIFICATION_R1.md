# Project-Scoped Cross-Model Mutex V2 Verification

Evidence date: 2026-08-26

## Scope

This record covers the staged upgrade of the three existing cross-model CLI skills and the two private runtime rule files. It does not claim that the candidate has already been deployed, that the whole Meta_Kim release is ready, or that the operational skills satisfy the unrelated full `meta-skill-creator` public-package scaffold.

Candidate root:

`D:/knowledgeBase/Meta_Kim/.meta-kim/recovery/cross-model-lock-skill-staging-20260826/`

## Intended Behavior

- Calls targeting the same physical project directory serialize through one mutex.
- Calls targeting different physical project directories can run concurrently.
- Equivalent spellings and directory aliases, including junctions, resolve to the same mutex identity.
- Drive roots remain valid roots instead of being trimmed to drive-relative paths.
- The mutex name reveals only a SHA-256 digest, not the project path.
- Nested Codex/Claude model calls remain blocked by `CODEX_CLAUDE_CLI_CHAIN_ACTIVE`.
- A process-abandoned mutex is recoverable.
- Migration from the legacy user-wide V1 lock to V2 is coordinated by holding V1 during the transaction.

## Source Review Facts

- All three helpers are byte-identical and use the Windows directory handle identity `(volume serial number, file index high, file index low)` before hashing.
- All three invokers retain the recursion guard and release/dispose the mutex through nested `try/finally` blocks.
- The transaction deployer validates every current target against either the D-drive original backup or the exact candidate hash, creates its backup under the D-drive staging root, installs helpers before invokers, verifies every destination SHA-256, and rolls back every touched file before releasing V1 on failure.
- The regression keeps an observation handle alive before the abandoned-owner process exits, so the abandoned-mutex assertion observes the real .NET state.
- The recursion probe carries Base64-encoded arguments and does not mutate `ProcessStartInfo.Environment`, avoiding the host's simultaneous `PATH` and `Path` collision.

## PowerShell AST Verification

Result: `POWERSHELL_AST_PASS`

- Files parsed: 10
- Parse errors: 0
- Covered: three invokers, three helpers, two mutex regressions, the review-exchange validator, and the transaction deployer.

## Runtime Regression

The Codex-side and Claude-side regression scripts were each run from the D-drive candidate with an explicit D-drive `-TempParent`. Both returned the same result:

```json
{
  "Status": "PROJECT_CHAIN_MUTEX_TEST_PASS",
  "HelperSha256": "0add2c04b4d80e64608982a2109afa05391e76ffe57de07e9c0ff4a324759e77",
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

Temporary residue after each completed run: `0`.

Shared test SHA-256:

`7e56e790feb2793c9bf2e3e28534fba1d5336765b0152a55cd6a27a1ba8f23bf`

## Pre-Deployment Baseline

Result: `PREDEPLOY_HASH_BASELINE_PASS`

- Existing installed targets checked: 8
- Targets matching their D-drive `original/` backups: 8
- Drifted installed targets: 0
- Global files changed during this verification: 0
- Candidate deployment executed: no

This proves that the later transaction begins from the exact backed-up installation state. It does not prove deployment success; installed hashes and the runtime regression must be repeated after deployment.

## Meta-Skill Evidence Boundary

The generic `meta-skill-creator` package and closed-loop validators were also attempted against the three operational CLI skills. They require the complete meta-skill product scaffold, directory-name identity, baseline package, and public acceptance assets, so they reject these pre-existing operational skills for reasons unrelated to the mutex runtime change.

Classification: validator contract mismatch. The candidate is an `upgrade_existing_owner` installation candidate, not a newly public-ready meta-skill package. Acceptance for this change is therefore limited to exact source review, AST parsing, targeted runtime regression, independent Claude review, transaction deployment, and post-install verification.

## Closed Prior Findings

1. Path-string identity was replaced by stable physical-directory identity on Windows.
2. Drive-root trimming was corrected and covered by regression.
3. The abandoned-mutex fixture now observes the abandoned state with a live observer handle.
4. The recursion probe no longer edits the case-insensitive child environment dictionary.
5. Mutex release/disposal and multi-file deployment now have explicit fail-closed `try/finally` and rollback paths.

## Remaining Gate

The candidate remains undeployed until a new Claude read-only review receipt returns exactly one final decision marker and has no unresolved blocking finding. A `GO` will authorize only the stated technical scope; it will not be treated as release, security, production, or human approval.
