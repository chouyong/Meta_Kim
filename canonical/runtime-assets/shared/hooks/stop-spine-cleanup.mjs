import process from "node:process";
import { readJsonFromStdin } from "./utils.mjs";
import { readSpineStateIncludingInactive, terminalizeSpineState } from "./spine-state.mjs";

// Generic Codex/Cursor Stop entrypoint. Runtime-neutral lifecycle transitions
// live in spine-state.mjs; Claude Code keeps its own independent entrypoint.

await readJsonFromStdin();

const cwd = process.cwd();

try {
  const state = await readSpineStateIncludingInactive(cwd);
  if (!state) {
    process.exit(0);
  }

  const evolutionCompleted =
    state.deactivationReason === "evolution_completed" ||
    state.stages?.evolution?.status === "completed";
  const result = await terminalizeSpineState(cwd, {
    expectedRunId: state.runId,
    reason: evolutionCompleted ? "evolution_completed" : "session_stop",
    removeStateFile: evolutionCompleted,
  });
  if (!result.terminalized) {
    // Stop hooks must stay silent on Codex/Cursor: Codex treats stderr as a
    // failed hook even when the process exits 0. The authoritative state is
    // already persisted for diagnostics, so do not turn an informational
    // stale-stop note into a user-visible Hook failed result.
    process.exit(0);
  }
  // Successful cleanup is intentionally silent. Runtime-native Stop surfaces
  // do not need a diagnostic line, and stderr is interpreted as failure by
  // Codex even for exit code 0.
} catch {
  // Non-critical: never block session stop
}

process.exit(0);
