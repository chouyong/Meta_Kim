#!/usr/bin/env node
import path from "node:path";
import { loadEffectiveRuntimeCapabilityClaims } from "./effective-runtime-capability-claims.mjs";
import { loadRuntimeCapabilityAcceptanceAttempts, produceRuntimeCapabilityAcceptance } from "./runtime-capability-acceptance.mjs";
import {
  loadRuntimeCapabilityFailureObservations,
  runtimeCapabilityFailureRemediation,
} from "./runtime-capability-failure-observations.mjs";
import { assertExactStandardRuntimeObservationSet, standardRuntimeObservationSet } from "./runtime-execution-gate.mjs";

const SUPPORTED_RUNTIMES = new Set(["claude_code", "codex"]);
const SUPPORTED_CAPABILITIES = new Set(["agent", "subagent", "shell", "filesystem", "apply_patch / edit"]);
const VALUE_OPTIONS = new Set(["--runtimes", "--capabilities", "--project-root", "--profile", "--source", "--codex-thread-id", "--codex-child-session-id", "--codex-marker", "--since", "--codex-desktop-engineering-workspace", "--claude-session-id", "--claude-marker", "--claude-runtime-workspace"]);
const BOOLEAN_OPTIONS = new Set(["--status", "--require-fresh"]);

function printHelp() {
  process.stdout.write(`Usage: node scripts/run-runtime-capability-producers.mjs [options]\n\n` +
    `Runs controlled, capability-specific Claude Code and Codex probes.\n\n` +
    `Options:\n` +
    `  --runtimes <list>       Comma-separated: claude_code,codex\n` +
    `  --capabilities <list>   Comma-separated controlled capabilities\n` +
    `  --project-root <path>   Trusted marker-backed project root\n` +
    `  --profile <name>        Acceptance profile (default: META_KIM_PROFILE/default)\n` +
    `  --status                Read fresh accepted production evidence; never invoke a runtime\n` +
    `  --require-fresh         Exit nonzero when any requested claim is missing/stale\n` +
    `  --source <kind>         live_controlled|codex_desktop_agent_subagent|codex_tui_agent_subagent|codex_desktop_engineering|claude_interactive_session_handoff\n` +
    `  --codex-thread-id <id>  Use one explicit Codex parent session\n` +
    `  --codex-child-session-id <id>  Bind the exact spawned child session\n` +
    `  --codex-marker <token>   Exact child-final capability marker\n` +
    `  --since <ISO time>       Reject Desktop evidence older than this time\n` +
    `  --codex-desktop-engineering-workspace <path>  Attest an existing Desktop chain\n` +
    `  --claude-session-id <id>  Bind one existing interactive Claude Code project session\n` +
    `  --claude-marker <token>  Exact five-facet handoff marker\n` +
    `  --claude-runtime-workspace <path>  Controlled handoff workspace under project state\n` +
    `  -h, --help              Show this help without invoking a runtime\n`);
}

function failCli(message) {
  process.stderr.write(`controlled runtime capability producer failed: ${message}\n`);
  process.exit(1);
}

