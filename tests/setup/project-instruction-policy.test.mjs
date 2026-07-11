import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

// The Meta_Kim source-repo maintainer guide (root AGENTS.md / CLAUDE.md) starts
// with these headers and carries source-only maintenance instructions. Ordinary
// projects must NEVER receive them under the default (preserve) or portable
// policies. These are the pollution signatures the fix removes.
const MAINTAINER_GUIDE_SIGNATURES = [
  "# Meta_Kim for Codex",
  "# Meta_Kim for Claude Code",
  "npm run meta:sync",
  "npm run meta:verify:all",
  "canonical source layer",
];

function tempProject(name = "meta-kim-instr-") {
  return mkdtempSync(path.join(os.tmpdir(), name));
}

function runSetup(args, options = {}) {
  return spawnSync(process.execPath, ["setup.mjs", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120_000,
    ...options,
  });
}

function bootstrap(projectDir, extraArgs = [], options = {}) {
  const result = runSetup(
    [
      "--project-bootstrap",
      "--targets",
      "claude,codex",
      "--project-dir",
      projectDir,
      "--json",
      ...extraArgs,
    ],
    options,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function read(projectDir, rel) {
  return readFileSync(path.join(projectDir, rel), "utf8");
}

function assertNoMaintainerGuide(text, label) {
  for (const sig of MAINTAINER_GUIDE_SIGNATURES) {
    assert.equal(
      text.includes(sig),
      false,
      `${label} must not contain maintainer-guide signature: ${sig}`,
    );
  }
}

function assertNoAbsolutePaths(text, projectDir, label) {
  // No Meta_Kim source-machine path, and no target-machine absolute path.
  assert.doesNotMatch(text, /knowledgeBase[\\/]Meta_Kim/i, `${label}: source path leak`);
  assert.doesNotMatch(text, /[A-Za-z]:[\\/]/, `${label}: drive-letter absolute path`);
  const forward = projectDir.replace(/\\/g, "/");
  assert.equal(text.includes(forward), false, `${label}: target path (fwd) leak`);
  assert.equal(text.includes(projectDir), false, `${label}: target path (raw) leak`);
}

// 1 + 2 + 9: default policy is preserve — existing user instruction files are
// kept verbatim, and ignored runtime projections are still generated.
test("default (preserve) keeps existing AGENTS.md/CLAUDE.md verbatim and still projects runtime assets", () => {
  const projectDir = tempProject();
  try {
    const agentsBody = "# User AGENTS\n\nProject-specific note A.\n";
    const claudeBody = "# User CLAUDE\n\nProject-specific note C.\n";
    writeFileSync(path.join(projectDir, "AGENTS.md"), agentsBody);
    writeFileSync(path.join(projectDir, "CLAUDE.md"), claudeBody);

    const summary = bootstrap(projectDir, ["--apply"]);
    assert.equal(summary.results[0].applied, true);

    assert.equal(read(projectDir, "AGENTS.md"), agentsBody);
    assert.equal(read(projectDir, "CLAUDE.md"), claudeBody);
    assertNoMaintainerGuide(read(projectDir, "AGENTS.md"), "AGENTS.md");
    assertNoMaintainerGuide(read(projectDir, "CLAUDE.md"), "CLAUDE.md");

    // Ignored runtime projections must still be generated.
    assert.equal(existsSync(path.join(projectDir, ".claude", "hooks")), true);
    assert.equal(existsSync(path.join(projectDir, ".codex", "hooks")), true);
    assert.equal(
      existsSync(path.join(projectDir, ".agents", "skills", "meta-theory")),
      true,
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// 2: fresh project with no instruction file — preserve must not create one.
test("default (preserve) does not create instruction files that did not exist", () => {
  const projectDir = tempProject();
  try {
    bootstrap(projectDir, ["--apply"]);
    assert.equal(existsSync(path.join(projectDir, "AGENTS.md")), false);
    assert.equal(existsSync(path.join(projectDir, "CLAUDE.md")), false);
    // But runtime projections exist.
    assert.equal(existsSync(path.join(projectDir, ".claude")), true);
    assert.equal(existsSync(path.join(projectDir, ".codex")), true);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// 8: legacy/wrong managed block migrates safely (block stripped, user text kept).
test("preserve migration strips a previously appended Meta_Kim managed block and restores user text byte-clean", () => {
  const projectDir = tempProject();
  try {
    const userText = "# My Project\n\nReal note one.\nReal note two.\n";
    const polluted =
      userText.replace(/\n$/, "") +
      "\n\n<!-- BEGIN META_KIM MANAGED BLOCK: AGENTS.md -->\n" +
      "# Meta_Kim for Codex\n\nsource-only maintainer text.\n" +
      "<!-- END META_KIM MANAGED BLOCK: AGENTS.md -->\n";
    writeFileSync(path.join(projectDir, "AGENTS.md"), polluted);

    const summary = bootstrap(projectDir, ["--targets", "codex", "--apply"]);
    assert.equal(summary.results[0].applied, true);

    const after = read(projectDir, "AGENTS.md");
    assert.equal(after, userText, "restored file must equal the pre-block user text byte-for-byte");
    assert.doesNotMatch(after, /MANAGED BLOCK/);
    assertNoMaintainerGuide(after, "migrated AGENTS.md");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// 7: strip preserves user text BOTH before and after the block.
test("preserve migration preserves user text before AND after a mid-file managed block", () => {
  const projectDir = tempProject();
  try {
    const before = "# Head\n\nBefore-block user text.";
    const after = "After-block user text.\n";
    writeFileSync(
      path.join(projectDir, "AGENTS.md"),
      `${before}\n\n<!-- BEGIN META_KIM MANAGED BLOCK: AGENTS.md -->\n# Old\n<!-- END META_KIM MANAGED BLOCK: AGENTS.md -->\n\n${after}`,
    );

    bootstrap(projectDir, ["--targets", "codex", "--apply"]);
    const result = read(projectDir, "AGENTS.md");
    assert.match(result, /Before-block user text\./);
    assert.match(result, /After-block user text\./);
    assert.doesNotMatch(result, /MANAGED BLOCK/);
    assert.doesNotMatch(result, /# Old/);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// 3 + 4 + 5: portable injects only the portable template — no maintainer guide,
// no absolute paths, no source-repo maintenance instructions.
test("portable policy injects only the portable managed block (no maintainer guide, no absolute paths)", () => {
  const projectDir = tempProject();
  try {
    const userTail = "# User\n\nkeep this tail.\n";
    writeFileSync(path.join(projectDir, "AGENTS.md"), userTail);

    bootstrap(projectDir, ["--targets", "codex", "--apply", "--project-instructions=portable"]);
    const agents = read(projectDir, "AGENTS.md");

    assert.match(agents, /BEGIN META_KIM MANAGED BLOCK: AGENTS\.md/);
    assert.match(agents, /Meta_Kim runtime \(portable notes\)/);
    assert.match(agents, /keep this tail\./);
    assertNoMaintainerGuide(agents, "portable AGENTS.md");
    assertNoAbsolutePaths(agents, projectDir, "portable AGENTS.md");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("portable policy on Claude injects the portable CLAUDE block without maintainer instructions or paths", () => {
  const projectDir = tempProject();
  try {
    bootstrap(projectDir, ["--targets", "claude", "--apply", "--project-instructions=portable"]);
    const claude = read(projectDir, "CLAUDE.md");
    assert.match(claude, /BEGIN META_KIM MANAGED BLOCK: CLAUDE\.md/);
    assert.match(claude, /Meta_Kim runtime \(portable notes\)/);
    assertNoMaintainerGuide(claude, "portable CLAUDE.md");
    assertNoAbsolutePaths(claude, projectDir, "portable CLAUDE.md");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// managed is the explicit opt-in that DOES inject the full maintainer guide.
test("managed policy is explicit opt-in and injects the full maintainer guide as a managed block", () => {
  const projectDir = tempProject();
  try {
    bootstrap(projectDir, ["--targets", "codex", "--apply", "--project-instructions=managed"]);
    const agents = read(projectDir, "AGENTS.md");
    assert.match(agents, /BEGIN META_KIM MANAGED BLOCK: AGENTS\.md/);
    assert.match(agents, /# Meta_Kim for Codex/);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// policy can be selected via env var, not just CLI flag.
test("policy is selectable via META_KIM_PROJECT_INSTRUCTIONS env var", () => {
  const projectDir = tempProject();
  try {
    writeFileSync(path.join(projectDir, "AGENTS.md"), "# U\n\ntail.\n");
    bootstrap(projectDir, ["--targets", "codex", "--apply"], {
      env: { ...process.env, META_KIM_PROJECT_INSTRUCTIONS: "portable" },
    });
    const agents = read(projectDir, "AGENTS.md");
    assert.match(agents, /Meta_Kim runtime \(portable notes\)/);
    assertNoMaintainerGuide(agents, "env portable AGENTS.md");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// unknown policy value must fail safe to preserve, never widen behavior.
test("unknown policy value fails safe to preserve", () => {
  const projectDir = tempProject();
  try {
    const body = "# U\n\nkeep verbatim.\n";
    writeFileSync(path.join(projectDir, "AGENTS.md"), body);
    bootstrap(projectDir, ["--targets", "codex", "--apply", "--project-instructions=bogus"]);
    assert.equal(read(projectDir, "AGENTS.md"), body);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// 11: dry-run must not write, and must accurately report the planned strip.
test("dry-run does not write and accurately previews the preserve strip", () => {
  const projectDir = tempProject();
  try {
    const polluted =
      "# Keep\n\nuser line.\n\n<!-- BEGIN META_KIM MANAGED BLOCK: AGENTS.md -->\nx\n<!-- END META_KIM MANAGED BLOCK: AGENTS.md -->\n";
    writeFileSync(path.join(projectDir, "AGENTS.md"), polluted);

    const summary = bootstrap(projectDir, ["--targets", "codex", "--dry-run"]);
    const plan = summary.results[0];
    const entry = plan.files.find((f) => f.relPath === "AGENTS.md");
    assert.ok(entry, "AGENTS.md must be present in the plan");
    assert.equal(entry.effectiveAction, "merge");
    assert.equal(entry.mergePolicy, "preserve_strip_managed_block");
    assert.ok(
      plan.writePreview.projectWrites.some(
        (w) => w.relPath === "AGENTS.md" && w.backupBeforeApply === true,
      ),
      "dry-run must preview the AGENTS.md write with backup",
    );
    // The file on disk must be untouched by the dry-run.
    assert.equal(read(projectDir, "AGENTS.md"), polluted);
    assert.equal(existsSync(path.join(projectDir, ".meta-kim")), false);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// 6: idempotency across repeated apply/sync.
test("repeated apply is idempotent (preserve strip then no pending instruction writes)", () => {
  const projectDir = tempProject();
  try {
    writeFileSync(
      path.join(projectDir, "AGENTS.md"),
      "# P\n\nkeep.\n\n<!-- BEGIN META_KIM MANAGED BLOCK: AGENTS.md -->\ny\n<!-- END META_KIM MANAGED BLOCK: AGENTS.md -->\n",
    );
    bootstrap(projectDir, ["--targets", "codex", "--apply"]);
    const firstPass = read(projectDir, "AGENTS.md");

    // Second apply — no further change.
    bootstrap(projectDir, ["--targets", "codex", "--apply"]);
    assert.equal(read(projectDir, "AGENTS.md"), firstPass);

    // Dry-run shows no pending instruction write.
    const summary = bootstrap(projectDir, ["--targets", "codex", "--dry-run"]);
    assert.equal(
      summary.results[0].writePreview.projectWrites.some((w) => w.relPath === "AGENTS.md"),
      false,
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("portable re-apply is idempotent (block replaced in place, not duplicated)", () => {
  const projectDir = tempProject();
  try {
    writeFileSync(path.join(projectDir, "AGENTS.md"), "# U\n\ntail.\n");
    bootstrap(projectDir, ["--targets", "codex", "--apply", "--project-instructions=portable"]);
    const once = read(projectDir, "AGENTS.md");
    bootstrap(projectDir, ["--targets", "codex", "--apply", "--project-instructions=portable"]);
    const twice = read(projectDir, "AGENTS.md");
    assert.equal(once, twice);
    assert.equal(
      (twice.match(/BEGIN META_KIM MANAGED BLOCK: AGENTS\.md/g) || []).length,
      1,
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// 10: Windows-style paths, forward/back slashes, and spaces in the target dir.
test("handles a target directory containing spaces (preserve strip + projection)", () => {
  const parent = tempProject();
  const projectDir = path.join(parent, "dir with spaces");
  mkdirSync(projectDir, { recursive: true });
  try {
    const userText = "# Spaced\n\nkeep me.\n";
    writeFileSync(
      path.join(projectDir, "AGENTS.md"),
      userText.replace(/\n$/, "") +
        "\n\n<!-- BEGIN META_KIM MANAGED BLOCK: AGENTS.md -->\nz\n<!-- END META_KIM MANAGED BLOCK: AGENTS.md -->\n",
    );
    bootstrap(projectDir, ["--targets", "codex", "--apply"]);
    assert.equal(read(projectDir, "AGENTS.md"), userText);
    assert.equal(existsSync(path.join(projectDir, ".codex", "hooks")), true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("accepts a project-dir passed with backslash separators (Windows form)", () => {
  const parent = tempProject();
  const projectDir = path.join(parent, "win", "proj");
  mkdirSync(projectDir, { recursive: true });
  const backslashDir = projectDir.replace(/\//g, "\\");
  try {
    writeFileSync(path.join(projectDir, "AGENTS.md"), "# W\n\nkeep.\n");
    const result = runSetup([
      "--project-bootstrap",
      "--targets",
      "codex",
      "--project-dir",
      backslashDir,
      "--json",
      "--apply",
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(read(projectDir, "AGENTS.md"), "# W\n\nkeep.\n");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
