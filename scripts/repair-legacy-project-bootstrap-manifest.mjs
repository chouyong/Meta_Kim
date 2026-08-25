#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeSafeManagedFileTransaction } from "./safe-managed-file-operations.mjs";

const RESULT_SCHEMA = "meta-kim-project-bootstrap-repair-result-v0.1";
const MANIFEST_SCHEMA = "meta-kim-project-bootstrap-v0.1";
const HASH_RE = /^[a-f0-9]{64}$/iu;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv) {
  const options = {
    projectDir: process.env.META_KIM_CALLER_CWD || process.cwd(),
    manifestPath: null,
    apply: false,
    trustCurrentBytes: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project-dir" || arg === "--manifest") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      if (arg === "--project-dir") options.projectDir = value;
      else options.manifestPath = value;
      index += 1;
      continue;
    }
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--trust-current-bytes") options.trustCurrentBytes = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown option '${arg}'`);
  }
  return options;
}

function normalizeRelPath(value) {
  const rel = String(value ?? "").replace(/\\/gu, "/").replace(/^\.\//u, "");
  if (!rel || rel.startsWith("/") || rel.split("/").some((part) => !part || part === "." || part === "..")) return null;
  return rel;
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertTrustedProjectDir(projectDir) {
  const root = path.resolve(projectDir);
  if (!existsSync(root) || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) {
    throw new Error("project directory must be an existing non-linked directory");
  }
  return root;
}

function assertTrustedManifestPath(projectRoot, manifestPath) {
  const absolute = path.resolve(manifestPath);
  if (!isInside(projectRoot, absolute)) throw new Error("manifest must remain inside the project directory");
  let current = projectRoot;
  for (const segment of path.relative(projectRoot, absolute).split(path.sep)) {
    current = path.join(current, segment);
    if (!existsSync(current)) continue;
    const stats = lstatSync(current);
    if (stats.isSymbolicLink()) throw new Error("manifest path cannot traverse a symlink");
  }
  return absolute;
}

function readManifest(manifestPath) {
  if (!existsSync(manifestPath) || !lstatSync(manifestPath).isFile()) throw new Error("project bootstrap manifest is missing");
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    throw new Error("project bootstrap manifest is not valid JSON");
  }
}

function sourceRelPath(entry) {
  return normalizeRelPath(entry?.relPath ?? entry?.path ?? entry?.relativePath);
}

function inspectEntry(projectRoot, entry, trustCurrentBytes) {
  const relPath = sourceRelPath(entry);
  if (!relPath) return { relPath: null, status: "invalid_path", reason: "unsafe_or_missing_rel_path" };
  const absolute = path.join(projectRoot, ...relPath.split("/"));
  if (!isInside(projectRoot, absolute)) return { relPath, status: "invalid_path", reason: "outside_project" };
  let currentHash = null;
  let size = null;
  if (existsSync(absolute)) {
    const stats = lstatSync(absolute);
    if (stats.isSymbolicLink() || !stats.isFile()) return { relPath, status: "blocked", reason: "linked_or_non_file" };
    const bytes = readFileSync(absolute);
    currentHash = sha256(bytes);
    size = bytes.length;
  }
  const existingHash = String(entry?.contentHash ?? entry?.sha256 ?? entry?.hash ?? "").toLowerCase();
  if (HASH_RE.test(existingHash)) {
    return {
      relPath,
      status: currentHash && currentHash === existingHash ? "verified_existing" : "drifted",
      contentHash: existingHash,
      currentHash,
      size,
      trustRequired: false,
    };
  }
  return {
    relPath,
    status: currentHash ? (trustCurrentBytes ? "trustable_current_bytes" : "trust_required") : "missing_target",
    contentHash: currentHash && trustCurrentBytes ? currentHash : null,
    currentHash,
    size,
    trustRequired: Boolean(currentHash),
  };
}

function buildResult(options, projectRoot, manifestPath, manifest, entries) {
  const invalid = entries.filter((entry) => ["invalid_path", "blocked", "drifted"].includes(entry.status));
  const requiresTrust = entries.some((entry) => entry.trustRequired && !options.trustCurrentBytes);
  const canApply = invalid.length === 0 && (!requiresTrust || options.trustCurrentBytes);
  const migratedEntries = entries.map((entry, index) => ({
    ...manifest.managedFiles[index],
    relPath: entry.relPath,
    ...(entry.contentHash ? { contentHash: entry.contentHash } : {}),
    ...(entry.size === null ? {} : { size: entry.size }),
  }));
  const repairedManifest = {
    ...manifest,
    schemaVersion: MANIFEST_SCHEMA,
    managedFiles: migratedEntries,
    legacyRepair: {
      sourceSchemaVersion: manifest.schemaVersion ?? null,
      sourceMetaKimVersion: manifest.metaKimVersion ?? null,
      trustedCurrentBytes: options.trustCurrentBytes,
    },
  };
  return {
    schemaVersion: RESULT_SCHEMA,
    mode: options.apply ? "apply" : "dry-run",
    ok: options.apply ? canApply : true,
    projectDir: projectRoot,
    manifestPath,
    sourceSchemaVersion: manifest.schemaVersion ?? null,
    sourceMetaKimVersion: manifest.metaKimVersion ?? null,
    requiresTrust,
    trustCurrentBytes: options.trustCurrentBytes,
    writeCount: options.apply && canApply ? 1 : 0,
    entries,
    repairedManifest,
    backup: null,
  };
}

function applyRepair(result, originalBytes) {
  const transaction = executeSafeManagedFileTransaction({
    trustedRoot: result.projectDir,
    backupRoot: path.join(result.projectDir, ".meta-kim", "backups", "project-bootstrap-legacy-repair"),
    transactionLabel: "project-bootstrap-legacy-repair",
    lockKey: "project-bootstrap-legacy-repair",
    injectFailureAtCommit: process.env.META_KIM_TEST_INJECT_LEGACY_REPAIR_FAILURE === "after-backup" ? 1 : 0,
    operations: [{
      kind: "write",
      phase: "manifest",
      relPath: path.relative(result.projectDir, result.manifestPath).replaceAll("\\", "/"),
      content: `${JSON.stringify(result.repairedManifest, null, 2)}\n`,
      expectedOldHash: sha256(originalBytes),
    }],
  });
  if (!transaction.ok) {
    if (process.env.META_KIM_TEST_INJECT_LEGACY_REPAIR_FAILURE === "after-backup") {
      throw new Error("injected legacy manifest repair failure");
    }
    throw new Error(`legacy manifest repair transaction ${transaction.status}: ${transaction.reason ?? "unknown failure"}`);
  }
  const transactionBackup = transaction.backups?.[0];
  if (!transactionBackup?.backupPath || sha256(readFileSync(transactionBackup.backupPath)) !== sha256(originalBytes)) {
    throw new Error("legacy manifest repair backup verification failed");
  }
  result.backup = {
    path: transactionBackup.backupPath,
    sha256: transactionBackup.backupHash,
    bytes: originalBytes.length,
    transaction: transaction.status,
    verified: true,
  };
  return result;
}

function help() {
  return "meta-kim project bootstrap repair-legacy-manifest [--project-dir <dir>] [--dry-run|--apply] [--trust-current-bytes] [--json]";
}

export function runLegacyManifestRepair(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return { help: help() };
  const projectRoot = assertTrustedProjectDir(options.projectDir);
  const manifestPath = assertTrustedManifestPath(
    projectRoot,
    options.manifestPath || path.join(projectRoot, ".meta-kim", "state", "default", "project-bootstrap.json"),
  );
  const originalBytes = readFileSync(manifestPath);
  const manifest = readManifest(manifestPath);
  if (!Array.isArray(manifest.managedFiles) || manifest.managedFiles.length === 0) throw new Error("legacy manifest has no managedFiles");
  const entries = manifest.managedFiles.map((entry) => inspectEntry(projectRoot, entry, options.trustCurrentBytes));
  const result = buildResult(options, projectRoot, manifestPath, manifest, entries);
  if (options.apply) {
    if (!result.ok) throw new Error(result.requiresTrust ? "explicit --trust-current-bytes is required" : "legacy manifest repair is blocked by unsafe or drifted entries");
    applyRepair(result, originalBytes);
  }
  return result;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = runLegacyManifestRepair();
    if (result.help) console.log(result.help);
    else console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok === false ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