function option(args, name, fallback) {
  const exact = args.indexOf(name);
  if (exact >= 0) return args[exact + 1] ?? fallback;
  return args.find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  const optionName = argument.split("=", 1)[0];
  if (!optionName.startsWith("-") || (!VALUE_OPTIONS.has(optionName) && !BOOLEAN_OPTIONS.has(optionName))) {
    failCli(`unknown option: ${argument}`);
  }
  if (BOOLEAN_OPTIONS.has(optionName)) {
    if (argument !== optionName) failCli(`${optionName} does not accept a value`);
    continue;
  }
  if (!argument.includes("=")) {
    const value = args[index + 1];
    if (!value || value.startsWith("-")) failCli(`${optionName} requires a value`);
    index += 1;
  }
}
const runtimes = option(args, "--runtimes", "claude_code,codex").split(",").map((entry) => entry.trim()).filter(Boolean);
const capabilities = option(args, "--capabilities", "agent,subagent,shell,filesystem,apply_patch / edit").split(",").map((entry) => entry.trim()).filter(Boolean);
for (const runtime of runtimes) {
  if (!SUPPORTED_RUNTIMES.has(runtime)) failCli(`unsupported runtime: ${runtime}`);
}
for (const capability of capabilities) {
  if (!SUPPORTED_CAPABILITIES.has(capability)) failCli(`unsupported capability: ${capability}`);
}
const projectRoot = path.resolve(option(args, "--project-root", process.env.META_KIM_CALLER_CWD || process.cwd()));
const profile = option(args, "--profile", process.env.META_KIM_PROFILE);
const source = option(args, "--source", null);
const statusRequested = args.includes("--status") || source == null;
const requireFresh = args.includes("--require-fresh");
const threadId = option(args, "--codex-thread-id", undefined);
const childSessionId = option(args, "--codex-child-session-id", undefined);
const marker = option(args, "--codex-marker", undefined);
const sinceRaw = option(args, "--since", undefined);
const sinceMs = sinceRaw ? Date.parse(sinceRaw) : null;
const workspacePath = option(args, "--codex-desktop-engineering-workspace", undefined);
const claudeSessionId = option(args, "--claude-session-id", undefined);
const claudeMarker = option(args, "--claude-marker", undefined);
const claudeWorkspacePath = option(args, "--claude-runtime-workspace", undefined);
if (source && statusRequested) failCli("--status cannot be combined with --source");
if (sinceRaw && !Number.isFinite(sinceMs)) failCli("--since must be a valid timestamp");
if (source === "claude_interactive_session_handoff") {
  if (runtimes.length !== 1 || runtimes[0] !== "claude_code") failCli("Claude interactive session handoff requires --runtimes claude_code");
  if (JSON.stringify(capabilities) !== JSON.stringify(["agent", "subagent", "shell", "filesystem", "apply_patch / edit"])) {
    failCli("Claude interactive session handoff requires the exact five standard capabilities in canonical order");
  }
  if (!claudeSessionId || !claudeMarker || !claudeWorkspacePath || !Number.isFinite(sinceMs)) {
    failCli("Claude interactive session handoff requires session, marker, workspace, and since");
  }
}
try {
  if (statusRequested) {
    const effective = loadEffectiveRuntimeCapabilityClaims({ packageRoot: path.resolve(import.meta.dirname, ".."), projectRoot, profile });
    const store = loadRuntimeCapabilityAcceptanceAttempts({ projectRoot, profile });
    const failureStore = loadRuntimeCapabilityFailureObservations({ projectRoot, profile });
    const results = [];
    const missing = [];
    for (const runtime of runtimes) for (const capability of capabilities) {
      const applied = effective.overlayStatus.applied.find((entry) => entry.runtime === runtime && entry.capability === capability && entry.mode === "interactive_host");
      const attempt = applied ? store.attempts.find((entry) => entry.attemptId === applied.attemptId) : null;
      if (!attempt || attempt.testOnly === true || attempt.attestationAuthority !== "controlled_producer") {
        missing.push({ runtime, capability, mode: "interactive_host" });
        continue;
      }
      results.push({ runtime, capability, mode: attempt.mode, attemptId: attempt.attemptId, receiptSha256: attempt.sourceReport.sha256, producer: attempt.producer?.id, source: attempt.sourceReport.kind, observedAt: attempt.observedAt });
    }
    const negativeObservations = failureStore.observations
      .filter((entry) => entry.testOnly !== true && runtimes.includes(entry.runtime) && capabilities.includes(entry.capability))
      .map((entry) => ({
        observationId: entry.observationId,
        runtime: entry.runtime,
        capability: entry.capability,
        mode: entry.mode,
        outcome: entry.outcome,
        blockedFromRelease: entry.blockedFromRelease,
        failureClass: entry.failureClass,
        failureText: entry.failureText,
        observedAt: entry.observedAt,
      }));
    const failureRemediation = runtimeCapabilityFailureRemediation(negativeObservations);
    const payload = { schemaVersion: "meta-kim-controlled-producer-status-v1", ok: missing.length === 0, readOnly: true, projectRoot: "<project>", profile: profile ?? "default", results, missing, negativeObservations, remediation: missing.length ? failureRemediation ?? "Run: meta-kim runtime produce --source <supported-source> --runtimes <runtime> --capabilities <capabilities> [source binding options]" : null };
    payload.evidenceClass = "advisory_persisted_observation";
    payload.observedInCurrentRun = false;
    payload.executionAuthority = false;
    payload.standardSet = standardRuntimeObservationSet();
    if (runtimes.length === 2 && capabilities.length === 5) assertExactStandardRuntimeObservationSet([...results, ...missing]);
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    if (requireFresh && missing.length) process.exitCode = 1;
  } else {
    if (source === "codex_desktop_agent_subagent" && (!threadId || !childSessionId || !marker || !Number.isFinite(sinceMs))) failCli("desktop agent source requires thread, child session, marker, and since");
    if (source === "codex_tui_agent_subagent" && (!threadId || !childSessionId || !marker || !Number.isFinite(sinceMs))) failCli("tui agent source requires thread, child session, marker, and since");
    if (source === "codex_desktop_engineering" && (!threadId || !marker || !workspacePath || !Number.isFinite(sinceMs))) failCli("desktop engineering source requires thread, marker, workspace, and since");
    const producedResults = [];
    const failureObservations = [];
    for (const runtime of runtimes) {
      const produced = await produceRuntimeCapabilityAcceptance({
        projectRoot,
        profile,
        source,
        runtime,
        capabilities,
        threadId,
        childSessionId,
        sessionId: claudeSessionId,
        marker: source === "claude_interactive_session_handoff" ? claudeMarker : marker,
        sinceMs,
        workspacePath: source === "claude_interactive_session_handoff"
          ? path.resolve(claudeWorkspacePath)
          : workspacePath ? path.resolve(workspacePath) : undefined,
      });
      if (produced.outcome === "fail") {
        failureObservations.push({
          observationId: produced.observation.observationId,
          runtime: produced.observation.runtime,
          capability: produced.observation.capability,
          mode: produced.observation.mode,
          outcome: produced.observation.outcome,
          blockedFromRelease: produced.observation.blockedFromRelease,
          failureClass: produced.observation.failureClass,
          failureText: produced.observation.failureText,
          observedAt: produced.observation.observedAt,
        });
        continue;
      }
      for (const entry of produced.results ?? []) producedResults.push({ runtime, capability: entry.capability ?? entry.receipt?.capability, mode: "interactive_host", attemptId: entry.acceptance.record.attemptId, receiptSha256: entry.acceptance.record.sourceReport.sha256, producer: entry.receipt.producer.id, source: entry.receipt.compositeLifecycle?.sourceCategory ?? "live_controlled" });
    }
    process.stdout.write(`${JSON.stringify({ schemaVersion: "meta-kim-controlled-producer-run-v2", ok: failureObservations.length === 0, projectRoot: "<project>", profile: profile ?? "default", results: producedResults, failureObservations }, null, 2)}\n`);
    if (failureObservations.length > 0) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`controlled runtime capability producer failed: ${error.message}\n`);
  process.exitCode = 1;
}
