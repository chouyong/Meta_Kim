# Owner Weapon Routing

Meta_Kim routes execution by separating responsibility from capability:

- Owner: who is responsible for the result.
- Weapon: what is used to do the work.
- Dependency: which external project, if any, is reused.
- Runtime and OS: where it can actually execute.
- Verification owner: who proves it worked.

The route selector is `scripts/select-execution-route.mjs`. It scores intent fit, owner fit, weapon fit, dependency reuse, runtime support, OS support, verification strength, and risk clarity.

## Rules

- No owner without weapon.
- No execution without verification owner.
- No `general-purpose`, temporary, or fake owner.
- Governance agents do not become implementation workers.
- Reference-only material is not a dependency route candidate.

## Pass / Fail

- Pass: route output includes owner, weapon, dependency status, runtime, OS, verification, and score.
- Fail: owner is selected before capability discovery.
- Fail: route uses unsupported runtime as native.
- Fail: dependency is reused without input/output contract.
