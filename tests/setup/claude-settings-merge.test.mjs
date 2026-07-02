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
    const command = template.PreToolUse[0].hooks[0].command;

    assert.equal(command, 'node "C:/Users/Example/.claude/hooks/meta-kim/block-dangerous-bash.mjs"');
    const commands = Object.values(template)
      .flatMap((blocks) => blocks.flatMap((block) => block.hooks ?? []))
      .map((hook) => hook.command);
    assert.equal(
      commands.some((entry) => entry.includes("pre-git-push-confirm.mjs")),
      false,
    );
    assert.equal(
      commands.some((entry) => entry.includes("stop-save-progress.mjs")),
      true,
    );
    assert.equal(
      commands.some((entry) => entry.includes("stop-memory-save.mjs")),
      true,
    );
    assert.equal(
      commands.some((entry) => entry.includes("stop-compaction.mjs")),
      true,
    );
  });

  test("Claude global hook template keeps native HookPrompt before Meta_Kim spine", () => {
    const template = buildMetaKimHooksTemplate(
      "C:\\Users\\Example\\.claude\\hooks\\meta-kim",
      "D:\\KimProject\\Meta_Kim",
      {
        hookPromptCommand:
          'node "C:/Users/Example/.claude/hooks/user-prompt-submit.js"',
      },
    );
    const promptHooks = template.UserPromptSubmit[0].hooks;

    assert.match(promptHooks[0].command, /user-prompt-submit\.js/);
    assert.match(promptHooks[1].command, /activate-meta-theory-spine\.mjs/);
    assert.doesNotMatch(
      JSON.stringify(promptHooks),
      /hookprompt-adapter\.mjs/,
    );
  });

  test("global settings merge keeps native HookPrompt block before existing prompt hooks", () => {
    const base = {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: ".*",
            hooks: [
              {
                type: "command",
                command: 'node "C:/Users/Example/.claude/hooks/optional.js"',
              },
            ],
          },
        ],
      },
    };
    const template = buildMetaKimHooksTemplate(
      "C:\\Users\\Example\\.claude\\hooks\\meta-kim",
      "D:\\KimProject\\Meta_Kim",
      {
        hookPromptCommand:
          'node "C:/Users/Example/.claude/hooks/user-prompt-submit.js"',
      },
    );

    const merged = mergeGlobalMetaKimHooksIntoSettings(base, template);
    const promptHooks = merged.hooks.UserPromptSubmit.flatMap(
      (block) => block.hooks ?? [],
    );

    assert.match(promptHooks[0].command, /user-prompt-submit\.js/);
    assert.match(promptHooks[1].command, /activate-meta-theory-spine\.mjs/);
    assert.match(promptHooks[2].command, /optional\.js/);
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

  test("global settings merge removes old managed events no longer in the template", () => {
    const template = buildMetaKimHooksTemplate(
      "C:\\Users\\Example\\.claude\\hooks\\meta-kim",
    );
    const merged = mergeGlobalMetaKimHooksIntoSettings(
      {
        hooks: {
          PreCompact: [
            {
              hooks: [
                {
                  type: "command",
                  command:
                    'node "C:/Users/Example/.claude/hooks/meta-kim/post-format.mjs"',
                },
              ],
            },
          ],
        },
      },
      template,
    );

    assert.equal(merged.hooks.PreCompact, undefined);
    assert.match(
      JSON.stringify(merged.hooks),
      /block-dangerous-bash\.mjs/,
    );
  });

  test("global settings merge replaces legacy root Meta_Kim hook commands", () => {
    const base = {
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command:
                  'node ".claude/hooks/activate-meta-theory-spine.mjs"',
              },
            ],
          },
        ],
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  'node "C:/Users/Example/.claude/hooks/block-dangerous-bash.mjs"',
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
      commands.some((entry) => entry.includes(".claude/hooks/activate-meta-theory-spine.mjs")),
      false,
    );
    assert.equal(
      commands.some((entry) => entry.includes(".claude/hooks/block-dangerous-bash.mjs")),
      false,
    );
    assert.ok(
      commands.includes(
        'node "C:/Users/Example/.claude/hooks/meta-kim/activate-meta-theory-spine.mjs"',
      ),
    );
    assert.ok(
      commands.includes(
        'node "C:/Users/Example/.claude/hooks/meta-kim/block-dangerous-bash.mjs"',
      ),
    );
  });

  test("repo settings merge adds canonical project hook commands", () => {
    const canonical = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "node .claude/hooks/graphify-context.mjs",
              },
            ],
          },
        ],
      },
    };

    const merged = mergeRepoClaudeSettings({}, canonical, "/Users/delphi/work/Finance");

    assert.deepEqual(merged.hooks, canonical.hooks);
  });

  test("repo settings merge replaces legacy Meta_Kim hook entries with canonical project hooks", () => {
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
    assert.equal(
      commands.some((command) => command.includes("D:/Old/Meta_Kim")),
      false,
    );
  });

  test("repo settings merge keeps user hooks while refreshing managed project hooks", () => {
    const merged = mergeRepoClaudeSettings(
      {
        hooks: {
          SessionStart: [
            {
              matcher: "startup|resume",
              hooks: [
                {
                  type: "command",
                  command: "node .claude/hooks/meta-kim-memory-save.mjs --event session-start",
                },
                {
                  type: "command",
                  command: "node .claude/hooks/user-session-start.mjs",
                },
              ],
            },
          ],
        },
      },
      {
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: "node .claude/hooks/graphify-context.mjs",
                },
              ],
            },
          ],
        },
      },
      "/Users/delphi/work/Finance",
    );

    assert.match(JSON.stringify(merged.hooks), /user-session-start\.mjs/);
    assert.doesNotMatch(JSON.stringify(merged.hooks), /meta-kim-memory-save\.mjs/);
    assert.match(JSON.stringify(merged.hooks), /graphify-context\.mjs/);
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

