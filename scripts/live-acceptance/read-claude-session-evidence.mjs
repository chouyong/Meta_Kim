import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const SOURCE_CATEGORY = "claude_interactive_session_file_handoff";
const ARTIFACT_SCHEMA_VERSION = "meta-kim-claude-interactive-session-handoff-v1";
const FAILURE_SOURCE_CATEGORY = "claude_interactive_session_failure_observation";
const FAILURE_ARTIFACT_SCHEMA_VERSION = "meta-kim-claude-interactive-session-failure-observation-v1";
const OFFICIAL_CLI_ONLY_403_FAILURE_CLASS = "gateway_403_official_cli_only";
const OFFICIAL_CLI_ONLY_403_TEXT = "Please run /login · API Error: 403 Request blocked: this endpoint only accepts requests from the official Claude Code CLI";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function inside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function normalizedPathDigest(filePath) {
  const normalized = realpathSync.native(filePath).replaceAll("\\", "/");
  return sha256(process.platform === "win32" ? normalized.toLowerCase() : normalized);
}

function assertPlainDirectory(directoryPath, label) {
  const stats = lstatSync(directoryPath);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`${label} must be a plain directory`);
  return realpathSync.native(directoryPath);
}

function assertPlainFile(filePath, label) {
  const stats = lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`${label} must be an existing plain file`);
  return realpathSync.native(filePath);
}

function readStablePrefix(filePath, requestedSize = null) {
  const real = assertPlainFile(filePath, "Claude session source");
  const handle = openSync(real, "r");
  try {
    const before = fstatSync(handle);
    const size = requestedSize == null ? before.size : requestedSize;
    if (!Number.isSafeInteger(size) || size <= 0 || size > before.size) throw new Error("Claude session snapshot size is invalid");
    const bytes = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const count = readSync(handle, bytes, offset, size - offset, offset);
      if (count <= 0) throw new Error("Claude session snapshot ended before the bound prefix");
      offset += count;
    }
    const after = fstatSync(handle);
    if (after.size < size) throw new Error("Claude session source shrank during snapshot capture");
    if (bytes.at(-1) !== 0x0a) throw new Error("Claude session snapshot must end at a complete JSONL line");
    return { real, bytes, size, sha256: sha256(bytes) };
  } finally {
    closeSync(handle);
  }
}

function decodeJsonLines(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Claude session snapshot is not valid UTF-8");
  }
  const rawLines = text.split(/\r?\n/u);
  if (rawLines.at(-1) === "") rawLines.pop();
  const records = rawLines.map((line, index) => {
    try {
      return { lineNumber: index + 1, rawLine: line, value: JSON.parse(line) };
    } catch {
      throw new Error(`Claude session snapshot line ${index + 1} is not valid JSON`);
    }
  });
  return { text, rawLines, records };
}

function safeIdentifier(value, label) {
  if (typeof value !== "string" || !value || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function exactSessionId(record) {
  return record.sessionId ?? record.session_id ?? null;
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((entry) => typeof entry === "string" ? entry : typeof entry?.text === "string" ? entry.text : "").join("\n");
}

function toolBlocks(recordEntry, type) {
  const content = recordEntry.value?.message?.content;
  if (!Array.isArray(content)) return [];
  return content.filter((block) => block?.type === type).map((block) => ({ ...recordEntry, block }));
}

function requireProjectRecord(entry, projectRoot, sessionId, sinceMs) {
  if (exactSessionId(entry.value) !== sessionId) throw new Error("Claude handoff lifecycle crosses session boundaries");
  if (!Number.isFinite(Date.parse(entry.value?.timestamp ?? "")) || Date.parse(entry.value.timestamp) < sinceMs) {
    throw new Error("Claude handoff lifecycle is outside the requested evidence window");
  }
  if (typeof entry.value?.cwd !== "string" || !existsSync(entry.value.cwd) || normalizedPathDigest(entry.value.cwd) !== normalizedPathDigest(projectRoot)) {
    throw new Error("Claude handoff lifecycle cwd does not match the project root");
  }
}

function inputPath(input) {
  return input?.file_path ?? input?.path ?? null;
}

function exactProbePath(value, expectedPath) {
  if (typeof value !== "string" || !value) return false;
  return path.resolve(value) === expectedPath;
}

function unique(items, label) {
  if (items.length !== 1) throw new Error(`Claude handoff requires one exact ${label} event`);
  return items[0];
}

function lineBinding(entry) {
  return { lineNumber: entry.lineNumber, sha256: sha256(entry.rawLine) };
}

function resultRecordFor(resultsById, toolUseId, label) {
  const results = resultsById.get(toolUseId) ?? [];
  return unique(results, `${label} result`);
}

function resultFailed(result) {
  const recordResult = result.value?.toolUseResult;
  return result.block?.is_error === true || recordResult?.is_error === true || recordResult?.isError === true ||
    ["error", "failed", "declined", "cancelled", "canceled"].includes(String(recordResult?.status ?? "").toLowerCase());
}

function nestedStrings(value) {
  const values = [];
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "string") {
      values.push(current);
    } else if (Array.isArray(current)) {
      pending.push(...current);
    } else if (current && typeof current === "object") {
      pending.push(...Object.values(current));
    }
  }
  return values;
}

