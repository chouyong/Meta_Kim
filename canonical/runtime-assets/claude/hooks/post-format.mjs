#!/usr/bin/env node

/**
 * PostToolUse hook: auto-format JS/TS files after Edit/Write
 * Runs prettier on the modified file if it's a .js/.ts/.jsx/.tsx file
 *
 * Input: JSON on stdin (Claude Code hooks). See https://code.claude.com/docs/en/hooks
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { readJsonFromStdin, extractFilePath } from "./utils.mjs";

const input = await readJsonFromStdin();
const toolName = input.tool_name || "";
const filePath = extractFilePath(input.tool_input || input);

if (!["Edit", "Write"].includes(toolName)) process.exit(0);
if (!filePath.match(/\.(js|ts|jsx|tsx|mjs|cjs)$/)) process.exit(0);

const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
const prettierEntry = [
  path.join(cwd, "node_modules", "prettier", "bin", "prettier.cjs"),
  path.join(cwd, "node_modules", "prettier", "bin-prettier.js"),
  path.join(cwd, "node_modules", "prettier", "bin", "prettier.js"),
].find((candidate) => existsSync(candidate));

if (!prettierEntry) process.exit(0);

try {
  execFile(
    process.execPath,
    [prettierEntry, "--write", filePath],
    {
      stdio: "ignore",
      timeout: 5000,
      cwd,
      windowsHide: true,
    },
    () => {},
  );
} catch {
  // prettier not available or failed — no big deal
}
