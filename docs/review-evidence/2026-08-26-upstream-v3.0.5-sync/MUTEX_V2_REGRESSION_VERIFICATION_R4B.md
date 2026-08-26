# Mutex V2 Regression Verification R4B

## Scope

- Evidence snapshot: `2026-08-26T05:38:35.9583050Z`
- Candidate regression: `.meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/scripts/test_project_chain_mutex.ps1`
- Candidate eval: `.meta-kim/recovery/cross-model-lock-skill-staging-20260826/candidate/codex-review/evals/project-mutex-regression.json`
- This record verifies the final regression source, eval mapping, installed-copy hashes, and installed runtime probes. It does not start a Codex or Claude model request.

## Exact Hashes

| Artifact | Candidate SHA-256 | Codex installed SHA-256 | Claude installed SHA-256 | Result |
|---|---|---|---|---|
| `test_project_chain_mutex.ps1` | `7e56e790feb2793c9bf2e3e28534fba1d5336765b0152a55cd6a27a1ba8f23bf` | `7e56e790feb2793c9bf2e3e28534fba1d5336765b0152a55cd6a27a1ba8f23bf` | `7e56e790feb2793c9bf2e3e28534fba1d5336765b0152a55cd6a27a1ba8f23bf` | exact match |
| `project-mutex-regression.json` | `0a4a2e9f81fb838b2c7e7571feefd38a7fa770132e4adb869ed19bb552f2d6bc` | `0a4a2e9f81fb838b2c7e7571feefd38a7fa770132e4adb869ed19bb552f2d6bc` | `0a4a2e9f81fb838b2c7e7571feefd38a7fa770132e4adb869ed19bb552f2d6bc` | exact match |

## Static Validation

- Candidate PowerShell AST parse errors: `0`.
- Candidate eval JSON parse: pass.
- The regression checks three invokers for the shared helper binding, the project-root mutex derivation, the recursion marker, and absence of the V1 mutex name.
- The regression runs real child-process probes for same-project blocking, different-project concurrency, all supported path spellings, junction identity, drive-root preservation, recursion rejection, path-redacted key format, and abandoned-owner recovery.
- The `v1-to-v2-upgrade` eval case is bound to the separate deployment transaction evidence; the regression script does not claim to reenact the deployment.

## Installed Runtime Results

Both installed entrypoints were run sequentially with `-TempParent D:/knowledgeBase/Meta_Kim/.meta-kim/tmp/mutex-r4b`:

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

- Codex installed result: pass.
- Claude installed result: pass.
- D-drive temporary residue after both runs: `0`.

## Historical Evidence Boundary

- `CLAUDE_REVIEW_MUTEX_V2_R3B_REGRESSION_TIMEOUT.md` remains `NO_RESULT_TIMEOUT`, neither `GO` nor `HOLD`.
- Other current-code Claude `GO` receipts cover helper identity, deployer behavior, invoker integration, and Skill/private-rule contracts. They do not replace the missing regression-source review.
- R4B is a fresh single-question round for regression/eval sufficiency. It does not review the whole Skill package, release readiness, production deployment, security approval, or human adjudication.

## Claim Boundary

The executable evidence proves the helper/invoker regression probes and exact installed-copy parity. It does not prove that live Codex and Claude model requests were run concurrently. The model wrappers' actual mutex acquisition and recursion paths are covered by source review and no-model subprocess probes, while the project-scoped concurrency behavior is exercised at the shared mutex/helper boundary.