function taskNotification(entry) {
  const text = nestedStrings(entry.value).find((value) => value.includes("<task-notification>") && value.includes(OFFICIAL_CLI_ONLY_403_TEXT));
  if (!text) return null;
  const tag = (name) => text.match(new RegExp(`<${name}>([^<]+)</${name}>`, "u"))?.[1] ?? null;
  return {
    entry,
    taskId: tag("task-id"),
    toolUseId: tag("tool-use-id"),
    status: tag("status"),
    failureText: OFFICIAL_CLI_ONLY_403_TEXT,
  };
}

function event({ eventId, family, hostSurface, resultStatus, input, output, sessionId, childSessionId = null, sourceEntries, completionBoundary, facet }) {
  return {
    eventId,
    family,
    hostSurface,
    providerId: `claude.${hostSurface.toLowerCase()}`,
    resultStatus,
    inputDigest: sha256(JSON.stringify(input)),
    outputDigest: sha256(output),
    sessionId,
    childSessionId,
    sourceLines: sourceEntries.map((entry) => entry.lineNumber),
    sourceLineBindings: sourceEntries.map(lineBinding),
    completionBoundary,
    facet,
  };
}

function sessionCandidates(projectsRoot, sessionId, sessionRef = null) {
  if (sessionRef != null) {
    if (typeof sessionRef !== "string" || !sessionRef || path.isAbsolute(sessionRef)) throw new Error("Claude session reference is invalid");
    const candidate = path.resolve(projectsRoot, sessionRef);
    if (!inside(candidate, projectsRoot)) throw new Error("Claude session reference escapes the Claude projects root");
    assertPlainDirectory(path.dirname(candidate), "Claude project session directory");
    return [candidate];
  }
  const candidates = [];
  for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const directory = path.join(projectsRoot, entry.name);
    assertPlainDirectory(directory, "Claude project session directory");
    const candidate = path.join(directory, `${sessionId}.jsonl`);
    if (existsSync(candidate)) candidates.push(candidate);
  }
  return candidates;
}

