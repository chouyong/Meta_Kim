#!/usr/bin/env node
/**
 * medusa-ack — local CLI to manage classifications.jsonl entries.
 *
 * Writes (and revokes) sha-bound user acknowledgements that suppress medusa
 * AI-context findings the user has reviewed and accepted as expected. Acks
 * never delete findings.jsonl entries — they only stop the surface hook from
 * surfacing them.
 *
 * Usage:
 *   node scripts/medusa-ack.mjs --file <path> \
 *     --classification expected_security_doc_sample \
 *     --reason "<text>" \
 *     [--reviewer <name>] \
 *     [--profile default] \
 *     [--dry-run]
 *
 *   node scripts/medusa-ack.mjs --file <path> --revoke [--profile default]
 *
 *   node scripts/medusa-ack.mjs --list [--profile default]
 *
 * The CLI computes the file's current sha256 itself, so the ack is bound to
 * the exact content the user reviewed. A subsequent edit produces a new sha
 * and the ack stops applying automatically.
 */

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PROFILE_DEFAULT = "default";
const DEFAULT_CLASSIFICATION = "expected_security_doc_sample";

function parseArgs(argv) {
  const out = { kv: {}, flags: new Set() };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const next = argv[i + 1];
    const isFlag = !next || next.startsWith("--");
    if (isFlag) {
      out.flags.add(arg.slice(2));
    } else {
      out.kv[arg.slice(2)] = next;
      i += 1;
    }
  }
  return out;
}

function canonicalFileKey(filePath) {
  if (!filePath || typeof filePath !== "string") return "";
  const resolved = path.resolve(filePath).replace(/\\/g, "/");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function fileSha256(absPath) {
  try {
    return createHash("sha256").update(readFileSync(absPath)).digest("hex");
  } catch (err) {
    return null;
  }
}

function classificationsPath(repoRoot, profile) {
  return path.join(repoRoot, ".meta-kim", "state", profile, "medusa", "classifications.jsonl");
}

function loadAcks(classPath) {
  if (!existsSync(classPath)) return new Map();
  const map = new Map();
  for (const line of readFileSync(classPath, "utf8").split("\n").filter(Boolean)) {
    try {
      const r = JSON.parse(line);
      if (r.file && r.sha256) {
        const key = `${canonicalFileKey(r.file)}|${r.sha256}`;
        if (r.revoked) map.delete(key);
        else map.set(key, r);
      }
    } catch {}
  }
  return map;
}

function fail(msg, code = 1) {
  process.stderr.write(`[medusa-ack] ${msg}\n`);
  process.exit(code);
}

function listMode(repoRoot, profile) {
  const acks = loadAcks(classificationsPath(repoRoot, profile));
  if (acks.size === 0) {
    process.stdout.write(`[medusa-ack] no active acknowledgements for profile=${profile}\n`);
    return 0;
  }
  for (const [key, r] of acks.entries()) {
    process.stdout.write(`${key}  ${r.classification || "?"}  by=${r.reviewer || "?"}  at=${r.createdAt || "?"}\n`);
    if (r.reason) process.stdout.write(`  reason: ${r.reason}\n`);
  }
  process.stdout.write(`[medusa-ack] ${acks.size} active ack(s) for profile=${profile}\n`);
  return 0;
}

function ackMode(repoRoot, profile, kv, flags) {
  const filePath = kv.file;
  if (!filePath) fail("--file is required");
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
  if (!existsSync(abs)) fail(`file not found: ${abs}`);
  const sha = fileSha256(abs);
  if (!sha) fail(`failed to read file: ${abs}`);
  const fileKey = canonicalFileKey(abs);

  const isRevoke = flags.has("revoke");
  const record = {
    file: fileKey,
    sha256: sha,
    classification: isRevoke ? null : (kv.classification || DEFAULT_CLASSIFICATION),
    reason: kv.reason || (isRevoke ? "revoked via medusa-ack CLI" : ""),
    reviewer: kv.reviewer || os.userInfo().username || "unknown",
    createdAt: new Date().toISOString(),
  };
  if (isRevoke) record.revoked = true;

  if (flags.has("dry-run")) {
    process.stdout.write(`[medusa-ack] dry-run — would append:\n${JSON.stringify(record, null, 2)}\n`);
    return 0;
  }

  const classPath = classificationsPath(repoRoot, profile);
  try {
    mkdirSync(path.dirname(classPath), { recursive: true });
    appendFileSync(classPath, JSON.stringify(record) + "\n", "utf8");
  } catch (err) {
    fail(`failed to write classifications.jsonl: ${err && err.message}`);
  }
  process.stdout.write(`[medusa-ack] ${isRevoke ? "revoked" : "acked"} ${fileKey} sha=${sha.slice(0, 12)}…\n`);
  return 0;
}

function main() {
  const { kv, flags } = parseArgs(process.argv);
  if (flags.has("help") || (!flags.has("list") && !kv.file && !flags.has("revoke"))) {
    process.stdout.write([
      "medusa-ack — manage classifications.jsonl",
      "",
      "Add an ack:",
      "  node scripts/medusa-ack.mjs --file <path> --classification <type> --reason <text> [--reviewer <name>] [--profile default] [--dry-run]",
      "",
      "Revoke an existing ack:",
      "  node scripts/medusa-ack.mjs --file <path> --revoke [--profile default]",
      "",
      "List current acks:",
      "  node scripts/medusa-ack.mjs --list [--profile default]",
      "",
      `Default classification: ${DEFAULT_CLASSIFICATION}`,
      "",
    ].join("\n"));
    return 0;
  }
  const repoRoot = process.cwd();
  const profile = kv.profile || process.env.META_KIM_PROFILE || PROFILE_DEFAULT;

  if (flags.has("list")) {
    return listMode(repoRoot, profile);
  }
  return ackMode(repoRoot, profile, kv, flags);
}

process.exit(main());
