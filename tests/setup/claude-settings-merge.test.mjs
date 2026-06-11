import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMetaKimHooksTemplate,
  hookCommandNode,
  isRepoMetaKimHookCommand,
  mergeGlobalMetaKimHooksIntoSettings,
  mergeRepoClaudeSettings,
} from "../../scripts/claude-settings-merge.mjs";

describe("Claude settings hook command rendering", () => {
  test("normalizes Windows paths to slash form before writing shell commands", () => {
    const command = hookCommandNode(
      "C:\\Users\\Example\\.claude\\hooks\\meta-kim\\stop-compaction.mjs",
    );

    assert.equal(command, 'node "C:/Users/Example/.claude/hooks/meta-kim/stop-compaction.mjs"');
    assert.doesNotMatch(command, /\\/);
  });

  test("global hook template emits slash-normalized absolute paths", () => {
    const template = buildMetaKimHooksTemplate("C:\\Users\\Example\\.claude\\hooks\\meta-kim");
    const command = template.Stop[0].hooks[0].command;

    assert.equal(command, 'node "C:/Users/Example/.claude/hooks/meta-kim/stop-compaction.mjs"');
    const commands = Object.values(template)
      .flatMap((blocks) => blocks.flatMap((block) => block.hooks ?? []))
      .map((hook) => hook.command);
    assert.equal(
      commands.some((entry) => entry.includes("pre-git-push-confirm.mjs")),
      false,
    );
  });

  test("global settings merge strips retired git push confirmation hooks", () => {
    const base = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  'node "C:/Users/Example/.claude/hooks/pre-git-push-confirm.mjs"',
              },
              {
                type: "command",
                command: 'node "C:/Users/Example/.claude/hooks/custom.mjs"',
              },
            ],
          },
        ],
      },
    };
    const template = buildMetaKimHooksTemplate(
      "C:\\Users\\Example\\.claude\\hooks\\meta-kim",
    );

    const merged = mergeGlobalMetaKimHooksIntoSettings(base, template);
    const commands = Object.values(merged.hooks)
      .flatMap((blocks) => blocks.flatMap((block) => block.hooks ?? []))
      .map((hook) => hook.command);

    assert.equal(
      commands.some((entry) => entry.includes("pre-git-push-confirm.mjs")),
      false,
    );
    assert.ok(commands.includes('node "C:/Users/Example/.claude/hooks/custom.mjs"'));
  });

  test("repo settings merge keeps project hook commands relative", () => {
    const canonical = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "node .claude/hooks/block-dangerous-bash.mjs",
              },
            ],
          },
        ],
      },
    };

    const merged = mergeRepoClaudeSettings({}, canonical, "/Users/delphi/work/Finance");
    const command = merged.hooks.PreToolUse[0].hooks[0].command;

    assert.equal(
      command,
      "node .claude/hooks/block-dangerous-bash.mjs",
    );
    assert.doesNotMatch(command, /\/Users\/delphi\/work\/Finance/);
  });

  test("repo settings merge replaces legacy Meta_Kim hook entries with relative commands", () => {
    const base = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "node .claude/hooks/enforce-agent-dispatch.mjs",
              },
            ],
          },
        ],
        Stop: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command:
                  'node "D:/Old/Meta_Kim/.claude/hooks/stop-spine-cleanup.mjs"',
              },
            ],
          },
        ],
      },
    };
    const canonical = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "node .claude/hooks/enforce-agent-dispatch.mjs",
              },
            ],
          },
        ],
        Stop: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: "node .claude/hooks/stop-spine-cleanup.mjs",
              },
            ],
          },
        ],
      },
    };

    const merged = mergeRepoClaudeSettings(base, canonical, "/Users/delphi/work/Finance");
    const commands = Object.values(merged.hooks)
      .flatMap((blocks) => blocks.flatMap((block) => block.hooks ?? []))
      .map((hook) => hook.command);

    assert.deepEqual(commands, [
      "node .claude/hooks/enforce-agent-dispatch.mjs",
      "node .claude/hooks/stop-spine-cleanup.mjs",
    ]);
  });
});

describe("medusa hook recognition", () => {
  test("medusa-postscan-enqueue is identified as a repo Meta_Kim hook", () => {
    assert.equal(
      isRepoMetaKimHookCommand("node .claude/hooks/medusa-postscan-enqueue.mjs"),
      true,
    );
  });

  test("medusa-findings-surface is identified across event flags", () => {
    for (const event of ["session-start", "user-prompt", "stop"]) {
      assert.equal(
        isRepoMetaKimHookCommand(
          `node .claude/hooks/medusa-findings-surface.mjs --event ${event}`,
        ),
        true,
        `event ${event} should be recognized`,
      );
    }
  });

  test("medusa Python helper is NOT a repo Meta_Kim hook command", () => {
    // The helper is a sibling Python file invoked by the worker, not a hook
    // entry in settings.json. It must not get picked up by the repo hook
    // strip / merge logic.
    assert.equal(
      isRepoMetaKimHookCommand("python .claude/hooks/medusa_batch_scan.py"),
      false,
    );
  });

  test("repo settings merge keeps medusa hooks alongside other Meta_Kim hooks", () => {
    const base = { hooks: {} };
    const canonical = {
      hooks: {
        PostToolUse: [
          {
            matcher: "Edit|Write|MultiEdit|NotebookEdit",
            hooks: [
              { type: "command", command: "node .claude/hooks/medusa-postscan-enqueue.mjs" },
            ],
          },
        ],
        SessionStart: [
          {
            matcher: "startup|resume",
            hooks: [
              { type: "command", command: "node .claude/hooks/medusa-findings-surface.mjs --event session-start" },
            ],
          },
        ],
      },
    };
    const merged = mergeRepoClaudeSettings(base, canonical, "/repo");
    const allCommands = Object.values(merged.hooks)
      .flatMap((blocks) => blocks.flatMap((block) => block.hooks ?? []))
      .map((hook) => hook.command);
    assert.ok(
      allCommands.includes("node .claude/hooks/medusa-postscan-enqueue.mjs"),
      `expected enqueue hook in merged config, got: ${allCommands.join(", ")}`,
    );
    assert.ok(
      allCommands.some((c) => c.includes("medusa-findings-surface.mjs --event session-start")),
      "expected medusa-findings-surface session-start in merged config",
    );
  });
});
