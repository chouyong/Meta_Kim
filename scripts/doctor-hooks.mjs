#!/usr/bin/env node
/**
 * Meta_Kim hook doctor — scan settings.json files for hook commands whose
 * target files no longer exist (zombies from machine-to-machine copies,
 * renamed hooks, uninstalled tools, etc.).
 *
 * Usage:
 *   node scripts/doctor-hooks.mjs              # scan ~/.claude/settings.json (dry-run)
 *   node scripts/doctor-hooks.mjs --fix        # remove zombies + write back (auto backup)
 *   node scripts/doctor-hooks.mjs --all        # also scan <repo>/.claude/settings.json
 *   node scripts/doctor-hooks.mjs --project    # scan ONLY <repo>/.claude/settings.json
 *   node scripts/doctor-hooks.mjs --project-root <dir>
 *                                              # scan ONLY <dir>/.claude/settings.json, resolving
 *                                              # relative hook paths against <dir>. Pair with
 *                                              # --silent as a fail-closed Claude-project gate any
 *                                              # CLAUDE-projected consumer repo can run. Scope is
 *                                              # Claude <dir>/.claude/settings.json ONLY; codex/
 *                                              # cursor/openclaw hook configs are out of scope. It
 *                                              # fails closed on dangling, directory-as-file, and
 *                                              # unverifiable commands, and also checks Medusa-
 *                                              # specific transitive hook deps (siblings a referenced
 *                                              # hook spawns, e.g. medusa-worker.mjs ->
 *                                              # medusa_batch_scan.py), failing on any missing one.
 *   node scripts/doctor-hooks.mjs --lang zh    # force language (en/zh/ja/ko); default: auto
 *   node scripts/doctor-hooks.mjs --silent     # CI mode, exit code = zombie count (capped at 1)
 */

import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const MESSAGES = {
  en: {
    title: "Meta_Kim hook doctor",
    scanning: (p) => `Scanning ${p}`,
    notFound: (p) => `settings.json not found at ${p} — nothing to scan`,
    parseFailed: (p, e) => `Failed to parse ${p}: ${e}`,
    noHooks: (p) => `No hooks registered in ${p}`,
    zombieHeader: (n) => `Found ${n} zombie hook(s) — files do not exist:`,
    liveHeader: (n) => `Healthy hook(s) (${n}):`,
    zombieItem: (e, m, p) => `  [${e} / ${m}]  ${p}`,
    summaryClean: "All hooks point to existing files.",
    dryRunHint:
      "Dry-run only. Re-run with --fix to back up & remove the zombie entries.",
    backupWritten: (p) => `Backup written: ${p}`,
    removedCount: (n) =>
      `Removed ${n} zombie hook entr${n === 1 ? "y" : "ies"}.`,
    settingsSaved: (p) => `Saved: ${p}`,
    finalStructure: "Resulting hook events:",
    langAutoDetected: (l) => `Language: ${l} (auto)`,
  },
  "zh-CN": {
    title: "Meta_Kim hook 体检",
    scanning: (p) => `正在扫描：${p}`,
    notFound: (p) => `${p} 不存在，跳过`,
    parseFailed: (p, e) => `解析 ${p} 失败：${e}`,
    noHooks: (p) => `${p} 里没有注册任何 hook`,
    zombieHeader: (n) => `发现 ${n} 个僵尸 hook（目标文件不存在）：`,
    liveHeader: (n) => `健康的 hook（${n}）：`,
    zombieItem: (e, m, p) => `  [${e} / ${m}]  ${p}`,
    summaryClean: "所有 hook 的目标文件都存在，无需清理。",
    dryRunHint: "当前仅为扫描模式。加 --fix 参数可自动备份并清除僵尸条目。",
    backupWritten: (p) => `已备份：${p}`,
    removedCount: (n) => `已移除 ${n} 个僵尸 hook 条目。`,
    settingsSaved: (p) => `已保存：${p}`,
    finalStructure: "剩余 hook 事件：",
    langAutoDetected: (l) => `语言：${l}（自动）`,
  },
  "ja-JP": {
    title: "Meta_Kim hook ドクター",
    scanning: (p) => `スキャン中：${p}`,
    notFound: (p) => `${p} が見つかりません — スキップ`,
    parseFailed: (p, e) => `${p} の解析に失敗：${e}`,
    noHooks: (p) => `${p} に hook が登録されていません`,
    zombieHeader: (n) =>
      `${n} 個のゾンビ hook を検出（ファイルが存在しません）：`,
    liveHeader: (n) => `正常な hook（${n}）：`,
    zombieItem: (e, m, p) => `  [${e} / ${m}]  ${p}`,
    summaryClean: "すべての hook ターゲットが存在します。",
    dryRunHint:
      "ドライラン。--fix を付けるとバックアップしてからゾンビを削除します。",
    backupWritten: (p) => `バックアップ作成：${p}`,
    removedCount: (n) => `ゾンビ hook を ${n} 件削除しました。`,
    settingsSaved: (p) => `保存：${p}`,
    finalStructure: "残存する hook イベント：",
    langAutoDetected: (l) => `言語：${l}（自動）`,
  },
  "ko-KR": {
    title: "Meta_Kim hook 닥터",
    scanning: (p) => `스캔 중: ${p}`,
    notFound: (p) => `${p} 를 찾을 수 없음 — 건너뜀`,
    parseFailed: (p, e) => `${p} 파싱 실패: ${e}`,
    noHooks: (p) => `${p} 에 등록된 hook 이 없음`,
    zombieHeader: (n) => `좀비 hook ${n} 개 발견 (파일 없음):`,
    liveHeader: (n) => `정상 hook (${n}):`,
    zombieItem: (e, m, p) => `  [${e} / ${m}]  ${p}`,
    summaryClean: "모든 hook 대상 파일이 존재합니다.",
    dryRunHint: "드라이런 모드. --fix 옵션으로 백업 후 좀비 항목을 제거합니다.",
    backupWritten: (p) => `백업 완료: ${p}`,
    removedCount: (n) => `좀비 hook ${n} 건 제거 완료.`,
    settingsSaved: (p) => `저장됨: ${p}`,
    finalStructure: "남은 hook 이벤트:",
    langAutoDetected: (l) => `언어: ${l} (자동)`,
  },
};

