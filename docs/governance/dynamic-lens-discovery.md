# Dynamic Lens Discovery

Lens discovery is not a fixed book list. Seeds are fallback data, not default decoration.

The seed catalog lives in `config/governance/lens-seed-catalog.json`; selection rules live in `config/governance/lens-discovery-policy.json`; the selector is `scripts/select-lenses.mjs`.

## Selection Rule

The candidate pool may contain 30 or more lenses, but final execution should use only 3-7. A selected lens must change at least one of:

- problem definition
- path selection
- risk recognition
- user choice options
- acceptance metrics
- execution action

## Pass / Fail

- Pass: selected lenses have reason and output impact.
- Pass: omitted lenses have omission reasons.
- Fail: every task uses the same seed list.
- Fail: final output claims a stack of famous books for show.
