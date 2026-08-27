import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFilePath } from "../../canonical/runtime-assets/shared/hooks/utils.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hookRoot = path.join(repoRoot, "canonical", "runtime-assets", "claude", "hooks");

function runHook(name, payload) {
  return spawnSync(process.execPath, [path.join(hookRoot, name)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    cwd: repoRoot,
  });
}

describe("PostToolUse hooks", () => {
  test("ignore non-string file paths without failing", () => {
    const payloads = [
      { tool_name: "Edit", tool_input: { file_path: {} } },
      { tool_name: "Write", tool_input: { file_path: ["file.ts"] } },
      { tool_name: "Edit", tool_input: { file_path: null } },
      { tool_name: "Write", tool_input: { file_path: { path: "file.ts" } } },
      null,
      [],
      "file.ts",
      42,
      true,
    ];

    for (const payload of payloads) {
      for (const hook of ["post-format.mjs", "post-typecheck.mjs", "post-console-log-warn.mjs"]) {
        const result = runHook(hook, payload);
        assert.equal(result.status, 0, `${hook}: ${result.stderr}`);
      }
    }
  });

  test("preserve valid paths while rejecting non-string candidates", () => {
    assert.equal(extractFilePath({ tool_input: { file_path: "file.ts" } }), "file.ts");
    assert.equal(extractFilePath({ file_path: {}, path: "fallback.ts" }), "fallback.ts");
    assert.equal(extractFilePath({ tool_input: { file_path: ["file.ts"] } }), "");
    assert.equal(extractFilePath(null), "");
    assert.equal(extractFilePath([]), "");
  });
});
