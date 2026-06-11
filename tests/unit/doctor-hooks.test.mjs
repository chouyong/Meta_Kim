import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { extractCommandPath } from "../../scripts/doctor-hooks.mjs";

describe("doctor-hooks extractCommandPath", () => {
  test("should detect direct script command correctly", () => {
    assert.strictEqual(
      extractCommandPath("./hook.sh"),
      "./hook.sh"
    );
    assert.strictEqual(
      extractCommandPath(".claude/hooks/foo.mjs"),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath(".claude/hooks/foo.js"),
      ".claude/hooks/foo.js"
    );
  });

  test("should skip known runner and return correct script target", () => {
    assert.strictEqual(
      extractCommandPath("node .claude/hooks/foo.mjs"),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath("python3 C:/repo/hooks/memory.py"),
      "C:/repo/hooks/memory.py"
    );
    assert.strictEqual(
      extractCommandPath("python C:/repo/hooks/memory.py"),
      "C:/repo/hooks/memory.py"
    );
    assert.strictEqual(
      extractCommandPath("bash ./hook.sh"),
      "./hook.sh"
    );
  });

  test("should skip runner with absolute or windows executable paths", () => {
    assert.strictEqual(
      extractCommandPath("C:/node/node.exe C:/repo/.claude/hooks/x.mjs"),
      "C:/repo/.claude/hooks/x.mjs"
    );
    assert.strictEqual(
      extractCommandPath("C:\\Python312\\python.exe C:\\repo\\.claude\\hooks\\memory.py"),
      "C:\\repo\\.claude\\hooks\\memory.py"
    );
    assert.strictEqual(
      extractCommandPath("/usr/bin/python3 /usr/local/bin/hook.py"),
      "/usr/local/bin/hook.py"
    );
  });

  test("should handle quoted paths and spaces correctly", () => {
    assert.strictEqual(
      extractCommandPath('"C:\\Program Files\\nodejs\\node.exe" .claude/hooks/foo.mjs'),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath('node "C:/My Folder/hooks/foo.js"'),
      "C:/My Folder/hooks/foo.js"
    );
  });

  test("should fallback to first non-runner token or null appropriately", () => {
    assert.strictEqual(
      extractCommandPath(""),
      null
    );
    assert.strictEqual(
      extractCommandPath("node"),
      null
    );
  });
});
