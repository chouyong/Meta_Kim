# Upstream v3.0.5 Sync Review Evidence

This directory contains the durable, repository-local evidence for merging upstream Meta_Kim `v3.0.5` into this fork.

## Git Lineage

- Fork baseline: `b3479c70e53bf49dcfe6bab1b68eec105fad89e3`
- Upstream release: `27328d07015e66ca8d311cf59a66fe4762b7b8ae` (`v3.0.5`)
- Merge commit: `d8e20c24fef42391ccac4e765735719f7aac3dad`
- Windows LF fixes: `f13bb9b761ab6104255498905d1c7b657520b3c2` and `c63676224786c57fd242fffa36766174f47bc5c6`

## Evidence Files

- `VERIFICATION_SUMMARY.md` records fresh checks, baseline comparisons, and explicit limitations.
- `CLAUDE_REVIEW_R1_NOTICE.md` preserves the sanitized scope of the first broad independent review request.
- `CLAUDE_REVIEW_R1_TIMEOUT.md` records that R1 produced no decision within its bounded observation window.
- `CLAUDE_REVIEW_R2_NOTICE.md` preserves the narrowed LF-only scope that was first created on the C drive.
- `CLAUDE_REVIEW_R2_INTERRUPTED.md` records that R2 was stopped for the user-directed D-drive migration and produced no receipt.
- `CLAUDE_REVIEW_R3_NOTICE.md` is the new D-drive-only, fail-closed review exchange for the Windows LF fix.
- `CLAUDE_REVIEW_R3_RECEIPT.md` is created only by the authorized Claude CLI review adapter after contract validation.

## Retention Boundary

The following temporary artifacts are intentionally not tracked:

- full generated diff files, because Git reconstructs them from the bound commits;
- local verification-report JSON, because it contains run-local state and absolute machine paths;
- generated Graphify output, because the repository already treats it as a local projection;
- temporary runtime projections, package caches, and isolated clones.

This evidence supports a normal non-force merge into the fork's `main`. It does not claim a new npm release, GitHub Release, production deployment, security approval, human adjudication, `release-grade`, `live-certified`, or `public-ready` status.

## Current Closure Index

`FINAL_CLOSURE_INDEX.md` is the current review and publication index for this directory. It records the LF/projection `R4` `GO`, mutex `R5B1`/`R7A`/`R7B` `GO` receipts, and preserves the historical `HOLD`, timeout, and interruption records without relabeling them.

`VERIFICATION_SUMMARY.md` remains an immutable R3-bound snapshot because its exact SHA-256 is embedded in the R3 notice. The final index supersedes it only for current review-round status and publication-closeout navigation; the summary's explicit limitations remain in force.

The mutex review receipts are narrow technical judgments. They do not claim live model-chain traffic, deployment or production approval, security release, human adjudication, release-grade, or public-ready status.