function resolveLang(cliLang) {
  const normalize = (value) => {
    if (!value) return null;
    const v = String(value).toLowerCase();
    if (v === "zh" || v.startsWith("zh")) return "zh-CN";
    if (v === "ja" || v.startsWith("ja")) return "ja-JP";
    if (v === "ko" || v.startsWith("ko")) return "ko-KR";
    if (v === "en" || v.startsWith("en")) return "en";
    return null;
  };
  return (
    normalize(cliLang) ||
    normalize(process.env.METAKIM_LANG) ||
    normalize(process.env.LC_ALL) ||
    normalize(process.env.LC_MESSAGES) ||
    normalize(process.env.LANG) ||
    "en"
  );
}

export function parseCommandTokens(command) {
  const tokens = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if ((char === '"' || char === "'") && (i === 0 || command[i - 1] !== '\\')) {
      if (inQuotes && char === quoteChar) {
        inQuotes = false;
      } else if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else {
        current += char;
      }
    } else if (char === " " && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function customBasename(p) {
  const lastSlash = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  if (lastSlash === -1) return p;
  return p.slice(lastSlash + 1);
}

function trimShellPunctuation(token) {
  return token.replace(/^[;&|]+|[;&|]+$/g, "");
}

export function extractCommandPath(command) {
  if (typeof command !== "string") return null;
  const tokens = parseCommandTokens(command.trim());
  if (tokens.length === 0) return null;

  const runners = [
    "node",
    "python",
    "python3",
    "bash",
    "sh",
    "pwsh",
    "powershell",
    "cmd",
    "npx",
    "tsx",
    "ts-node",
    "bun",
    "deno",
  ];

  // Helper to check if token is a runner
  const runnerName = (token) => {
    const base = customBasename(token).toLowerCase();
    const withoutExe = base.endsWith(".exe") ? base.slice(0, -4) : base;
    return runners.includes(withoutExe) ? withoutExe : null;
  };

  // Helper to check if token is script-like/path-like
  const isScriptLike = (t) => {
    if (!t) return false;
    const token = trimShellPunctuation(t);
    const lower = token.toLowerCase();
    const scriptExtension = /\.(mjs|js|cjs|py|sh|ts|tsx|bat|cmd|ps1)$/i;
    return (
      scriptExtension.test(lower) ||
      (/^(?:\.{1,2}|~)[\\/]/.test(token) && scriptExtension.test(lower))
    );
  };

  const isShellRunner = (runner) =>
    ["bash", "sh", "pwsh", "powershell", "cmd"].includes(runner);

  const isShellPayloadFlag = (token, runner) => {
    const lower = token.toLowerCase();
    if (!isShellRunner(runner)) return false;
    if (runner === "bash" || runner === "sh") return /^-[a-z]*c[a-z]*$/.test(lower);
    if (runner === "cmd") return lower === "/c" || lower === "/k";
    return lower === "-command" || lower === "--command" || lower === "-c";
  };

  const isShellSeparator = (token) =>
    ["&&", "||", ";", "|", "&"].includes(token);

  let activeRunner = null;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const normalized = trimShellPunctuation(token);
    const lower = normalized.toLowerCase();

    // 1. Skip known runners
    const currentRunner = runnerName(normalized);
    if (currentRunner) {
      activeRunner = currentRunner;
      continue;
    }

    // 2. Shell command payload: recursively parse that payload
    if (isShellPayloadFlag(normalized, activeRunner)) {
      if (i + 1 < tokens.length) {
        return extractCommandPath(tokens[i + 1]);
      }
      return null;
    }

    // 3. Skip options that take an argument
    if (
      normalized === "-r" ||
      normalized === "--require" ||
      normalized === "--loader" ||
      normalized === "--experimental-loader" ||
      normalized === "--import" ||
      normalized === "-m"
    ) {
      i++; // Skip the option parameter/argument token
      continue;
    }

    // 4. Skip shell flow control that commonly appears inside -c payloads.
    if (isShellSeparator(normalized)) {
      continue;
    }

    // 5. Skip "cd <dir>" so the directory is not mistaken for a hook target.
    if (lower === "cd" || lower === "pushd" || lower === "popd") {
      if (lower !== "popd") i++;
      continue;
    }

    // 6. Skip other flags (e.g. --inspect, -v).
    if (
      normalized.startsWith("-") ||
      (normalized.startsWith("/") && normalized.length === 2)
    ) {
      continue;
    }

    // 7. Check if it's a script/path-like target
    if (isScriptLike(normalized)) {
      return normalized;
    }
  }

  return null;
}

// Resolve a hook target path for existence checking. Absolute paths are used
// as-is. Relative paths (e.g. ".claude/hooks/foo.mjs") resolve against rootDir
// when provided (so a settings.json belonging to any project can be scanned
// correctly), else fall back to the process cwd — the pre-existing behavior.
export function resolveHookTarget(target, rootDir = null) {
  if (!target) return target;
  if (path.isAbsolute(target)) return target;
  if (rootDir) return path.resolve(rootDir, target);
  return target;
}

// A hook/dependency target counts as present only if it resolves to a REGULAR
// FILE (symlinks followed). A directory or a stat error must never be treated as
// a runnable hook/helper, otherwise the gate is fail-open on directory
// look-alikes. (Codex R2 Blocking 2.)
export function isRegularFile(p) {
  if (!p) return false;
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// Basename key for the transitive-dep table. Windows resolves paths
// case-insensitively, so a settings.json referencing MEDUSA-WORKER.MJS still
// runs the real lowercase file — normalize the lookup key to lowercase there so
// the dependency table cannot be bypassed by case variants. (Codex R2 Blocking 3.)
function transitiveDepKey(hookAbs) {
  const base = customBasename(hookAbs);
  return platform() === "win32" ? base.toLowerCase() : base;
}

// Transitive hook dependencies: files that settings.json does NOT reference
// directly, but that a referenced hook spawns at runtime as a SIBLING in the
// same hooks directory. If one is missing, the referencing hook throws
// ENOENT / MODULE_NOT_FOUND at runtime even though settings.json has no
// dangling reference — the exact gap that let a consumer repo ship
// medusa-postscan-enqueue.mjs + medusa-worker.mjs but miss the Python helper.
// Edges mirror the real spawn sites (canonical/runtime-assets):
//   medusa-postscan-enqueue.mjs spawns ./medusa-worker.mjs
//       (claude/hooks/medusa-postscan-enqueue.mjs L300 path.join(HOOK_DIR,...) / L313 spawn)
//   medusa-findings-surface.mjs spawns ./medusa-worker.mjs
//       (shared/hooks/medusa-findings-surface.mjs L273 path.join(HOOK_DIR,...) / L280 spawn)
//   medusa-worker.mjs           spawns ./medusa_batch_scan.py
//       (shared/scripts/medusa-worker.mjs L190 path.join(here,...) / L200 spawn)
export const HOOK_TRANSITIVE_DEPS = {
  "medusa-postscan-enqueue.mjs": ["medusa-worker.mjs"],
  "medusa-findings-surface.mjs": ["medusa-worker.mjs"],
  "medusa-worker.mjs": ["medusa_batch_scan.py"],
};

// Walk the transitive-dependency closure of the LIVE (existing, referenced)
// hooks and return every spawned-sibling file that is missing on disk, each
// with the full call chain from settings.json down to the missing file. Each
// dependency is resolved as a sibling of the file that spawns it — exactly how
// the hooks resolve each other via path.join(<own dir>, <child>). Missing files
// and already-walked files are de-duplicated so a hook referenced by several
// events (e.g. findings-surface on session-start/user-prompt/stop) reports each
// gap once.
export function collectMissingTransitiveDeps(liveEntries, rootDir = null) {
  const missing = [];
  const walkedOk = new Set(); // hook abs paths already recursed into
  const reportedMissing = new Set(); // missing dep abs paths already reported

  const walk = (hookAbs, chain) => {
    const deps = HOOK_TRANSITIVE_DEPS[transitiveDepKey(hookAbs)];
    if (!deps) return;
    const dir = path.dirname(hookAbs);
    for (const dep of deps) {
      const depAbs = path.join(dir, dep);
      const depChain = [...chain, dep];
      if (!isRegularFile(depAbs)) {
        if (!reportedMissing.has(depAbs)) {
          reportedMissing.add(depAbs);
          missing.push({ dep, path: depAbs, chain: depChain });
        }
        continue; // missing, or a directory masquerading as the helper file
      }
      if (walkedOk.has(depAbs)) continue;
      walkedOk.add(depAbs);
      walk(depAbs, depChain);
    }
  };

  for (const entry of liveEntries || []) {
    const abs = resolveHookTarget(entry.path, rootDir);
    if (!abs || !HOOK_TRANSITIVE_DEPS[transitiveDepKey(abs)]) continue;
    walk(abs, ["settings.json", customBasename(abs)]);
  }
  return missing;
}

export function scanSettingsFile(settingsPath, rootDir = null) {
  if (!existsSync(settingsPath)) {
    return { ok: false, reason: "missing" };
  }
  let raw;
  try {
    raw = readFileSync(settingsPath, "utf8");
  } catch (e) {
    return { ok: false, reason: "read-failed", error: e };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, reason: "parse-failed", error: e };
  }
  const hooks = parsed.hooks || {};
  const zombies = [];
  const live = [];
  const unverifiable = [];
  for (const [event, blocks] of Object.entries(hooks)) {
    for (const block of blocks || []) {
      for (const hook of block.hooks || []) {
        const target = extractCommandPath(hook.command || "");
        const entry = {
          event,
          matcher: block.matcher,
          path: target,
          command: hook.command,
        };
        if (!target) {
          // No statically-extractable script path → cannot be verified on disk.
          unverifiable.push(entry);
        } else if (isRegularFile(resolveHookTarget(target, rootDir))) {
          live.push(entry);
        } else {
          zombies.push(entry);
        }
      }
    }
  }
  const missingDeps = collectMissingTransitiveDeps(live, rootDir);
  return { ok: true, settings: parsed, zombies, live, unverifiable, missingDeps };
}

function removeZombies(settings, rootDir = null) {
  const hooks = settings.hooks || {};
  const next = {};
  let removed = 0;
  for (const [event, blocks] of Object.entries(hooks)) {
    const keptBlocks = (blocks || [])
      .map((block) => {
        const keptHooks = (block.hooks || []).filter((hook) => {
          const target = extractCommandPath(hook.command || "");
          if (!target) return true;
          if (isRegularFile(resolveHookTarget(target, rootDir))) return true;
          removed += 1;
          return false;
        });
        return { ...block, hooks: keptHooks };
      })
      .filter((block) => (block.hooks || []).length > 0);
    if (keptBlocks.length > 0) {
      next[event] = keptBlocks;
    }
  }
  return { settings: { ...settings, hooks: next }, removed };
}

function iso() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function backupPath(settingsPath) {
  return `${settingsPath}.backup-${iso()}`;
}

function findProjectSettings() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, "..");
  const projSettings = path.join(repoRoot, ".claude", "settings.json");
  return existsSync(projSettings) ? projSettings : null;
}