function readCandidate({ candidate, projectRoot, profile, sessionId, marker, workspacePath, sinceMs, sessionSnapshotSize, projectsRoot }) {
  const snapshot = readStablePrefix(candidate, sessionSnapshotSize);
  const parsed = decodeJsonLines(snapshot.bytes);
  const toolUses = parsed.records.flatMap((entry) => toolBlocks(entry, "tool_use"));
  const toolResults = parsed.records.flatMap((entry) => toolBlocks(entry, "tool_result"));
  const resultsById = new Map();
  for (const result of toolResults) {
    const id = result.block?.tool_use_id;
    if (typeof id !== "string") continue;
    const matches = resultsById.get(id) ?? [];
    matches.push(result);
    resultsById.set(id, matches);
  }

  const resolvedProjectRoot = realpathSync.native(projectRoot);
  const resolvedWorkspace = realpathSync.native(workspacePath);
  const trustedWorkspaces = path.join(resolvedProjectRoot, ".meta-kim", "state", profile, "runtime-capability-producers", "workspaces");
  const realTrustedWorkspaces = assertPlainDirectory(trustedWorkspaces, "controlled producer workspaces root");
  if (!inside(resolvedWorkspace, realTrustedWorkspaces) || resolvedWorkspace === realTrustedWorkspaces) {
    throw new Error("Claude handoff workspace must be inside the controlled producer workspaces root");
  }
  const probeFile = assertPlainFile(path.join(resolvedWorkspace, "meta-kim-probe.txt"), "Claude handoff probe file");
  if (!inside(probeFile, resolvedWorkspace)) throw new Error("Claude handoff probe file escapes its controlled workspace");
  const expectedFinal = `after-${marker}\n`;
  if (readFileSync(probeFile, "utf8") !== expectedFinal) throw new Error("Claude handoff final workspace outcome mismatch");

  const expectedBashCommand = `printf '%s\\n' 'shell-${marker}'`;
  const expectedAgentPrompt = `Return exactly ${marker} as your entire final response.`;
  const agentUse = unique(toolUses.filter((entry) => entry.block?.name === "Agent" && String(entry.block?.input?.prompt ?? "").trim() === expectedAgentPrompt), "marker-bound Agent");
  const bashUse = unique(toolUses.filter((entry) => entry.block?.name === "Bash" && entry.block?.input?.command === expectedBashCommand), "marker-bound Bash");
  const editUse = unique(toolUses.filter((entry) => entry.block?.name === "Edit" &&
    exactProbePath(inputPath(entry.block?.input), probeFile) &&
    entry.block?.input?.old_string === `before-${marker}` && entry.block?.input?.new_string === `after-${marker}`), "marker-bound Edit");
  const readUses = toolUses.filter((entry) => entry.block?.name === "Read" && exactProbePath(inputPath(entry.block?.input), probeFile));
  if (readUses.length !== 2) throw new Error("Claude handoff requires exactly two marker-bound Read events");
  const agentResult = resultRecordFor(resultsById, agentUse.block.id, "Agent");
  const bashResult = resultRecordFor(resultsById, bashUse.block.id, "Bash");
  const editResult = resultRecordFor(resultsById, editUse.block.id, "Edit");
  const readPairs = readUses.map((use) => ({ use, result: resultRecordFor(resultsById, use.block.id, "Read") }));
  const readBefore = unique(readPairs.filter(({ result }) => contentText(result.block.content).includes(`before-${marker}`) && !contentText(result.block.content).includes(`after-${marker}`)), "before-marker Read");
  const readAfter = unique(readPairs.filter(({ result }) => contentText(result.block.content).includes(`after-${marker}`)), "after-marker Read");
  const selectedSequence = [agentUse, agentResult, bashUse, bashResult, readBefore.use, readBefore.result, editUse, editResult, readAfter.use, readAfter.result];
  if (new Set(selectedSequence.map((entry) => entry.lineNumber)).size !== selectedSequence.length ||
      selectedSequence.some((entry, index) => index > 0 && entry.lineNumber <= selectedSequence[index - 1].lineNumber)) {
    throw new Error("Claude handoff exact tool sequence is invalid");
  }
  const lifecycleUses = toolUses.filter((entry) => entry.lineNumber >= agentUse.lineNumber && entry.lineNumber <= readAfter.result.lineNumber);
  if (lifecycleUses.length !== 5 || JSON.stringify(lifecycleUses.map((entry) => entry.block.name)) !== JSON.stringify(["Agent", "Bash", "Read", "Edit", "Read"])) {
    throw new Error("Claude handoff tool sequence contains an unapproved or ambiguous tool action");
  }
  for (const entry of selectedSequence) requireProjectRecord(entry, resolvedProjectRoot, sessionId, sinceMs);
  for (const result of [agentResult, bashResult, readBefore.result, editResult, readAfter.result]) {
    if (resultFailed(result)) throw new Error("Claude handoff lifecycle contains a failed or declined tool result");
  }
  if (contentText(agentResult.block.content).trim() !== marker) throw new Error("Claude handoff subagent result is not the exact marker");
  if (contentText(bashResult.block.content).trim() !== `shell-${marker}`) throw new Error("Claude handoff shell result is not the exact marker");
  const childSessionId = safeIdentifier(
    agentResult.value?.toolUseResult?.agentId ?? agentResult.value?.toolUseResult?.agent_id,
    "Claude handoff child session id",
  );
  const versions = new Set(selectedSequence.map((entry) => String(entry.value?.version ?? "").trim()).filter(Boolean));
  if (versions.size !== 1) throw new Error("Claude handoff lifecycle has missing or inconsistent runtime versions");
  const observedAt = readAfter.result.value.timestamp;
  const markerDigest = sha256(marker);
  const lifecycleId = `${sessionId}:${markerDigest}`;
  const events = {
    agent: event({
      eventId: agentUse.block.id,
      family: "agent_subagent",
      hostSurface: "Agent",
      resultStatus: "accepted",
      input: agentUse.block.input,
      output: agentUse.rawLine,
      sessionId,
      childSessionId,
      sourceEntries: [agentUse],
      completionBoundary: "parent_agent_tool_accepted",
      facet: "agent",
    }),
    subagent: event({
      eventId: `${agentUse.block.id}:completed`,
      family: "agent_subagent",
      hostSurface: "Agent.result",
      resultStatus: "completed",
      input: { markerDigest, childSessionId },
      output: contentText(agentResult.block.content),
      sessionId: childSessionId,
      childSessionId,
      sourceEntries: [agentResult],
      completionBoundary: "child_exact_marker_returned",
      facet: "subagent",
    }),
    shell: event({
      eventId: bashUse.block.id,
      family: "runtime_tool",
      hostSurface: "Bash",
      resultStatus: "completed",
      input: bashUse.block.input,
      output: contentText(bashResult.block.content),
      sessionId,
      sourceEntries: [bashUse, bashResult],
      completionBoundary: "shell_exact_marker_returned",
      facet: "shell",
    }),
    filesystemBefore: event({
      eventId: readBefore.use.block.id,
      family: "runtime_tool",
      hostSurface: "Read",
      resultStatus: "completed",
      input: readBefore.use.block.input,
      output: contentText(readBefore.result.block.content),
      sessionId,
      sourceEntries: [readBefore.use, readBefore.result],
      completionBoundary: "before_marker_read",
      facet: "filesystem",
    }),
    edit: event({
      eventId: editUse.block.id,
      family: "runtime_tool",
      hostSurface: "Edit",
      resultStatus: "completed",
      input: editUse.block.input,
      output: contentText(editResult.block.content),
      sessionId,
      sourceEntries: [editUse, editResult],
      completionBoundary: "exact_marker_edit_completed",
      facet: "apply_patch / edit",
    }),
    filesystemAfter: event({
      eventId: readAfter.use.block.id,
      family: "runtime_tool",
      hostSurface: "Read",
      resultStatus: "completed",
      input: readAfter.use.block.input,
      output: contentText(readAfter.result.block.content),
      sessionId,
      sourceEntries: [readAfter.use, readAfter.result],
      completionBoundary: "after_marker_read",
      facet: "filesystem",
    }),
  };
  const eventOrder = [events.agent.eventId, events.subagent.eventId, events.shell.eventId, events.filesystemBefore.eventId, events.edit.eventId, events.filesystemAfter.eventId];
  const sessionRef = path.relative(projectsRoot, snapshot.real).replaceAll("\\", "/");
  const workspaceRef = path.relative(resolvedProjectRoot, resolvedWorkspace).replaceAll("\\", "/");
  const artifactWithoutHash = {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    sourceCategory: SOURCE_CATEGORY,
    capabilityMarker: marker,
    markerDigest,
    sessionId,
    childSessionId,
    cliVersion: [...versions][0],
    observedAt,
    lifecycleId,
    projectRootDigest: normalizedPathDigest(resolvedProjectRoot),
    workspaceDigest: normalizedPathDigest(resolvedWorkspace),
    workspaceRef,
    sourceSessionRef: sessionRef,
    sourceSessionSnapshotSize: snapshot.size,
    sourceSessionSnapshotSha256: snapshot.sha256,
    eventOrder,
    events: Object.values(events),
    retainedMessageOrToolContent: false,
  };
  const sanitizedArtifact = { ...artifactWithoutHash, recordHash: sha256(JSON.stringify(artifactWithoutHash)) };
  return {
    sourceCategory: SOURCE_CATEGORY,
    sessionId,
    childSessionId,
    markerDigest,
    observedAt,
    cliVersion: [...versions][0],
    lifecycleId,
    projectRootDigest: artifactWithoutHash.projectRootDigest,
    workspaceDigest: artifactWithoutHash.workspaceDigest,
    workspaceRef,
    sourceSessionRef: sessionRef,
    sourceSessionSnapshotSize: snapshot.size,
    sourceSessionSnapshotSha256: snapshot.sha256,
    sourceSessionLines: selectedSequence.map(lineBinding),
    beforeContentSha256: sha256(`before-${marker}\n`),
    finalContentSha256: sha256(expectedFinal),
    eventOrder,
    events,
    sanitizedArtifact,
  };
}

