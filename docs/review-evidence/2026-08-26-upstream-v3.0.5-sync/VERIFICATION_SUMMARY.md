# Verification Summary

## Candidate

- Branch: `sync/upstream-v3.0.5-20260826`
- Candidate before documentation: `c63676224786c57fd242fffa36766174f47bc5c6`
- Fork baseline: `b3479c70e53bf49dcfe6bab1b68eec105fad89e3`
- Upstream baseline: `27328d07015e66ca8d311cf59a66fe4762b7b8ae`

## Fresh Evidence

| Check | Result | Classification |
|---|---|---|
| `git diff --check` | pass | candidate evidence |
| Canonical capability-index focused tests | 30/30 pass in the candidate and a fresh checkout | candidate evidence |
| Canonical capability-index bytes | 822 LF, 0 CRLF | candidate evidence |
| Migration-catalog bytes | 901 LF, 0 CRLF | candidate evidence |
| `npm run meta:agents:migration-catalog:check` | pass after the exact LF attribute was added | candidate evidence |
| `npm run meta:test:integration` | 1/1 pass, 0 skipped | candidate evidence |
| Live behavior tests | 81/81 pass, 0 skipped | candidate evidence |
| `npm run meta:graphify:verified-rebuild` and `npm run meta:graphify:check` | pass; graph bound to `c6367622`, `releaseSafeIdentity=true`, `freshnessVerified=true`, `semanticIdCollisions=0` | candidate evidence |

## Non-Passing Gates And Baseline Attribution

| Gate | Candidate result | Baseline comparison | Classification |
|---|---|---|---|
| `npm run meta:verify:all` | stopped before full verification because tag `v3.0.5` already exists | the task did not authorize a new version | release-policy stop, not a test pass or source regression |
| `npm run meta:release:smoke` | meta-theory stage: 1455 pass, 2 fail, 5 skipped | the same two `api-design` owner-set assertions fail on pre-sync fork `b3479c70`; pure upstream has additional local-inventory failures | pre-existing environment-sensitive gate failure |
| `npm run meta:test:setup:packed` | exceeded the 900-second stage limit | the narrowed `global-runtime-bundle` test also exceeded 900 seconds | timeout; not passed and not relabeled as source failure |
| `npm run meta:test:live:coverage` | 81/81 behavior tests pass; branch coverage 71.75% is below 80% | pure upstream `v3.0.5`: 81/81 pass; branch coverage 71.79% | upstream coverage gap |
| MCP memory hooks | 60/61 pass | the failing assertion received an existing live Memory Service recall instead of the isolated fixture; the affected test and hook sources are outside this sync diff | local service isolation conflict; no memory cleanup performed |

## Windows LF Root Cause

Two canonical JSON consumers compare deterministic UTF-8 bytes. A Windows checkout without path-specific attributes can materialize CRLF bytes even when the Git-normalized logical content is unchanged. The candidate adds only these rules:

```gitattributes
config/capability-index/meta-kim-capabilities.json text eol=lf
config/migrations/global-agent-projection-fingerprints.json text eol=lf
```

No logical JSON content change is included for either target. The rules avoid a broad `*.json` or `config/**` normalization policy.

## Claim Boundary

The collected evidence is sufficient to assess fork-main merge integrity and the two LF fixes. The packed timeout, upstream coverage gap, version-tag release stop, and environment-sensitive tests remain explicit limitations. They must not be converted into a release-grade claim.
