import process from "node:process";
import { readJsonFromStdin } from "./utils.mjs";
import {
  readSpineStateIncludingInactive,
  terminalizeSpineState,
} from "./spine-state.mjs";

// Claude Code Stop entrypoint. Keep this runtime-facing adapter independent
// from the generic Codex/Cursor entrypoint: only the lifecycle implementation
// in spine-state.mjs is shared across runtimes.

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
    process.stderr.write(
      `[spine-cleanup] skipped stale Claude Stop request, reason=${result.reason || "authoritative_state_changed"}\n`,
    );
    process.exit(0);
  }
  if (evolutionCompleted) {
    process.stderr.write(
      `[spine-cleanup] Claude evolution completed, run=${result.runId || "unknown"} terminalized before spine state removal\n`,
    );
  } else {
    process.stderr.write(
      `[spine-cleanup] Claude spine deactivated at stage=${state.currentStage}, agents dispatched=${state.dispatchedAgents?.length || 0}\n`,
    );
  }
} catch {
  // Stop cleanup is advisory and must never prevent Claude Code shutdown.
}

process.exit(0);
