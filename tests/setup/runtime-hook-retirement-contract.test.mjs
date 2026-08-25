import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMetaKimHooksTemplate } from "../../scripts/claude-settings-merge.mjs";
import {
  buildCodexHooksJson,
  buildCursorHooksJson,
  isProjectMetaKimHookCommand,
} from "../../scripts/runtime-hook-mapping.mjs";

function collectCommands(value, commands = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectCommands(item, commands);
    return commands;
  }
  if (!value || typeof value !== "object") return commands;
  if (typeof value.command === "string") commands.push(value.command);
  for (const child of Object.values(value)) collectCommands(child, commands);
  return commands;
}

test("every projected project Hook command is recognized by retirement cleanup", () => {
  const projectedConfigs = [
    buildMetaKimHooksTemplate(".claude/hooks"),
    buildCodexHooksJson(),
    buildCursorHooksJson(),
  ];
  const commands = projectedConfigs.flatMap((config) => collectCommands(config));

  assert.ok(commands.length > 0);
  for (const command of commands) {
    assert.equal(
      isProjectMetaKimHookCommand(command),
      true,
      `project Hook cleanup does not recognize projected command: ${command}`,
    );
  }
});
