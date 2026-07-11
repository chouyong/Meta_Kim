import test from "node:test";
import assert from "node:assert/strict";
import { selectReportProviderBudget } from "../../scripts/report-provider-budget.mjs";

const config = (id) => ({ id, type: "hooks", source: "project_runtime_hook_config_inventory" });
const rule = (id) => ({ id, type: "rules", source: "project_runtime_rule_inventory" });
const script = (id) => ({ id: `package-script:${id}`, type: "commands", source: "package_script_inventory" });

test("report budget keeps config + rules + scripts in-slice under a package-script flood", () => {
  const providers = [
    ...Array.from({ length: 200 }, (_, i) => script(`s${i}`)), // flood, master-order first
    config("codex-hooks-json"),
    config("claude-settings-json"),
    config("cursor-hooks-json"),
    config("openclaw-template-json"),
    rule("r0"),
    rule("r1"),
    rule("r2"),
  ];
  const picked = selectReportProviderBudget(providers, 80);
  assert.ok(picked.length <= 80, "budget cap respected");
  for (const id of ["codex-hooks-json", "claude-settings-json", "cursor-hooks-json", "openclaw-template-json"]) {
    assert.ok(picked.some((p) => p.id === id), `${id} must survive the flood`);
  }
  assert.ok(picked.some((p) => p.type === "rules"), "a rules provider must survive");
  assert.ok(
    picked.some((p) => p.id.startsWith("package-script:")),
    "a package-script provider must survive",
  );
});

test("over-quota rules do NOT starve package scripts (Codex R2 Blocking 5)", () => {
  const providers = [
    config("codex-hooks-json"),
    ...Array.from({ length: 200 }, (_, i) => rule(`r${i}`)), // rules way over any quota, and master-order ahead of scripts
    ...Array.from({ length: 200 }, (_, i) => script(`s${i}`)),
  ];
  const picked = selectReportProviderBudget(providers, 80);
  assert.equal(picked.length, 80, "budget is fully used");
  const scripts = picked.filter((p) => p.id.startsWith("package-script:")).length;
  assert.ok(picked.some((p) => p.id === "codex-hooks-json"), "config must survive");
  assert.ok(picked.some((p) => p.type === "rules"), "rules must be represented");
  assert.ok(
    scripts >= 8,
    `package scripts must keep their reserved floor even under a rules flood, got ${scripts}`,
  );
});

test("empty / undersized inputs are safe", () => {
  assert.deepEqual(selectReportProviderBudget([], 80), []);
  assert.deepEqual(selectReportProviderBudget(null, 80), []);
  assert.deepEqual(selectReportProviderBudget([config("a")], 0), []);
  assert.equal(selectReportProviderBudget([config("a"), script("b")], 1).length, 1);
});
