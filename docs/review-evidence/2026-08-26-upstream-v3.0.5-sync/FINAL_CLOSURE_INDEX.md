# Upstream v3.0.5 Sync Final Closure Index

## Scope

- Candidate branch: `sync/upstream-v3.0.5-20260826`
- Candidate code tip before closure documents: `c63676224786c57fd242fffa36766174f47bc5c6`
- Fork baseline: `b3479c70e53bf49dcfe6bab1b68eec105fad89e3`
- Upstream release: `27328d07015e66ca8d311cf59a66fe4762b7b8ae` (`v3.0.5`)
- Integration commit: `d8e20c24fef42391ccac4e765735719f7aac3dad`
- Windows LF fixes: `f13bb9b761ab6104255498905d1c7b657520b3c2` and `c63676224786c57fd242fffa36766174f47bc5c6`

## Verification Closure

- Canonical capability index: SHA-256 `eea100ce4262472614202f8dd4710c32a086dca41b494462d3498e3c47e1b301`, `822` LF, `0` CRLF.
- Migration catalog: SHA-256 `c93ef2a468992ee0c1df4e4edf217736db9b1e26e075d124a1c9636f25828a29`, `901` LF, `0` CRLF.
- Four runtime capability-index mirrors converge byte-for-byte on the canonical capability index after the explicit `claude,codex,cursor,openclaw` sync.
- Migration catalog validation, capability-index inheritance (`30/30`), four-runtime checks, installed mutex regressions, and `git diff --check` passed in the recorded candidate evidence.
- Installed Codex and Claude mutex regressions both returned `PROJECT_CHAIN_MUTEX_TEST_PASS`; all declared booleans were true and D-drive temporary residue was `0`.

## Claude Review Matrix

| Round | Scope | Result |
|---|---|---|
| R3 | Windows LF rule design and the earlier CRLF observation | `HOLD` preserved as historical evidence; it does not describe current bytes |
| R4-LF | Current canonical LF bytes and four generated mirrors | `GO` |
| R3A / R3C / R3D / R3E / R4C | Mutex identity, deployer fix, invoker integration, contract, and rollback fixes | `GO` in their declared narrow scopes |
| R5B1 | Identity, same/different-project concurrency, and first four eval cases | `GO` |
| R5B2 / R6A | Source-reading micro-scopes for recovery/upgrade and recursion/recovery | `NO_RESULT_TIMEOUT`; no decision was manufactured |
| R7A | Embedded recursion and abandoned-owner excerpts; no repository tools | `GO` |
| R7B | Embedded V1-to-V2 deployment-transaction mapping; no repository tools | `GO` |
| R1 / R2 / R3B / R4B | Broad or superseded requests that timed out/interrupted | Preserved as `NO_RESULT_TIMEOUT` or interruption records; never promoted |

The R7A and R7B receipts are notice-only static judgments. They do not claim live Codex/Claude model traffic, deployment approval, production readiness, security approval, human adjudication, release-grade, or public-ready status. The complete regression and deployment claims remain bounded by Codex-run artifacts and the focused Claude receipts that explicitly cover those mechanisms.

## Publication Boundary

- This index and the complete D-drive evidence directory are intended for the non-force branch push and fast-forward merge into fork `main`.
- The exact evidence directory is otherwise ignored by the repository and must be force-added as one scoped path.
- Historical notices, receipts, `HOLD`, timeout, and interruption records are immutable audit evidence; later rounds use new filenames and do not overwrite them.
- The two canonical JSON files have no logical content change in this closeout; `.gitattributes` carries the exact LF policy.

## Explicit Limitations

- `meta:verify:all` stopped on the existing `v3.0.5` tag policy; this is not relabeled as a passing release gate.
- The packed setup test timed out, branch coverage remained below its unrelated threshold, and environment-sensitive pre-existing failures remain documented in `VERIFICATION_SUMMARY.md`.
- The mutex regression does not launch live model requests. Cross-direction runtime proof is helper/subprocess plus invoker-binding evidence, exactly as the eval modes state.
- `GO` in any Claude receipt is technical review for its named scope only, not production or human approval.

## Closure Criteria

The candidate is ready for publication only after this index and all intended evidence are committed, the candidate branch is pushed without force, fork `main` is fast-forwarded without rebase, a fresh fetch confirms remote SHA equality and the published file set, installed 15/15 hashes are rechecked, task-owned temporary assets are removed, and the final worktree is clean on `main`.