async function main() {
  const args = process.argv.slice(2);
  const fixMode = args.includes("--fix");
  const allMode = args.includes("--all");
  const projectOnly = args.includes("--project");
  const silent = args.includes("--silent");
  const langIdx = args.indexOf("--lang");
  const langArg = langIdx >= 0 ? args[langIdx + 1] : null;
  const projectRootIdx = args.indexOf("--project-root");
  const projectRootArg = projectRootIdx >= 0 ? args[projectRootIdx + 1] : null;
  const lang = resolveLang(langArg);
  const t = MESSAGES[lang] || MESSAGES.en;

  // --project-root is the fail-closed gate mode; its value must be a real
  // directory, not a missing arg or the next flag. Without this check,
  // "--project-root --silent" would treat "--silent" as the project root and
  // then silently pass because that directory has no .claude/settings.json.
  if (
    projectRootIdx >= 0 &&
    (projectRootArg == null ||
      projectRootArg.trim() === "" ||
      projectRootArg.startsWith("--"))
  ) {
    console.error(
      `${C.red}doctor-hooks: --project-root requires a non-empty directory value${C.reset}`,
    );
    process.exit(2);
  }
  const gateMode = projectRootIdx >= 0;

  const userSettings = path.join(homedir(), ".claude", "settings.json");
  const projectSettings = findProjectSettings();
  const targets = [];
  if (gateMode) {
    // Explicit project root: scan ONLY that project's .claude/settings.json and
    // resolve its relative hook paths against it. This is the fail-closed
    // Claude-project gate any CLAUDE-projected consumer repo can run to catch
    // dangling / directory / unverifiable / missing-sibling hook references.
    // Branch on the flag's presence (gateMode), NOT on truthiness, so an empty
    // value can never silently fall back to the user-settings scan. (Codex R2 B1.)
    const root = path.resolve(projectRootArg);
    let rootIsDir = false;
    try {
      rootIsDir = statSync(root).isDirectory();
    } catch {
      rootIsDir = false;
    }
    if (!rootIsDir) {
      console.error(
        `${C.red}doctor-hooks: --project-root is not an existing directory: ${root}${C.reset}`,
      );
      process.exit(2);
    }
    targets.push({
      path: path.join(root, ".claude", "settings.json"),
      label: "project",
      rootDir: root,
    });
  } else {
    if (!projectOnly)
      targets.push({ path: userSettings, label: "user", rootDir: null });
    if ((allMode || projectOnly) && projectSettings) {
      targets.push({ path: projectSettings, label: "project", rootDir: null });
    }
  }

  if (!silent) {
    console.log(`${C.bold}${C.cyan}${t.title}${C.reset}`);
    if (!langArg) {
      console.log(`${C.dim}${t.langAutoDetected(lang)}${C.reset}`);
    }
  }

  let totalZombies = 0;
  let gateFailure = false;
  for (const target of targets) {
    if (!silent) {
      console.log(`\n${C.bold}${t.scanning(target.path)}${C.reset}`);
    }
    const result = scanSettingsFile(target.path, target.rootDir);
    if (!result.ok) {
      if (result.reason === "missing") {
        // In gate mode a missing settings.json means the gate cannot verify the
        // project's hook references — fail closed instead of silently passing.
        if (gateMode) {
          console.error(`${C.red}  ${t.notFound(target.path)}${C.reset}`);
          gateFailure = true;
        } else if (!silent) {
          console.log(`${C.dim}  ${t.notFound(target.path)}${C.reset}`);
        }
        continue;
      }
      if (result.reason === "parse-failed") {
        console.error(
          `${C.red}  ${t.parseFailed(target.path, result.error?.message ?? "")}${C.reset}`,
        );
        process.exitCode = 1;
        if (gateMode) gateFailure = true;
        continue;
      }
      // read-failed or any other non-ok result: a real error under the gate.
      if (gateMode) {
        console.error(
          `${C.red}  doctor-hooks: cannot read ${target.path}${C.reset}`,
        );
        process.exitCode = 1;
        gateFailure = true;
      }
      continue;
    }
    const { zombies, live, settings, unverifiable } = result;

    // Unverifiable commands (no statically-extractable script path) cannot be
    // gate-verified; in gate mode that is fail-closed, not silently live.
    if (gateMode && (unverifiable?.length ?? 0) > 0) {
      for (const u of unverifiable) {
        console.error(
          `${C.red}  doctor-hooks: unverifiable hook command (no extractable script path): ${u.command}${C.reset}`,
        );
      }
      gateFailure = true;
    }

    // Transitive-dependency gate: a hook that settings.json references may spawn
    // sibling files at runtime (e.g. medusa-worker.mjs -> medusa_batch_scan.py).
    // Those never appear as settings.json references, so the zombie scan above
    // cannot see them. Only enforce this in --project-root gate mode, where the
    // hooks directory is a concrete, fully-projected consumer repo; the default
    // ~/.claude scan uses cwd-relative template paths and must not be disturbed.
    // This is an explicit fail-closed branch (non-zero exit), not an assertion,
    // so it cannot be silently stripped or bypassed.
    const missingDeps = gateMode ? result.missingDeps || [] : [];
    if (missingDeps.length > 0) {
      for (const d of missingDeps) {
        console.error(
          `${C.red}  doctor-hooks: missing transitive hook dependency (spawned, not in settings.json)${C.reset}`,
        );
        console.error(
          `${C.red}    chain: ${d.chain.join(" -> ")}${C.reset}`,
        );
        console.error(`${C.red}    missing file: ${d.path}${C.reset}`);
        console.error(
          `${C.dim}    fix: re-run \`node setup.mjs\` / \`npm run meta:sync\` to reproject Meta_Kim hooks, ` +
            `or restore it from canonical/runtime-assets/shared/scripts/${d.dep}${C.reset}`,
        );
      }
      gateFailure = true;
    }

    if (zombies.length === 0 && live.length === 0) {
      if (!silent) console.log(`${C.dim}  ${t.noHooks(target.path)}${C.reset}`);
      continue;
    }
    if (zombies.length === 0) {
      if (!silent) {
        console.log(`${C.green}  ✓ ${t.summaryClean}${C.reset}`);
        console.log(`${C.dim}  ${t.liveHeader(live.length)}${C.reset}`);
        for (const l of live) {
          console.log(
            `${C.dim}${t.zombieItem(l.event, l.matcher, l.path)}${C.reset}`,
          );
        }
      }
      continue;
    }
    totalZombies += zombies.length;
    if (!silent) {
      console.log(`${C.yellow}  ⚠ ${t.zombieHeader(zombies.length)}${C.reset}`);
      for (const z of zombies) {
        console.log(
          `${C.yellow}${t.zombieItem(z.event, z.matcher, z.path)}${C.reset}`,
        );
      }
      console.log(`${C.dim}  ${t.liveHeader(live.length)}${C.reset}`);
      for (const l of live) {
        console.log(
          `${C.dim}${t.zombieItem(l.event, l.matcher, l.path)}${C.reset}`,
        );
      }
    }

    if (!fixMode) {
      if (!silent) console.log(`\n${C.bold}${t.dryRunHint}${C.reset}`);
      continue;
    }

    const backup = backupPath(target.path);
    writeFileSync(backup, JSON.stringify(settings, null, 2));
    if (!silent)
      console.log(`${C.green}  ${t.backupWritten(backup)}${C.reset}`);

    const { settings: cleaned, removed } = removeZombies(settings, target.rootDir);
    writeFileSync(target.path, `${JSON.stringify(cleaned, null, 2)}\n`);
    if (!silent) {
      console.log(`${C.green}  ${t.removedCount(removed)}${C.reset}`);
      console.log(`${C.green}  ${t.settingsSaved(target.path)}${C.reset}`);
      console.log(`${C.dim}  ${t.finalStructure}${C.reset}`);
      for (const [ev, blocks] of Object.entries(cleaned.hooks || {})) {
        const n = blocks.reduce((acc, b) => acc + (b.hooks || []).length, 0);
        console.log(`${C.dim}    ${ev}: ${n}${C.reset}`);
      }
    }
  }

  // gateFailure (missing / unreadable / unparseable settings under --project-root)
  // must produce a non-zero exit even when there were zero dangling references,
  // and must not be clobbered by the silent-mode exit below.
  if (gateFailure) process.exitCode = 1;
  if (silent) {
    process.exit(totalZombies > 0 || gateFailure ? 1 : 0);
  }
}

const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);
if (isMain) {
  main().catch((err) => {
    console.error(
      `${C.red}doctor-hooks failed: ${err?.message ?? err}${C.reset}`,
    );
    process.exit(1);
  });
}
