import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("prompt executability validator passes", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-prompt-executability.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("prompt abstract capability validator passes", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-prompt-abstract-capabilities.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "pass");
  assert.ok(output.promptLikeAssetsChecked > 0);
  assert.ok(
    output.privateEvidence.every(
      (item) =>
        item.status === "private_evidence_validated" ||
        (item.status === "private_evidence_not_attached" &&
          item.requiredForPublicValidation === false),
    ),
  );
});

test("prompt abstract capability validator reads the shared global inventory authority", () => {
  const userHome = mkdtempSync(join(tmpdir(), "meta-kim-prompt-inventory-home-"));
  const inventoryDir = join(
    userHome,
    ".meta-kim",
    "state",
    "default",
    "capability-index",
  );
  mkdirSync(inventoryDir, { recursive: true });
  writeFileSync(
    join(inventoryDir, "global-capabilities.json"),
    `${JSON.stringify({ summary: { totalSkills: 1 } }, null, 2)}\n`,
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["scripts/validate-prompt-abstract-capabilities.mjs"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          USERPROFILE: userHome,
          HOME: userHome,
          META_KIM_PROFILE: "default",
        },
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).status, "pass");
  } finally {
    rmSync(userHome, { recursive: true, force: true });
  }
});
