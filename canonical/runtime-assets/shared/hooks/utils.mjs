#!/usr/bin/env node
/**
 * Shared utilities for Meta_Kim hooks.
 * DRY centralization — all hooks import from here instead of duplicating readJsonFromStdin.
 * Canonical cross-runtime source projected into each runtime hook directory.
 */

/**
 * Read and parse JSON from stdin.
 * Returns empty object on empty input or parse failure.
 */
export async function readJsonFromStdin() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
  }
  try {
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/**
 * Read and parse JSON from stdin, synchronously.
 * Returns empty object on empty input or parse failure.
 */
export function readJsonFromStdinSync() {
  let raw = "";
  for (const chunk of process.stdin) {
    raw += chunk;
  }
  try {
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/**
 * Extract the file path from a Claude Code hook input object.
 * Handles various field names across different hook types.
 */
export function extractFilePath(input) {
  if (input === null || typeof input !== "object") return "";

  const candidates = [
    input.file_path,
    input.filePath,
    input.path,
    input.target_path,
    input.targetPath,
    input.tool_input?.file_path,
    input.tool_input?.filePath,
    input.tool_input?.path,
    input.tool_input?.target_path,
    input.tool_input?.targetPath,
    input.tool_response?.filePath,
    input.tool_response?.file_path,
    input.tool_response?.target_path,
    input.tool_response?.targetPath,
  ];

  return candidates.find(
    (candidate) => typeof candidate === "string" && candidate.length > 0,
  ) ?? "";
}
