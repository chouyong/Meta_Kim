import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
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

  test("should handle recursive shell command payloads", () => {
    assert.strictEqual(
      extractCommandPath('sh -c "node .claude/hooks/foo.mjs"'),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath('bash -c "./hook.sh"'),
      "./hook.sh"
    );
    assert.strictEqual(
      extractCommandPath('pwsh -Command .claude/hooks/foo.ps1'),
      ".claude/hooks/foo.ps1"
    );
    assert.strictEqual(
      extractCommandPath('bash -lc "node .claude/hooks/foo.mjs"'),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath('bash -lc "cd C:/repo && node .claude/hooks/foo.mjs"'),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath('sh -c "cd C:/repo && node .claude/hooks/foo.mjs"'),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath('sh -c "cd C:/repo; node .claude/hooks/foo.mjs"'),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath("C:/repo"),
      null
    );
  });

  test("should handle node loader, import and experimental options", () => {
    assert.strictEqual(
      extractCommandPath('node --experimental-loader ts-node/esm .claude/hooks/foo.ts'),
      ".claude/hooks/foo.ts"
    );
    assert.strictEqual(
      extractCommandPath('node --import ./.claude/hooks/setup.mjs .claude/hooks/foo.mjs'),
      ".claude/hooks/foo.mjs"
    );
  });

  test("should return null for unrecognized/non-script commands (regression/false-positives check)", () => {
    assert.strictEqual(
      extractCommandPath("echo hello"),
      null
    );
    assert.strictEqual(
      extractCommandPath("cmd /c .claude/hooks/foo.mjs"),
      ".claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath("cmd.exe /c C:/repo/.claude/hooks/foo.mjs"),
      "C:/repo/.claude/hooks/foo.mjs"
    );
    assert.strictEqual(
      extractCommandPath("npx tsx .claude/hooks/foo.ts"),
      ".claude/hooks/foo.ts"
    );
    assert.strictEqual(
      extractCommandPath("node -r ts-node/register .claude/hooks/foo.ts"),
      ".claude/hooks/foo.ts"
    );
    assert.strictEqual(
      extractCommandPath("python -m pip install"),
      null
    );
    assert.strictEqual(
      extractCommandPath("python -m my_module.hook"),
      null
    );
  });

  test("should fallback to null appropriately", () => {
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

describe("doctor-hooks --project-root gate is fail-closed", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const doctorScript = path.resolve(__dirname, "..", "..", "scripts", "doctor-hooks.mjs");

  function withTempProject(fn) {
    const dir = mkdtempSync(path.join(os.tmpdir(), "meta-kim-doctor-gate-"));
    try {
      return fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Run the gate through a real CLI spawn (not the exported function) so the
  // process exit code — the actual fail-closed contract — is what gets asserted.
  function runGate(dir, extraArgs = []) {
    const args = [doctorScript];
    if (dir !== null) args.push("--project-root", dir);
    args.push("--silent", ...extraArgs);
    return spawnSync(process.execPath, args, { encoding: "utf8" });
  }

  function writeSettings(dir, obj, { bom = false } = {}) {
    const settingsPath = path.join(dir, ".claude", "settings.json");
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    const body = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    writeFileSync(settingsPath, (bom ? "﻿" : "") + body, "utf8");
    return settingsPath;
  }

  const stopHook = (command) => ({
    hooks: { Stop: [{ matcher: "*", hooks: [{ type: "command", command }] }] },
  });

  test("missing settings.json fails closed (non-zero)", () => {
    withTempProject((dir) => {
      const r = runGate(dir);
      assert.notEqual(r.status, 0, "missing settings under the gate must be non-zero");
    });
  });

  test("invalid JSON fails closed (non-zero)", () => {
    withTempProject((dir) => {
      writeSettings(dir, "{ not valid json ");
      assert.notEqual(runGate(dir).status, 0);
    });
  });

  test("UTF-8 BOM settings fails closed (non-zero, exit code not clobbered)", () => {
    withTempProject((dir) => {
      writeSettings(dir, stopHook("node .claude/hooks/x.mjs"), { bom: true });
      assert.notEqual(
        runGate(dir).status,
        0,
        "a BOM makes JSON.parse throw; parse-failed must not be overwritten by exit(0)",
      );
    });
  });

  test("--project-root with a missing value fails instead of swallowing --silent", () => {
    const r = spawnSync(process.execPath, [doctorScript, "--project-root", "--silent"], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0, "'--project-root --silent' must not treat --silent as the root");
  });

  test("dangling hook reference fails closed (non-zero)", () => {
    withTempProject((dir) => {
      writeSettings(dir, stopHook("node .claude/hooks/missing.mjs"));
      assert.notEqual(runGate(dir).status, 0);
    });
  });

  test("all-live references pass (zero)", () => {
    withTempProject((dir) => {
      const hooksDir = path.join(dir, ".claude", "hooks");
      mkdirSync(hooksDir, { recursive: true });
      writeFileSync(path.join(hooksDir, "live.mjs"), "export {};\n", "utf8");
      writeSettings(dir, stopHook("node .claude/hooks/live.mjs"));
      assert.equal(runGate(dir).status, 0, runGate(dir).stderr);
    });
  });

  test("--fix removes only the dangling hook and keeps the live one", () => {
    withTempProject((dir) => {
      const hooksDir = path.join(dir, ".claude", "hooks");
      mkdirSync(hooksDir, { recursive: true });
      writeFileSync(path.join(hooksDir, "live.mjs"), "export {};\n", "utf8");
      const settingsPath = writeSettings(dir, {
        hooks: {
          Stop: [
            {
              matcher: "*",
              hooks: [
                { type: "command", command: "node .claude/hooks/live.mjs" },
                { type: "command", command: "node .claude/hooks/missing.mjs" },
              ],
            },
          ],
        },
      });
      runGate(dir, ["--fix"]);
      const fixed = JSON.parse(readFileSync(settingsPath, "utf8"));
      const commands = (fixed.hooks?.Stop ?? []).flatMap((b) =>
        (b.hooks ?? []).map((h) => h.command),
      );
      assert.ok(commands.some((c) => c.includes("live.mjs")), "live hook must be kept");
      assert.ok(
        !commands.some((c) => c.includes("missing.mjs")),
        "dangling hook must be removed",
      );
    });
  });
});

describe("doctor-hooks gate R2 hardening (directory / empty-root / unverifiable / case)", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const doctorScript = path.resolve(__dirname, "..", "..", "scripts", "doctor-hooks.mjs");

  const tmp = () => mkdtempSync(path.join(os.tmpdir(), "meta-kim-doctor-r2-"));
  const run = (args) => spawnSync(process.execPath, [doctorScript, ...args], { encoding: "utf8" });
  const gate = (dir, extra = []) => run(["--project-root", dir, "--silent", ...extra]);
  const writeClaudeSettings = (dir, obj) => {
    const p = path.join(dir, ".claude", "settings.json");
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
    return p;
  };
  const stop = (command) => ({
    hooks: { Stop: [{ matcher: "*", hooks: [{ type: "command", command }] }] },
  });

  test("empty-string --project-root fails, no user-settings fallback (Codex R2 B1)", () => {
    assert.notEqual(run(["--project-root", "", "--silent"]).status, 0);
  });

  test("whitespace-only --project-root fails (B1)", () => {
    assert.notEqual(run(["--project-root", "   ", "--silent"]).status, 0);
  });

  test("non-existent --project-root directory fails", () => {
    const dir = tmp();
    try {
      assert.notEqual(gate(path.join(dir, "nope")).status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a directory masquerading as a hook file is dangling, not live (Codex R2 B2)", () => {
    const dir = tmp();
    try {
      mkdirSync(path.join(dir, ".claude", "hooks", "dir-hook.mjs"), { recursive: true });
      writeClaudeSettings(dir, stop("node .claude/hooks/dir-hook.mjs"));
      assert.notEqual(gate(dir).status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a directory masquerading as a transitive helper fails closed (B2)", () => {
    const dir = tmp();
    try {
      const hooks = path.join(dir, ".claude", "hooks");
      mkdirSync(hooks, { recursive: true });
      writeFileSync(path.join(hooks, "medusa-worker.mjs"), "export {};\n", "utf8");
      mkdirSync(path.join(hooks, "medusa_batch_scan.py"), { recursive: true }); // dir, not file
      writeClaudeSettings(dir, stop("node .claude/hooks/medusa-worker.mjs"));
      assert.notEqual(gate(dir).status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("unverifiable hook command fails closed in gate mode", () => {
    const dir = tmp();
    try {
      writeClaudeSettings(dir, stop("echo hello"));
      assert.notEqual(gate(dir).status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("Codex-only project (no .claude/settings.json) fails closed — gate is Claude-scoped", () => {
    const dir = tmp();
    try {
      mkdirSync(path.join(dir, ".codex"), { recursive: true });
      writeFileSync(path.join(dir, ".codex", "hooks.json"), "{}\n", "utf8");
      assert.notEqual(gate(dir).status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test(
    "Windows case-variant transitive reference still hits the dep table (Codex R2 B3)",
    { skip: process.platform !== "win32" ? "windows-only" : false },
    () => {
      const dir = tmp();
      try {
        const hooks = path.join(dir, ".claude", "hooks");
        mkdirSync(hooks, { recursive: true });
        writeFileSync(path.join(hooks, "medusa-worker.mjs"), "export {};\n", "utf8");
        // medusa_batch_scan.py intentionally absent
        writeClaudeSettings(dir, stop("node .claude/hooks/MEDUSA-WORKER.MJS"));
        assert.notEqual(gate(dir).status, 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
