# Trigger Action Governance

Every governance action must explain what triggers it, who owns it, what weapon it uses, what artifact it produces, and how correctness is judged.

The map lives in `config/governance/trigger-action-map.json`.

## Covered Actions

- clarify intent
- fetch platform capability
- fetch dependency capability
- discover lens
- select best path
- ask user choice
- dispatch owner and weapon
- execute task
- review output
- verify user goal
- evolve writeback

## Pass / Fail

- Pass: action has trigger, owner, weapon, artifact, correct/wrong/done conditions.
- Fail: action only describes a concept.
- Fail: missing owner becomes generic fallback.
- Fail: workflow completion is treated as user-goal completion.