describe("global hook template includes medusa entries", () => {
  test("SessionStart binds medusa-findings-surface --event session-start", () => {
    const template = buildMetaKimHooksTemplate("/abs/hooks/meta-kim");
    assert.ok(Array.isArray(template.SessionStart), "SessionStart must be present");
    const cmds = template.SessionStart[0].hooks.map((h) => h.command);
    assert.ok(
      cmds.some((c) => /medusa-findings-surface\.mjs.*session-start/.test(c)),
      `expected medusa surface session-start, got: ${cmds.join(", ")}`,
    );
  });

  test("UserPromptSubmit binds medusa-findings-surface --event user-prompt", () => {
    const template = buildMetaKimHooksTemplate("/abs/hooks/meta-kim");
    assert.ok(Array.isArray(template.UserPromptSubmit), "UserPromptSubmit must be present");
    const cmds = template.UserPromptSubmit[0].hooks.map((h) => h.command);
    assert.ok(
      cmds.some((c) => /medusa-findings-surface\.mjs.*user-prompt/.test(c)),
      `expected medusa surface user-prompt, got: ${cmds.join(", ")}`,
    );
  });

  test("PostToolUse has a dedicated medusa enqueue block with full matcher", () => {
    const template = buildMetaKimHooksTemplate("/abs/hooks/meta-kim");
    const block = template.PostToolUse.find((b) =>
      b.hooks?.some((h) => /medusa-postscan-enqueue\.mjs/.test(h.command || "")),
    );
    assert.ok(block, "expected a PostToolUse block registering medusa enqueue");
    assert.match(
      block.matcher || "",
      /Edit\|Write\|MultiEdit\|NotebookEdit/,
      "medusa enqueue must cover all four file-mutation tools",
    );
  });

  test("Stop appends medusa-findings-surface --event stop", () => {
    const template = buildMetaKimHooksTemplate("/abs/hooks/meta-kim");
    const cmds = template.Stop[0].hooks.map((h) => h.command);
    assert.ok(
      cmds.some((c) => /medusa-findings-surface\.mjs.*stop/.test(c)),
      `expected medusa surface stop, got: ${cmds.join(", ")}`,
    );
  });

  test("global template stays fail-open: no failClosed on any medusa entry", () => {
    const template = buildMetaKimHooksTemplate("/abs/hooks/meta-kim");
    const allHooks = [];
    for (const blocks of Object.values(template)) {
      for (const block of blocks) {
        for (const h of block.hooks || []) allHooks.push(h);
      }
    }
    const medusa = allHooks.filter((h) => /medusa-/.test(h.command || ""));
    assert.ok(medusa.length >= 4, `expected at least 4 medusa hook entries, got ${medusa.length}`);
    for (const h of medusa) {
      assert.notEqual(h.failClosed, true, `medusa hook must not be failClosed: ${h.command}`);
    }
  });
});
