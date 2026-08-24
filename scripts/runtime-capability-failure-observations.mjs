import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  prepareRuntimeCapabilityAcceptanceStore,
  resolveRuntimeCapabilityAcceptancePaths,
} from "./runtime-capability-acceptance.mjs";
import {
  CLAUDE_INTERACTIVE_SESSION_FAILURE_ARTIFACT_SCHEMA_VERSION,
  CLAUDE_INTERACTIVE_SESSION_FAILURE_CLASS,
  CLAUDE_INTERACTIVE_SESSION_FAILURE_SOURCE_CATEGORY,
  CLAUDE_INTERACTIVE_SESSION_FAILURE_TEXT,
} from "./live-acceptance/read-claude-session-evidence.mjs";

export const RUNTIME_CAPABILITY_FAILURE_OBSERVATION_SCHEMA_VERSION = "meta-kim-runtime-capability-failure-observation-v1";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function inside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
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

function writeImmutable(filePath, bytes) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  if (existsSync(filePath)) {
    const existing = readFileSync(assertPlainFile(filePath, "runtime capability failure observation target"));
    if (!existing.equals(bytes)) throw new Error("runtime capability failure observation target already exists with different bytes");
    return;
  }
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(handle, bytes);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  try {
    renameSync(temporary, filePath);
  } catch (error) {
    try { unlinkSync(temporary); } catch {}
    throw error;
  }
}

function recordHash(record) {
  const { recordHash: ignored, ...withoutHash } = record;
  return sha256(JSON.stringify(withoutHash));
}

function validateObservationShape(observation) {
  if (
    observation?.schemaVersion !== RUNTIME_CAPABILITY_FAILURE_OBSERVATION_SCHEMA_VERSION ||
    observation?.attestationAuthority !== "controlled_producer" ||
    observation?.runtime !== "claude_code" ||
    observation?.capability !== "agent" ||
    observation?.mode !== "interactive_host" ||
    observation?.outcome !== "fail" ||
    observation?.blockedFromRelease !== true ||
    observation?.acceptanceWritten !== false ||
    observation?.failureClass !== CLAUDE_INTERACTIVE_SESSION_FAILURE_CLASS ||
    observation?.failureText !== CLAUDE_INTERACTIVE_SESSION_FAILURE_TEXT ||
    observation?.sourceCategory !== CLAUDE_INTERACTIVE_SESSION_FAILURE_SOURCE_CATEGORY ||
    typeof observation?.observationId !== "string" ||
    typeof observation?.recordHash !== "string" ||
    observation.recordHash !== recordHash(observation)
  ) throw new Error("runtime capability failure observation shape or record hash is invalid");
}

function validateRawArtifact(observation, profileRoot) {
  const relativePath = observation?.rawArtifact?.path;
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error("runtime capability failure observation artifact path is invalid");
  }
  const candidate = path.resolve(profileRoot, ...relativePath.split("/"));
  if (!inside(candidate, profileRoot)) throw new Error("runtime capability failure observation artifact escapes the profile root");
  const real = assertPlainFile(candidate, "runtime capability failure observation artifact");
  const bytes = readFileSync(real);
  if (sha256(bytes) !== observation.rawArtifact.sha256) throw new Error("runtime capability failure observation artifact SHA-256 mismatch");
  const artifact = JSON.parse(bytes.toString("utf8"));
  const { recordHash: artifactRecordHash, ...artifactWithoutHash } = artifact;
  if (
    artifact.schemaVersion !== CLAUDE_INTERACTIVE_SESSION_FAILURE_ARTIFACT_SCHEMA_VERSION ||
    artifact.sourceCategory !== observation.sourceCategory ||
    artifact.outcome !== "fail" ||
    artifact.blockedFromRelease !== true ||
    artifact.failureClass !== observation.failureClass ||
    artifact.failureText !== observation.failureText ||
    artifact.sessionId !== observation.sessionId ||
    artifact.childSessionId !== observation.childSessionId ||
    artifact.lifecycleId !== observation.lifecycleId ||
    artifactRecordHash !== sha256(JSON.stringify(artifactWithoutHash))
  ) throw new Error("runtime capability failure observation artifact binding is invalid");
  return { real, artifact };
}

