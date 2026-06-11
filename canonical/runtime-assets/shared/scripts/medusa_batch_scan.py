#!/usr/bin/env python3
"""Medusa AIContextScanner batch worker.

Reads file paths from stdin (one per line), keeps a single AIContextScanner
instance alive across the whole run, and emits one JSONL record per scanned
file to stdout. The first scan in any new Python process pays a ~150s YAML
rule-pack compile cost; subsequent scans cost ~0.16s. This worker exists so
the cold start is paid once per worker run, not once per file.

Output schema (one line per input path that we attempted to scan):

  {
    "file": "<absolute path>",
    "ok": true|false,
    "skipped": "not-applicable" | "missing" | null,
    "scan_ms": <int>,
    "summary": {"CRITICAL": int, "HIGH": int, "MEDIUM": int, "LOW": int, "INFO": int},
    "issues": [{"severity": "...", "rule_id": "...", "line": int, "message": "..."}],
    "scanner_version": "<medusa version or unknown>",
    "error": "<message>"  # only when ok=false
  }

If the medusa import itself fails, a single record is emitted to stdout with
{"file": null, "ok": false, "error": "import: ..."} and the worker exits 0.
fail-open is the contract — a hook calling this should treat any unexpected
state as "no findings".
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

# Surface-friendly truncation. Per file we keep at most this many issues in
# the compact findings.jsonl record. Override with env to keep more in
# findings.jsonl when the worker is running under triage. The full issue
# list is also written separately to findings-full/<id>.json so nothing is
# permanently lost to truncation.
def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    try:
        v = int(raw)
        return v if v > 0 else default
    except Exception:
        return default

MAX_ISSUES_PER_FILE = _env_int("META_KIM_MEDUSA_MAX_ISSUES_PER_FILE", 50)
# Per-issue message length cap, measured in CHARACTERS (not bytes). We avoid
# byte slicing to keep multi-byte codepoints intact.
MAX_MESSAGE_LEN = _env_int("META_KIM_MEDUSA_MAX_MESSAGE_LEN", 240)


def _emit(record: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(record, ensure_ascii=False))
    sys.stdout.write("\n")
    sys.stdout.flush()


def _truncate(message: str | None) -> str:
    if not message:
        return ""
    text = message.strip().replace("\n", " ")
    if len(text) > MAX_MESSAGE_LEN:
        return text[:MAX_MESSAGE_LEN] + "…"
    return text


def _scanner_version() -> str:
    try:
        import importlib.metadata as md

        return md.version("medusa")
    except Exception:
        try:
            import medusa  # type: ignore

            return getattr(medusa, "__version__", "unknown")
        except Exception:
            return "unknown"


def _scan_one(scanner, severity_enum, path: Path) -> dict[str, Any]:
    record: dict[str, Any] = {
        "file": str(path),
        "ok": True,
        "skipped": None,
        "scan_ms": 0,
        "summary": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0},
        "issues": [],
    }

    if not path.exists() or not path.is_file():
        record["ok"] = False
        record["skipped"] = "missing"
        return record

    try:
        applicable = scanner.can_scan(path)
    except Exception as exc:
        record["ok"] = False
        record["error"] = f"can_scan: {exc}"
        return record

    if not applicable:
        record["skipped"] = "not-applicable"
        return record

    started = time.perf_counter()
    try:
        result = scanner.scan_file(path)
    except Exception as exc:
        record["ok"] = False
        record["scan_ms"] = int((time.perf_counter() - started) * 1000)
        record["error"] = f"scan_file: {exc}"
        return record
    record["scan_ms"] = int((time.perf_counter() - started) * 1000)

    if not result.success:
        record["ok"] = False
        record["error"] = result.error_message or "scanner reported failure"
        return record

    issues = result.issues or []
    for issue in issues:
        try:
            sev = issue.severity.value
        except Exception:
            sev = "UNKNOWN"
        if sev in record["summary"]:
            record["summary"][sev] += 1

    truncated = issues[:MAX_ISSUES_PER_FILE]
    record["issues"] = [
        {
            "severity": (i.severity.value if hasattr(i.severity, "value") else str(i.severity)),
            "rule_id": i.rule_id,
            "line": i.line,
            "message": _truncate(i.message),
        }
        for i in truncated
    ]
    if len(issues) > MAX_ISSUES_PER_FILE:
        record["issues_truncated"] = len(issues) - MAX_ISSUES_PER_FILE
    # Full unbounded issue list (no MAX, no message truncation). The worker
    # writes this to findings-full/<id>.json so triage and audit have the
    # complete record. Compact `issues` above is what gets shown to humans.
    record["issues_full"] = [
        {
            "severity": (i.severity.value if hasattr(i.severity, "value") else str(i.severity)),
            "rule_id": i.rule_id,
            "line": i.line,
            "column": i.column,
            "code": i.code,
            "cwe_id": i.cwe_id,
            "message": (i.message or "").replace("\r\n", "\n"),
        }
        for i in issues
    ]
    return record


def main() -> int:
    try:
        from medusa.scanners.ai_context_scanner import AIContextScanner
        from medusa.scanners.base import Severity
    except Exception as exc:
        _emit({"file": None, "ok": False, "error": f"import: {exc}"})
        return 0

    try:
        scanner = AIContextScanner()
    except Exception as exc:
        _emit({"file": None, "ok": False, "error": f"construct: {exc}"})
        return 0

    version = _scanner_version()

    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        path = Path(line)
        record = _scan_one(scanner, Severity, path)
        record["scanner_version"] = version
        _emit(record)

    return 0


if __name__ == "__main__":
    sys.exit(main())