function readFailureCandidate({ candidate, projectRoot, profile, sessionId, marker, workspacePath, sinceMs, sessionSnapshotSize, projectsRoot }) {
  const snapshot = readStablePrefix(candidate, sessionSnapshotSize);
  const parsed = decodeJsonLines(snapshot.bytes);
  const toolUses = parsed.records.flatMap((entry) => toolBlocks(entry, "tool_use"));
  const toolResults = parsed.records.flatMap((entry) => toolBlocks(entry, "tool_result"));
  const resultsById = new Map();
  for (const result of toolResults) {
    const id = result.block?.tool_use_id;
    if (typeof id !== "string") continue;
    const matches = resultsById.get(id) ?? [];
    matches.push(result);
    resultsById.set(id, matches);
  }

  const resolvedProjectRoot = realpathSync.native(projectRoot);
  const resolvedWorkspace = realpathSync.native(workspacePath);
  const trustedWorkspaces = path.join(resolvedProjectRoot, ".meta-kim", "state", profile, "runtime-capability-producers", "workspaces");
  const realTrustedWorkspaces = assertPlainDirectory(trustedWorkspaces, "controlled producer workspaces root");
  if (!inside(resolvedWorkspace, realTrustedWorkspaces) || resolvedWorkspace === realTrustedWorkspaces) {
    throw new Error("Claude handoff workspace must be inside the controlled producer workspaces root");
  }
  const probeFile = assertPlainFile(path.join(resolvedWorkspace, "meta-kim-probe.txt"), "Claude handoff probe file");
  if (!inside(probeFile, resolvedWorkspace)) throw new Error("Claude handoff probe file escapes its controlled workspace");
  const expectedBefore = `before-${marker}\n`;
  if (readFileSync(probeFile, "utf8") !== expectedBefore) throw new Error("Claude failed handoff workspace must remain at the exact before marker");

  const expectedAgentPrompt = `Return exactly ${marker} as your entire final response.`;
  const markerBoundAgentUses = toolUses.filter((entry) => entry.block?.name === "Agent" && String(entry.block?.input?.prompt ?? "").trim() === expectedAgentPrompt);
  const notifications = parsed.records.map(taskNotification).filter(Boolean);
  const candidates = [];
  for (const agentUse of markerBoundAgentUses) {
    const matchingResults = resultsById.get(agentUse.block.id) ?? [];
    if (matchingResults.length !== 1) continue;
    const agentResult = matchingResults[0];
    const status = String(agentResult.value?.toolUseResult?.status ?? "").toLowerCase();
    if (resultFailed(agentResult) || status !== "async_launched") continue;
    const childSessionId = safeIdentifier(
      agentResult.value?.toolUseResult?.agentId ?? agentResult.value?.toolUseResult?.agent_id,
      "Claude failed handoff child session id",
    );
    const matchingNotifications = notifications.filter((notification) =>
      notification.entry.lineNumber > agentResult.lineNumber &&
      notification.taskId === childSessionId &&
      notification.toolUseId === agentUse.block.id &&
      notification.status === "failed" &&
      notification.failureText === OFFICIAL_CLI_ONLY_403_TEXT);
    if (matchingNotifications.length === 0) continue;
    candidates.push({ agentUse, agentResult, childSessionId, notifications: matchingNotifications });
  }
  const selected = unique(candidates, "launched Agent with terminal official-CLI-only 403");
  requireProjectRecord(selected.agentUse, resolvedProjectRoot, sessionId, sinceMs);
  requireProjectRecord(selected.agentResult, resolvedProjectRoot, sessionId, sinceMs);
  for (const notification of selected.notifications) {
    if (exactSessionId(notification.entry.value) !== sessionId) throw new Error("Claude failed handoff notification crosses session boundaries");
    const notificationTime = Date.parse(notification.entry.value?.timestamp ?? "");
    if (!Number.isFinite(notificationTime) || notificationTime < sinceMs) throw new Error("Claude failed handoff notification is outside the requested evidence window");
  }
  const projectBoundNotifications = selected.notifications.filter((notification) => {
    const cwd = notification.entry.value?.cwd;
    return typeof cwd === "string" && existsSync(cwd) && normalizedPathDigest(cwd) === normalizedPathDigest(resolvedProjectRoot);
  });
  if (projectBoundNotifications.length === 0) throw new Error("Claude failed handoff lacks a project-bound terminal notification");
  const laterToolUses = toolUses.filter((entry) => entry.lineNumber > selected.agentResult.lineNumber);
  if (laterToolUses.length > 0) throw new Error("Claude handoff executed a later tool after the failed Agent instead of stopping before step 2");

  const sourceEntries = [
    selected.agentUse,
    selected.agentResult,
    ...selected.notifications.map((notification) => notification.entry),
  ].filter((entry, index, entries) => entries.findIndex((candidateEntry) => candidateEntry.lineNumber === entry.lineNumber) === index)
    .sort((left, right) => left.lineNumber - right.lineNumber);
  const versions = new Set([selected.agentUse, selected.agentResult].map((entry) => String(entry.value?.version ?? "").trim()).filter(Boolean));
  if (versions.size !== 1) throw new Error("Claude failed handoff lifecycle has missing or inconsistent runtime versions");
  const observedAt = selected.notifications[0].entry.value.timestamp;
  const markerDigest = sha256(marker);
  const lifecycleId = `${sessionId}:${markerDigest}:agent-failure`;
  const sessionRef = path.relative(projectsRoot, snapshot.real).replaceAll("\\", "/");
  const workspaceRef = path.relative(resolvedProjectRoot, resolvedWorkspace).replaceAll("\\", "/");
  const sourceSessionLines = sourceEntries.map(lineBinding);
  const artifactWithoutHash = {
    schemaVersion: FAILURE_ARTIFACT_SCHEMA_VERSION,
    sourceCategory: FAILURE_SOURCE_CATEGORY,
    outcome: "fail",
    blockedFromRelease: true,
    failureClass: OFFICIAL_CLI_ONLY_403_FAILURE_CLASS,
    failureText: OFFICIAL_CLI_ONLY_403_TEXT,
    capabilityMarker: marker,
    markerDigest,
    runtime: "claude_code",
    capability: "agent",
    mode: "interactive_host",
    sessionId,
    childSessionId: selected.childSessionId,
    toolUseId: selected.agentUse.block.id,
    cliVersion: [...versions][0],
    observedAt,
    lifecycleId,
    projectRootDigest: normalizedPathDigest(resolvedProjectRoot),
    workspaceDigest: normalizedPathDigest(resolvedWorkspace),
    workspaceRef,
    sourceSessionRef: sessionRef,
    sourceSessionSnapshotSize: snapshot.size,
    sourceSessionSnapshotSha256: snapshot.sha256,
    sourceSessionLines,
    beforeContentSha256: sha256(expectedBefore),
    priorMarkerBoundAgentAttempts: markerBoundAgentUses.filter((entry) => entry.lineNumber < selected.agentUse.lineNumber).length,
    laterToolUseCount: laterToolUses.length,
    retainedMessageOrToolContent: false,
  };
  return {
    ...artifactWithoutHash,
    sanitizedArtifact: { ...artifactWithoutHash, recordHash: sha256(JSON.stringify(artifactWithoutHash)) },
  };
}

