# Intent Amplification Acceptance

Flow completion is not user-goal completion. Meta_Kim must separately verify whether the user's surface request became a correct executable path and whether that path actually landed.

The contract lives in `config/governance/intent-amplification-contract.json`.

## Required Shape

The intent record must include real intent, subject, current state, target state, constraints, success criteria, non-goals, classified evidence, path candidates, selected path, first action, pass signal, kill signal, done condition, and score.

Public-ready is blocked until:

- intent amplification score is at least 90
- public-ready score is at least 90
- verification evidence exists
- userGoalDone is true

## Pass / Fail

- Pass: first action can be run and has pass/kill signals.
- Pass: shortest correct path was executed or explicitly rejected with reason.
- Fail: tests pass but the user target state is not reached.
- Fail: a document exists but cannot guide execution.
