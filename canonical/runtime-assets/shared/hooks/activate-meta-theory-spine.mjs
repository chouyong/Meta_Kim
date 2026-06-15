import process from "node:process";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonFromStdin } from "./utils.mjs";
import {
  readSpineState,
  writeSpineState,
  createInitialState,
} from "./spine-state.mjs";

const cwd = process.cwd();
const payload = await readJsonFromStdin();
const toolName = payload?.tool_name ?? "";
const toolInput = payload?.tool_input ?? {};

function getPromptText() {
  const candidates = [
    payload?.prompt,
    payload?.user_prompt,
    payload?.input,
    payload?.text,
    payload?.message,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.toLowerCase();
  }
  return "";
}

function getSkillName() {
  return (
    toolInput?.skill_name ||
    toolInput?.name ||
    toolInput?.skill ||
    ""
  ).toLowerCase();
}

function isMetaTheoryTrigger() {
  const skillName = getSkillName();
  if (toolName === "Skill" && skillName.includes("meta-theory")) return true;

  const promptText = getPromptText();
  return /\bmeta[-_ ]?theory\b|元理论/u.test(promptText);
}

function startPostCopyAutoInit() {
  if (process.env.META_KIM_POST_COPY_AUTO === "off") return;

  const scriptPath = join(cwd, "meta-kim-post-copy.mjs");
  if (!existsSync(scriptPath)) return;

  try {
    spawnSync(process.execPath, [scriptPath, "--auto"], {
      cwd,
      stdio: "ignore",
      timeout: 4000,
      windowsHide: true,
      env: {
        ...process.env,
        META_KIM_POST_COPY_AUTO: "1",
      },
    });
  } catch {
    // Post-copy auto-init is opportunistic. A failure here must not block
    // the meta-theory state machine from starting.
  }
}

function projectBootstrapProbeCommands() {
  const args = ["--project-bootstrap", "--dry-run", "--project-dir", cwd, "--json"];
  const commands = [];
  const envRoot = process.env.META_KIM_PACKAGE_ROOT;
  if (envRoot && existsSync(join(envRoot, "setup.mjs"))) {
    commands.push({
      command: process.execPath,
      args: [join(envRoot, "setup.mjs"), ...args],
      cwd: envRoot,
    });
  }

  if (existsSync(join(cwd, "setup.mjs"))) {
    commands.push({
      command: process.execPath,
      args: [join(cwd, "setup.mjs"), ...args],
      cwd,
    });
  }

  commands.push({
    command: "meta-kim",
    args: ["project", "bootstrap", "--dry-run", "--project-dir", cwd, "--json"],
    cwd,
    shell: process.platform === "win32",
  });
  return commands;
}

function startProjectBootstrapProbe() {
  if (process.env.META_KIM_PROJECT_BOOTSTRAP_PROBE === "off") return;

  for (const candidate of projectBootstrapProbeCommands()) {
    try {
      const result = spawnSync(candidate.command, candidate.args, {
        cwd: candidate.cwd,
        encoding: "utf8",
        windowsHide: true,
        timeout: 4000,
        shell: Boolean(candidate.shell),
        env: {
          ...process.env,
          META_KIM_PROJECT_BOOTSTRAP_PROBE: "1",
        },
      });
      if (result.status !== 0 || !result.stdout?.trim()) continue;

      const artifactPath = join(
        cwd,
        ".meta-kim",
        "state",
        "default",
        "project-bootstrap-probe.json",
      );
      mkdirSync(join(cwd, ".meta-kim", "state", "default"), { recursive: true });
      writeFileSync(artifactPath, result.stdout.trimEnd() + "\n", "utf8");
      return;
    } catch {
      // The probe is evidence gathering only. Missing global CLI or permission
      // errors must not prevent the meta-theory spine from starting.
    }
  }
}

const skillName = getSkillName();
if (!isMetaTheoryTrigger()) {
  process.exit(0);
}

startPostCopyAutoInit();
startProjectBootstrapProbe();

const existing = await readSpineState(cwd);
if (existing && existing.active) {
  process.exit(0);
}

const state = createInitialState({
  taskClassification: "meta_theory_auto",
  triggerReason:
    toolName === "Skill" && skillName.includes("meta-theory")
      ? "skill_activation_auto"
      : "prompt_activation_auto",
});

await writeSpineState(cwd, state);
process.exit(0);