export function readClaudeInteractiveSessionEvidence({
  claudeHome = path.join(os.homedir(), ".claude"),
  projectRoot,
  profile = "default",
  sessionId,
  marker,
  workspacePath,
  sinceMs,
  sessionRef = null,
  sessionSnapshotSize = null,
} = {}) {
  if (!UUID_PATTERN.test(String(sessionId ?? ""))) throw new Error("Claude handoff session id must be a UUID");
  const markerMatch = String(marker ?? "").match(/^META_KIM_CAPABILITY_CLAUDE_HANDOFF_([0-9a-f-]{36})$/u);
  if (!markerMatch || !UUID_PATTERN.test(markerMatch[1])) throw new Error("Claude handoff marker is invalid");
  if (!Number.isFinite(sinceMs)) throw new Error("Claude handoff since timestamp is required");
  const resolvedProjectRoot = assertPlainDirectory(projectRoot, "Claude handoff project root");
  const resolvedWorkspace = assertPlainDirectory(workspacePath, "Claude handoff workspace");
  const projectsRoot = assertPlainDirectory(path.join(claudeHome, "projects"), "Claude projects root");
  const candidates = sessionCandidates(projectsRoot, sessionId, sessionRef);
  if (candidates.length === 0) throw new Error("Claude handoff session source was not found under the canonical projects root");
  if (sessionRef == null && candidates.length !== 1) throw new Error("Claude handoff session id is ambiguous across multiple project directories");
  const accepted = [];
  const failures = [];
  for (const candidate of candidates) {
    try {
      accepted.push(readCandidate({
        candidate,
        projectRoot: resolvedProjectRoot,
        profile,
        sessionId,
        marker,
        workspacePath: resolvedWorkspace,
        sinceMs,
        sessionSnapshotSize,
        projectsRoot,
      }));
    } catch (error) {
      failures.push(error);
    }
  }
  if (accepted.length !== 1) {
    if (accepted.length > 1) throw new Error("Claude handoff session source is ambiguous across project sessions");
    if (candidates.length === 1 && failures.length === 1) throw failures[0];
    throw new Error("Claude handoff session source does not contain one exact project-bound lifecycle");
  }
  return accepted[0];
}

