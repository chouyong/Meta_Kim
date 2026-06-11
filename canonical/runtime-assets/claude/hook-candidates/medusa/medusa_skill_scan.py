#!/usr/bin/env python3
"""⚠️ CANDIDATE — NOT REGISTERED. Single-file PreToolUse helper, deprecated.

The v3 plan replaces this with a batch worker that keeps a single
AIContextScanner instance alive across many file paths, amortising the ~150s
cold start. See canonical/runtime-assets/shared/scripts/medusa-worker.mjs and
the PostToolUse enqueue hook for the current implementation.

Kept only as a reference for the per-file decision shape and severity tiering
contract. Do not invoke from a registered hook.

Original module docstring follows.
---

Medusa AI-context scan helper for the Meta_Kim PreToolUse hook.

Invoked by `medusa-skill-scan.mjs` as `python <this> <file_path>`. Emits a
single JSON line to stdout describing the decision the Node hook should make:

  {"decision":"block","reason":"..."}    severity CRITICAL or HIGH
  {"decision":"hint","reason":"..."}     severity MEDIUM only
  {"decision":"none"}                    nothing actionable, or unsupported file
  {"decision":"none","error":"..."}      medusa import or scan blew up

Exit code is always 0 — fail-open is the contract. The Node hook decides what
to do with the JSON; this script never blocks by exiting non-zero.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

MAX_REASON_BYTES = 1500
MAX_ISSUES_IN_REASON = 8


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def _format_issue(issue) -> str:
    rule = issue.rule_id or "?"
    line = issue.line if issue.line is not None else "?"
    msg = (issue.message or "").strip().replace("\n", " ")
    if len(msg) > 160:
        msg = msg[:160] + "…"
    return f"  [{issue.severity.value}] {rule} line {line}: {msg}"


def _build_reason(label: str, issues: list, scanner_name: str) -> str:
    head = f"[medusa/{scanner_name}] {label} ({len(issues)} issue{'s' if len(issues) != 1 else ''})"
    body_lines = [_format_issue(i) for i in issues[:MAX_ISSUES_IN_REASON]]
    if len(issues) > MAX_ISSUES_IN_REASON:
        body_lines.append(f"  … {len(issues) - MAX_ISSUES_IN_REASON} more")
    reason = "\n".join([head, *body_lines])
    if len(reason.encode("utf-8")) > MAX_REASON_BYTES:
        reason = reason.encode("utf-8")[:MAX_REASON_BYTES].decode("utf-8", errors="ignore") + "…"
    return reason


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        _emit({"decision": "none", "error": "missing file_path argument"})
        return 0

    target = Path(argv[1])
    if not target.exists() or not target.is_file():
        _emit({"decision": "none"})
        return 0

    try:
        from medusa.scanners.ai_context_scanner import AIContextScanner
        from medusa.scanners.base import Severity
    except Exception as exc:
        _emit({"decision": "none", "error": f"medusa import failed: {exc}"})
        return 0

    try:
        scanner = AIContextScanner()
        if not scanner.can_scan(target):
            _emit({"decision": "none"})
            return 0
        result = scanner.scan_file(target)
    except Exception as exc:
        _emit({"decision": "none", "error": f"scan failed: {exc}"})
        return 0

    if not result.success:
        _emit({"decision": "none", "error": result.error_message or "scanner reported failure"})
        return 0

    blocking = [i for i in result.issues if i.severity in (Severity.CRITICAL, Severity.HIGH)]
    if blocking:
        _emit({
            "decision": "block",
            "reason": _build_reason("CRITICAL/HIGH findings", blocking, scanner.name),
        })
        return 0

    hinting = [i for i in result.issues if i.severity == Severity.MEDIUM]
    if hinting:
        _emit({
            "decision": "hint",
            "reason": _build_reason("MEDIUM findings", hinting, scanner.name),
        })
        return 0

    _emit({"decision": "none"})
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
