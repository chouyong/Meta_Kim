// Single source of truth for the "cached global plugin provider coverage"
// route-validation contract. Kept as a side-effect-free module (like
// ./report-provider-budget.mjs) so both the standalone validator
// (scripts/validate-capability-routing.mjs) and the governance test
// (tests/governance/capability-routing.test.mjs) consume the SAME contract and
// cannot drift.
//
// Contract (see docs/diagnostics/meta-route-validate-plugins0-diagnosis.md):
//   1. capabilityProviderCoverage.localGlobalCached.plugins MUST exist and be a
//      non-negative finite number (structural invariant — the route output must
//      expose the coverage field, not that the machine has plugins installed).
//   2. plugins >= 1                      -> pass (unconditional; freshness-agnostic).
//   3. plugins === 0 AND fresh inventory -> pass (legitimate zero: a clean
//      machine with no global plugins installed, discovery succeeded).
//      "fresh" == globalInventoryFreshness.stale === false AND
//                 globalInventoryFreshness.generatedAt is non-empty.
//   4. plugins === 0 AND (generatedAt == null OR stale === true) -> fail; the
//      cache is missing or stale, so require a global-discovery refresh
//      (npm run discover:global) instead of silently passing a possibly-empty
//      route.
//   5. plugins field missing, non-number, negative, NaN, or Infinity -> fail
//      (structural anomaly must never be treated as a legitimate zero).

export const GLOBAL_PLUGIN_COVERAGE_REFRESH_COMMAND = "npm run discover:global";

function describeValue(value) {
  if (typeof value === "number") return String(value);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function inventoryIsFresh(freshness) {
  const generatedAt = freshness?.generatedAt;
  const hasGeneratedAt = generatedAt !== null && generatedAt !== undefined && generatedAt !== "";
  return freshness?.stale === false && hasGeneratedAt;
}

/**
 * Evaluate the cached global plugin provider coverage contract.
 *
 * @param {unknown} localGlobalCached - route ownerDiscoveryPacket
 *   .capabilityProviderCoverage.localGlobalCached (object exposing `.plugins`).
 * @param {unknown} globalInventoryFreshness - route ownerDiscoveryPacket
 *   .globalInventoryFreshness (object exposing `.stale` and `.generatedAt`).
 * @returns {{ ok: boolean, reason: string, message: string | null }}
 *   `ok` is the pass/fail verdict; `reason` is a stable machine code; `message`
 *   is a human-readable failure explanation (null on pass).
 */
export function evaluateGlobalPluginCoverage(localGlobalCached, globalInventoryFreshness) {
  const plugins = localGlobalCached?.plugins;

  // (1)/(5) structural invariant: the coverage field must be exposed as a
  // non-negative finite number. This rejects missing/undefined, non-number,
  // negative, NaN, and Infinity before any freshness reasoning.
  if (typeof plugins !== "number" || !Number.isFinite(plugins) || plugins < 0) {
    return {
      ok: false,
      reason: "plugin_coverage_structural_invalid",
      message:
        "Route output must expose capabilityProviderCoverage.localGlobalCached.plugins " +
        `as a non-negative finite number (received: ${describeValue(plugins)})`,
    };
  }

  // (2) at least one cached global plugin provider — always valid, regardless
  // of inventory freshness.
  if (plugins >= 1) {
    return { ok: true, reason: "plugin_coverage_present", message: null };
  }

  // plugins is in [0, 1) — effectively zero coverage. (3) legitimate only when
  // the global capability inventory is fresh (discovery ran and cache is not
  // stale); (4) otherwise the zero may be a missing/stale-cache artifact.
  if (inventoryIsFresh(globalInventoryFreshness)) {
    return { ok: true, reason: "plugin_coverage_legitimate_zero_fresh_inventory", message: null };
  }

  return {
    ok: false,
    reason: "plugin_coverage_zero_with_stale_or_missing_inventory",
    message:
      "Cached global plugin coverage is 0 and the global capability inventory is missing or stale " +
      `(generatedAt=${describeValue(globalInventoryFreshness?.generatedAt)}, ` +
      `stale=${describeValue(globalInventoryFreshness?.stale)}); run \`${GLOBAL_PLUGIN_COVERAGE_REFRESH_COMMAND}\` ` +
      "to refresh global capability discovery before route validation can pass",
  };
}