export function readClaudeInteractiveSessionFailureObservation({
  claudeHome = path.join(os.homedir(), ".claude"),
  projectRoot,
  profile = "default",
  sessionId,
  marker,
  workspacePath,
  sinceMs,
  sessionRef = null,
  sessionSnapshotSize = null,
} = {}) {
  if (!UUID_PATTERN.test(String(sessionId ?? ""))) throw new Error("Claude failed handoff session id must be a UUID");
  const markerMatch = String(marker ?? "").match(/^META_KIM_CAPABILITY_CLAUDE_HANDOFF_([0-9a-f-]{36})$/u);
  if (!markerMatch || !UUID_PATTERN.test(markerMatch[1])) throw new Error("Claude failed handoff marker is invalid");
  if (!Number.isFinite(sinceMs)) throw new Error("Claude failed handoff since timestamp is required");
  const resolvedProjectRoot = assertPlainDirectory(projectRoot, "Claude failed handoff project root");
  const resolvedWorkspace = assertPlainDirectory(workspacePath, "Claude failed handoff workspace");
  const projectsRoot = assertPlainDirectory(path.join(claudeHome, "projects"), "Claude projects root");
  const candidates = sessionCandidates(projectsRoot, sessionId, sessionRef);
  if (candidates.length === 0) throw new Error("Claude failed handoff session source was not found under the canonical projects root");
  if (sessionRef == null && candidates.length !== 1) throw new Error("Claude failed handoff session id is ambiguous across multiple project directories");
  const accepted = [];
  const failures = [];
  for (const candidate of candidates) {
    try {
      accepted.push(readFailureCandidate({
        candidate,
        projectRoot: resolvedProjectRoot,
        profile,
        sessionId,
        marker,
        workspacePath: resolvedWorkspace,
        sinceMs,
        sessionSnapshotSize,
        projectsRoot,
      }));
    } catch (error) {
      failures.push(error);
    }
  }
  if (accepted.length !== 1) {
    if (accepted.length > 1) throw new Error("Claude failed handoff session source is ambiguous across project sessions");
    if (candidates.length === 1 && failures.length === 1) throw failures[0];
    throw new Error("Claude failed handoff session source does not contain one exact project-bound failure lifecycle");
  }
  return accepted[0];
}

export const CLAUDE_INTERACTIVE_SESSION_HANDOFF_SOURCE_CATEGORY = SOURCE_CATEGORY;
export const CLAUDE_INTERACTIVE_SESSION_HANDOFF_ARTIFACT_SCHEMA_VERSION = ARTIFACT_SCHEMA_VERSION;
export const CLAUDE_INTERACTIVE_SESSION_FAILURE_SOURCE_CATEGORY = FAILURE_SOURCE_CATEGORY;
export const CLAUDE_INTERACTIVE_SESSION_FAILURE_ARTIFACT_SCHEMA_VERSION = FAILURE_ARTIFACT_SCHEMA_VERSION;
export const CLAUDE_INTERACTIVE_SESSION_FAILURE_CLASS = OFFICIAL_CLI_ONLY_403_FAILURE_CLASS;
export const CLAUDE_INTERACTIVE_SESSION_FAILURE_TEXT = OFFICIAL_CLI_ONLY_403_TEXT;
