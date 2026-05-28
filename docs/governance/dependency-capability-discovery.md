# Dependency Capability Discovery

Dependency projects are reusable capabilities only when they are searchable, scored, callable, and verifiable. A mention in README is not enough.

The registry lives in `config/capability-index/dependency-project-registry.json`. Run `npm run meta:deps:discover` to create `.meta-kim/state/default/dependency-capability-index.json`.

## Reference-Only Material

Some projects are useful as references but must not become dependencies. `Kim_Decision` is handled this way: its useful ideas were distilled into `config/governance/decision-pattern-catalog.json`, while the project itself is marked reference-only in discovery output.

Reference-only means:

- no invocation path
- no dependency route candidate
- no owner or weapon binding
- no claim that Meta_Kim requires it to run

## Pass / Fail

- Pass: dependency projects have capability cards, input/output contracts, interface, scoring, and verification.
- Pass: reference-only projects are absorbed into Meta_Kim data at the correct stage boundary.
- Fail: a README mention becomes an invokable dependency.
- Fail: a dependency can be selected without verification.
