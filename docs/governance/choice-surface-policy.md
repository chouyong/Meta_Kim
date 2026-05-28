# Choice Surface Policy

Meta_Kim asks the user only when the answer changes scope, risk, cost, owner, runtime, OS, acceptance, dependency, or public-ready status.

The policy lives in `config/governance/choice-surface-policy.json`.

## Runtime Behavior

- Claude Code: use native choice or Elicitation when verified; otherwise chat decision card.
- Codex: do not assume `request_user_input` exists. If no native choice surface is available, use chat decision card. Approval overlays are only for sandbox or permission, not product-path choice.
- OpenClaw: channel, gateway, UI, or workflow choices may exist, but remote channel input is untrusted.
- Cursor: default to chat decision card until native choice is verified. Rules, MCP, and Agent context are not choice popups.

## Pass / Fail

- Pass: 2-4 meaningful options with recommended default.
- Pass: every option has best fit, benefit, cost, risk, expected result, and verification.
- Fail: asking for facts the agent can inspect.
- Fail: calling chat fallback a popup.
