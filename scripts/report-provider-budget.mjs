// Deterministic capped report budget for route provider discovery
// (ownerDiscoveryPacket.projectRuntimeCapabilityProviders).
//
// DECOUPLED from the shared execution provider master order in
// select-execution-route.mjs: reordering that master array would change
// resolveProvider tie-breaks (equal-score ties keep the first provider in array
// order), so report shaping must never touch it (Codex R2 Blocking 4). This
// function derives the report slice separately.
//
// Reserves BOUNDED minimums per family so:
//   - >140 package-script providers cannot evict the scarce runtime hook-config
//     and rules providers the capability-routing validators require in-slice;
//   - an over-large config/rules family cannot evict package scripts either
//     (Codex R2 Blocking 5).
// Remaining slots fill from the caller's (master) order.
export function selectReportProviderBudget(providers, cap) {
  const list = Array.isArray(providers) ? providers : [];
  const limit = Number.isInteger(cap) && cap > 0 ? cap : 0;
  const picked = [];
  const seen = new Set();
  const take = (p) => {
    if (!p || seen.has(p) || picked.length >= limit) return;
    seen.add(p);
    picked.push(p);
  };
  const isConfig = (p) => p?.source === "project_runtime_hook_config_inventory";
  const isRules = (p) => p?.type === "rules";
  const isScript = (p) =>
    typeof p?.id === "string" && p.id.startsWith("package-script:");
  const reserveN = (pred, n) => {
    let taken = 0;
    for (const p of list) {
      if (taken >= n) break;
      if (!seen.has(p) && pred(p)) {
        take(p);
        taken += 1;
      }
    }
  };
  reserveN(isConfig, 8); // runtime hook-config providers are scarce (<=4): keep all
  reserveN(isRules, 4); // guarantee rules visibility, bounded so rules can't flood
  reserveN(isScript, 8); // guarantee package-script presence, bounded
  for (const p of list) take(p); // fill remaining slots in master order
  return picked;
}