export function writeRuntimeCapabilityFailureObservation({
  projectRoot,
  profile,
  producer,
  evidence,
  testOnly = false,
} = {}) {
  if (
    evidence?.outcome !== "fail" ||
    evidence?.blockedFromRelease !== true ||
    evidence?.failureClass !== CLAUDE_INTERACTIVE_SESSION_FAILURE_CLASS ||
    evidence?.failureText !== CLAUDE_INTERACTIVE_SESSION_FAILURE_TEXT ||
    evidence?.sourceCategory !== CLAUDE_INTERACTIVE_SESSION_FAILURE_SOURCE_CATEGORY ||
    evidence?.sanitizedArtifact?.schemaVersion !== CLAUDE_INTERACTIVE_SESSION_FAILURE_ARTIFACT_SCHEMA_VERSION
  ) throw new Error("unsupported runtime capability failure evidence");
  const paths = prepareRuntimeCapabilityAcceptanceStore({ projectRoot, profile });
  const producerRoot = path.join(paths.profileRoot, "runtime-capability-producers");
  const failureRoot = path.join(producerRoot, "failure-observations");
  const artifactsRoot = path.join(producerRoot, "artifacts");
  mkdirSync(failureRoot, { recursive: true });
  mkdirSync(artifactsRoot, { recursive: true });
  const identityDigest = sha256(JSON.stringify({
    sourceCategory: evidence.sourceCategory,
    sessionId: evidence.sessionId,
    childSessionId: evidence.childSessionId,
    lifecycleId: evidence.lifecycleId,
    sourceSessionSnapshotSha256: evidence.sourceSessionSnapshotSha256,
    sourceSessionLines: evidence.sourceSessionLines,
  }));
  const observationId = `claude-agent-failure-${identityDigest.slice(0, 32)}`;
  const rawPath = path.join(artifactsRoot, `${observationId}.json`);
  const rawBytes = Buffer.from(`${JSON.stringify(evidence.sanitizedArtifact, null, 2)}\n`, "utf8");
  const observationWithoutHash = {
    schemaVersion: RUNTIME_CAPABILITY_FAILURE_OBSERVATION_SCHEMA_VERSION,
    observationId,
    attestationAuthority: "controlled_producer",
    producer,
    testOnly: testOnly === true,
    runtime: "claude_code",
    capability: "agent",
    mode: "interactive_host",
    observedAt: evidence.observedAt,
    outcome: "fail",
    blockedFromRelease: true,
    failureClass: evidence.failureClass,
    failureText: evidence.failureText,
    sourceCategory: evidence.sourceCategory,
    sessionId: evidence.sessionId,
    childSessionId: evidence.childSessionId,
    lifecycleId: evidence.lifecycleId,
    markerDigest: evidence.markerDigest,
    sourceSessionRef: evidence.sourceSessionRef,
    sourceSessionSnapshotSize: evidence.sourceSessionSnapshotSize,
    sourceSessionSnapshotSha256: evidence.sourceSessionSnapshotSha256,
    sourceSessionLines: evidence.sourceSessionLines,
    workspaceRef: evidence.workspaceRef,
    workspaceOutcome: {
      kind: "bounded_file",
      state: "before",
      contentSha256: evidence.beforeContentSha256,
    },
    priorMarkerBoundAgentAttempts: evidence.priorMarkerBoundAgentAttempts,
    laterToolUseCount: evidence.laterToolUseCount,
    rawArtifact: {
      path: path.relative(paths.profileRoot, rawPath).replaceAll("\\", "/"),
      sha256: sha256(rawBytes),
    },
    acceptanceWritten: false,
  };
  const observation = { ...observationWithoutHash, recordHash: sha256(JSON.stringify(observationWithoutHash)) };
  const observationPath = path.join(failureRoot, `${observationId}.json`);
  writeImmutable(rawPath, rawBytes);
  writeImmutable(observationPath, Buffer.from(`${JSON.stringify(observation, null, 2)}\n`, "utf8"));
  return { paths, rawPath, observationPath, observation };
}

export function loadRuntimeCapabilityFailureObservations({ projectRoot, profile = process.env.META_KIM_PROFILE || "default" } = {}) {
  const paths = resolveRuntimeCapabilityAcceptancePaths({ projectRoot, profile });
  const failureRoot = path.join(paths.profileRoot, "runtime-capability-producers", "failure-observations");
  if (!existsSync(failureRoot)) return { paths: { ...paths, failureRoot }, observations: [] };
  const realProfileRoot = assertPlainDirectory(paths.profileRoot, "runtime capability profile state root");
  const realFailureRoot = assertPlainDirectory(failureRoot, "runtime capability failure observations root");
  if (!inside(realFailureRoot, realProfileRoot)) throw new Error("runtime capability failure observations escape the profile root");
  const observations = [];
  for (const entry of readdirSync(realFailureRoot, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) continue;
    const filePath = assertPlainFile(path.join(realFailureRoot, entry.name), "runtime capability failure observation");
    const observation = JSON.parse(readFileSync(filePath, "utf8"));
    validateObservationShape(observation);
    validateRawArtifact(observation, realProfileRoot);
    observations.push(observation);
  }
  return { paths: { ...paths, failureRoot: realFailureRoot }, observations };
}

export function runtimeCapabilityFailureRemediation(observations = []) {
  const officialCliOnlyFailure = observations.some((entry) =>
    entry?.outcome === "fail" &&
    entry?.blockedFromRelease === true &&
    entry?.failureClass === CLAUDE_INTERACTIVE_SESSION_FAILURE_CLASS
  );
  if (!officialCliOnlyFailure) return null;
  return "Do not retry the Claude Agent handoff unchanged: the gateway_403_official_cli_only failure is already recorded. Keep this capability missing and the release blocked until a different approved evidence path succeeds.";
}
