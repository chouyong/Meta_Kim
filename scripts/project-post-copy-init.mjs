#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { detectPython310, formatPythonLauncher, runPythonModule } from "./graphify-runtime.mjs";

// P1 fix: resolve a legitimate project root before any graphify / post-copy
// bootstrap. Never treat an arbitrary cwd (e.g. a temp dir) as a project —
// that projects .meta-kim state / graphify-out into random directories.
// Walk up from cwd for a strong project marker (.git or the meta-kim
// project-bootstrap manifest); a bare process.cwd() is deliberately not
// trusted. The spine hook resolves the runtime project directory (from the
// runtime's declared project-dir env) and spawns this script with cwd set.
function resolveProjectRoot() {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 40; i++) {
    if (
      existsSync(join(dir, ".git")) ||
      existsSync(join(dir, ".meta-kim", "state", "default", "project-bootstrap.json"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const rootDir = resolveProjectRoot();
if (!rootDir) {
  // No legitimate project root — do not bootstrap graphify into an arbitrary
  // cwd. This path is opportunistic/auto; a silent no-op is the correct result.
  process.exit(0);
}
const scriptPath = fileURLToPath(import.meta.url);
const autoMode = process.argv.includes("--auto");
const autoWorkerMode = process.argv.includes("--auto-worker");
const stateDir = join(rootDir, ".meta-kim", "state", "default");
const autoMarkerPath = join(stateDir, "post-copy-init.json");
const runningTtlMs = 10 * 60 * 1000;
const failedRetryMs = 60 * 60 * 1000;
const guideTargets = {
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
  claw: "AGENTS.md",
  opencode: "AGENTS.md",
  aider: "AGENTS.md",
  droid: "AGENTS.md",
  trae: "AGENTS.md",
  "trae-cn": "AGENTS.md",
};
const graphifyPlatformMap = {
  claude: "claude",
  codex: "codex",
  cursor: "codex",
  openclaw: "claw",
};

function scriptMtimeMs() {
  try {
    return statSync(scriptPath).mtimeMs;
  } catch {
    return null;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function activeTargets() {
  const manifest = readJson(join(stateDir, "project-bootstrap.json"));
  const targets = Array.isArray(manifest?.activeTargets) ? manifest.activeTargets : [];
  return targets.length > 0 ? targets : ["claude", "codex"];
}

function graphifyPlatforms() {
  return [
    ...new Set(
      activeTargets()
        .map((target) => graphifyPlatformMap[target])
        .filter(Boolean),
    ),
  ];
}

function readAutoMarker() {
  return readJson(autoMarkerPath);
}

function writeAutoMarker(status, extra = {}) {
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      autoMarkerPath,
      JSON.stringify(
        {
          status,
          updatedAt: new Date().toISOString(),
          scriptMtimeMs: scriptMtimeMs(),
          ...extra,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  } catch {
    // Auto-init state is best-effort; never block meta-theory startup.
  }
}

function markerAgeMs(marker) {
  const raw = marker?.updatedAt || marker?.startedAt;
  const time = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(time) ? Date.now() - time : Number.POSITIVE_INFINITY;
}

function shouldSkipAutoLaunch() {
  const marker = readAutoMarker();
  const currentScriptMtimeMs = scriptMtimeMs();
  if (marker?.status === "passed" && marker.scriptMtimeMs === currentScriptMtimeMs) {
    return true;
  }
  if (marker?.status === "running" && markerAgeMs(marker) < runningTtlMs) {
    return true;
  }
  if (marker?.status === "failed" && markerAgeMs(marker) < failedRetryMs) {
    return true;
  }
  return false;
}

function launchAutoWorker() {
  if (process.env.META_KIM_POST_COPY_AUTO === "off") return;
  if (shouldSkipAutoLaunch()) return;
  writeAutoMarker("running", { mode: "auto", startedAt: new Date().toISOString() });
  try {
    const child = spawn(process.execPath, [scriptPath, "--auto-worker"], {
      cwd: rootDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, META_KIM_POST_COPY_AUTO: "worker" },
    });
    child.unref();
  } catch (error) {
    writeAutoMarker("failed", { mode: "auto", message: error?.message || String(error) });
  }
}

if (autoMode && !autoWorkerMode) {
  launchAutoWorker();
  process.exit(0);
}

function fail(message, code = 1) {
  if (autoWorkerMode) writeAutoMarker("failed", { mode: "auto", message });
  console.error(message);
  process.exit(code);
}

function findPython() {
  return detectPython310(spawnSync, process.platform, {
    requirePip: true,
    bootstrapPip: true,
  });
}

function runCandidate(python, args, stdio = "inherit") {
  return runPythonModule(python, args, spawnSync, {
    cwd: rootDir,
    stdio,
  });
}

function runPython(python, args, { optional = false } = {}) {
  const result = runCandidate(python, args);
  if (result.status === 0) return true;
  if (optional) {
    console.warn("[Meta_Kim] Optional command failed:", args.join(" "));
    return false;
  }
  fail("[Meta_Kim] Command failed: " + args.join(" "), result.status || 1);
}

function guideAlreadyHasGraphifySection(platform) {
  const target = guideTargets[platform];
  if (!target) return false;
  const filePath = join(rootDir, target);
  if (!existsSync(filePath)) return false;
  return /^##\s+graphify\b/im.test(readFileSync(filePath, "utf8"));
}

const python = findPython();
if (!python) {
  fail("[Meta_Kim] Python 3.10+ with pip is required for graphify. Install Python, then run this script again.");
}
console.log(`[Meta_Kim] Using Python for graphify: ${formatPythonLauncher(python)}`);

const pipShow = runCandidate(python, ["-m", "pip", "show", "graphifyy"], "pipe");
if (pipShow.status !== 0) {
  runPython(python, ["-m", "pip", "install", "graphifyy"]);
}
runPython(python, ["-m", "pip", "install", "--upgrade", "networkx>=3.4"], {
  optional: true,
});

if (existsSync(join(rootDir, ".git"))) {
  runPython(python, ["-m", "graphify", "hook", "install"]);
} else {
  console.log("[Meta_Kim] Skipping graphify git hook; no .git directory found.");
}

for (const platform of graphifyPlatforms()) {
  if (guideAlreadyHasGraphifySection(platform)) {
    console.log(`[Meta_Kim] graphify ${platform} guide section already exists; skipping install.`);
    continue;
  }
  runPython(python, ["-m", "graphify", platform, "install"], { optional: true });
}

runPython(python, ["-m", "graphify", "update", "."]);
writeAutoMarker("passed", {
  mode: autoWorkerMode ? "auto" : "manual",
  graphPath: join(rootDir, "graphify-out", "graph.json"),
});
console.log("[Meta_Kim] graphify is initialized for:", rootDir);
