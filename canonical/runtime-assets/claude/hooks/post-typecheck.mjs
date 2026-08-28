#!/usr/bin/env node

/**
 * PostToolUse hook: TypeScript type-check after editing .ts/.tsx files
 * Runs tsc --noEmit and outputs warnings (non-blocking)
 *
 * Input: JSON on stdin (Claude Code hooks).
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { readJsonFromStdin, extractFilePath } from "./utils.mjs";

const input = await readJsonFromStdin();
const toolName = input.tool_name || "";
const filePath = extractFilePath(input.tool_input || input);

if (!["Edit", "Write"].includes(toolName)) process.exit(0);
if (!filePath.match(/\.(ts|tsx)$/)) process.exit(0);

const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
const tscEntry = path.join(cwd, "node_modules", "typescript", "bin", "tsc");

if (!existsSync(tscEntry)) process.exit(0);

try {
  execFileSync(process.execPath, [tscEntry, "--noEmit", "--pretty"], {
    stdio: "pipe",
    timeout: 30000,
    cwd,
    windowsHide: true,
  });
} catch (err) {
  const output = err.stdout?.toString() || "";
  if (output.includes("error TS")) {
    process.stderr.write(
      `[tsc] Type errors detected after editing ${filePath}\n`,
    );
  }
}
