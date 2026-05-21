import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";

const META_KIM_STATE_ROOT = ".meta-kim/state";
const DEFAULT_SPINE_STATE_DIR = ".meta-kim/state/default/spine";
const SPINE_STATE_FILE = "spine-state.json";
const ACTIVE_RUN_STATUS_FILE = "active-run.json";
const RUN_STATUS_FILE = "status.json";

export const STAGE_ORDER = [
  "critical",
  "fetch",
  "thinking",
  "execution",
  "review",
  "meta_review",
  "verification",
  "evolution",
];

export const STAGE_PUBLIC_LABELS = {
  critical: "Critical",
  fetch: "Fetch",
  thinking: "Thinking",
  execution: "Execution",
  review: "Review",
  meta_review: "Meta-Review",
  verification: "Verification",
  evolution: "Evolution",
};

const STAGE_PROGRESS_PERCENT = {
  critical: 12,
  fetch: 25,
  thinking: 38,
  execution: 50,
  review: 63,
  meta_review: 75,
  verification: 88,
  evolution: 100,
};

const STAGE_PUBLIC_PURPOSES = {
  "en-US": {
    critical:
      "checking whether governance is active and whether clarification is needed",
    fetch: "gathering capability, evidence, and constraint context",
    thinking: "comparing viable paths and shaping the execution plan",
    execution: "dispatching or applying the approved work",
    review: "checking output quality, risk, and boundary fit",
    meta_review: "checking whether the review standard itself was sufficient",
    verification: "confirming findings are closed and the result is usable",
    evolution: "deciding whether durable writeback is needed",
  },
  "zh-CN": {
    critical: "判断元治理是否已触发，以及是否需要先澄清",
    fetch: "正在收集能力、证据和约束",
    thinking: "正在比较可行方案并形成执行计划",
    execution: "正在派发或执行已确认的工作",
    review: "正在检查产出质量、风险和边界匹配",
    meta_review: "正在检查 Review 阶段本身是否足够可靠",
    verification: "正在确认问题是否闭环、结果是否可用",
    evolution: "正在判断是否需要写回长期规则或能力",
  },
};

export const STAGE_META_AGENT_MAP = {
  critical: {
    required: ["meta-warden"],
    label: "Critical (Warden scope clarification)",
  },
  fetch: {
    required: [],
    label: "Fetch (capability discovery)",
    requiresFetchRecord: true,
  },
  thinking: {
    required: ["meta-conductor"],
    label: "Thinking (Conductor dispatch board)",
    requiresFetchRecord: true,
  },
  execution: { required: [], label: "Execution", requiresAgentDispatch: true },
  review: {
    required: ["meta-prism"],
    label: "Review (Prism quality forensics)",
  },
  meta_review: {
    required: ["meta-warden"],
    label: "Meta-Review (Warden standards check)",
  },
  verification: {
    required: ["meta-warden"],
    label: "Verification (Warden closure)",
  },
  evolution: { required: [], label: "Evolution (writeback)" },
};

const META_AGENT_NAMES = [
  "meta-warden",
  "meta-conductor",
  "meta-genesis",
  "meta-artisan",
  "meta-sentinel",
  "meta-librarian",
  "meta-prism",
  "meta-scout",
];

function createRunId(timestamp = new Date().toISOString()) {
  return `meta-${timestamp.replace(/[:.]/g, "-")}`;
}

function isWithin(parent, target) {
  const rel = relative(parent, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function sanitizeStateProfile(input) {
  const value =
    typeof input === "string" && input.trim() ? input.trim() : "default";
  if (value === "." || value === ".." || value.length > 80) return "default";
  if (!/^[A-Za-z0-9._-]+$/.test(value)) return "default";
  return value;
}

export function resolveMetaKimStateRoot(cwd) {
  return resolve(cwd || process.cwd(), META_KIM_STATE_ROOT);
}

export function resolveRepoLocalStateDir(cwd, requestedPath, fallbackPath) {
  const repoRoot = resolve(cwd || process.cwd());
  const stateRoot = resolveMetaKimStateRoot(repoRoot);
  const fallback = resolve(repoRoot, fallbackPath || DEFAULT_SPINE_STATE_DIR);
  const raw =
    typeof requestedPath === "string" && requestedPath.trim()
      ? requestedPath.trim()
      : "";

  const candidate = raw
    ? resolve(isAbsolute(raw) ? raw : join(repoRoot, raw))
    : fallback;

  if (isWithin(stateRoot, candidate)) return candidate;
  return fallback;
}

export function resolveProfileStateDir(cwd, profile, ...segments) {
  const safeProfile = sanitizeStateProfile(profile);
  const stateRoot = resolveMetaKimStateRoot(cwd);
  const candidate = resolve(stateRoot, safeProfile, ...segments);
  if (!isWithin(stateRoot, candidate)) {
    return resolve(stateRoot, "default", ...segments);
  }
  return candidate;
}

export function extractMetaAgentName(description, prompt) {
  const text = `${description || ""} ${prompt || ""}`.toLowerCase();
  for (const name of META_AGENT_NAMES) {
    if (text.includes(name)) return name;
  }
  return null;
}

function spineStatePath(cwd) {
  return join(
    resolveRepoLocalStateDir(
      cwd,
      process.env.META_KIM_SPINE_STATE_DIR,
      DEFAULT_SPINE_STATE_DIR,
    ),
    SPINE_STATE_FILE,
  );
}

function ensureDir(filePath) {
  return mkdir(dirname(filePath), { recursive: true });
}

function normalizeStage(stageName) {
  if (typeof stageName !== "string") return "critical";
  const normalized = stageName.trim().toLowerCase().replace(/-/g, "_");
  return STAGE_ORDER.includes(normalized) ? normalized : "critical";
}

function profileFromState(state) {
  return sanitizeStateProfile(
    state?.profile || state?.stateProfile || process.env.META_KIM_STATE_PROFILE,
  );
}

function normalizeLocale(input) {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (raw.startsWith("zh")) return "zh-CN";
  return "en-US";
}

function localeFromState(state) {
  return normalizeLocale(
    state?.userLanguage ||
      state?.intentGatePacket?.userLanguage ||
      state?.locale ||
      process.env.META_KIM_LOCALE ||
      process.env.LANG,
  );
}

function runStatusPaths(cwd, profile, runId) {
  const profileDir = resolveProfileStateDir(cwd, profile);
  return {
    activeRun: join(profileDir, ACTIVE_RUN_STATUS_FILE),
    runStatus: join(profileDir, "runs", runId, RUN_STATUS_FILE),
  };
}

export async function readSpineState(cwd) {
  const filePath = spineStatePath(cwd);
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeSpineState(cwd, state) {
  const filePath = spineStatePath(cwd);
  await ensureDir(filePath);
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
  await writeMetaRunStatus(cwd, state);
}

export function createInitialState({ taskClassification, triggerReason }) {
  const triggeredAt = new Date().toISOString();
  return {
    active: true,
    version: 2,
    runId: createRunId(triggeredAt),
    triggeredAt,
    currentStage: "critical",
    stages: {
      critical: { status: "in_progress", completedAt: null },
      fetch: { status: "pending", completedAt: null },
      thinking: { status: "pending", completedAt: null },
      execution: { status: "pending", completedAt: null },
      review: { status: "pending", completedAt: null },
      meta_review: { status: "pending", completedAt: null },
      verification: { status: "pending", completedAt: null },
      evolution: { status: "pending", completedAt: null },
    },
    taskClassification: taskClassification || null,
    triggerReason: triggerReason || "user_invocation",
    dispatchedAgents: [],
    dispatchChain: {},
    queryBypass: false,
    executionStarted: false,
    // Simple mode: allows hook skipping for lightweight tasks
    simpleMode: false,
    // Audit trail for skipped hooks
    skippedHooks: [],
  };
}

export function createMetaRunStatusEnvelope(state, options = {}) {
  const currentStage = normalizeStage(
    options.currentStage || state?.currentStage || "critical",
  );
  const stageIndex = STAGE_ORDER.indexOf(currentStage) + 1;
  const stageTotal = STAGE_ORDER.length;
  const stages = state?.stages || {};
  const completed = STAGE_ORDER.filter(
    (stage) => stages?.[stage]?.status === "completed",
  ).map((stage) => STAGE_PUBLIC_LABELS[stage]);
  const nextStage =
    stageIndex < stageTotal ? STAGE_ORDER[stageIndex] : null;
  const startedAt =
    state?.triggeredAt || state?.startedAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const runId = state?.runId || createRunId(startedAt);
  const locale = options.locale
    ? normalizeLocale(options.locale)
    : localeFromState(state);
  const stagePurposeByLocale = Object.fromEntries(
    Object.entries(STAGE_PUBLIC_PURPOSES).map(([localeKey, table]) => [
      localeKey,
      table[currentStage],
    ]),
  );

  return {
    schemaVersion: 1,
    active: state?.active !== false,
    runId,
    triggeredBy:
      state?.triggerReason || state?.triggeredBy || "meta-theory",
    currentStage: STAGE_PUBLIC_LABELS[currentStage],
    currentStageKey: currentStage,
    stageIndex,
    stageTotal,
    percent: STAGE_PROGRESS_PERCENT[currentStage],
    completed,
    next: nextStage ? STAGE_PUBLIC_LABELS[nextStage] : null,
    blockedOn: state?.blockedOn || null,
    startedAt,
    updatedAt,
    lastUserVisibleNotice: state?.lastUserVisibleNotice || null,
    surfaceMode: "public",
    locale,
    languageSource:
      state?.userLanguage || state?.intentGatePacket?.userLanguage
        ? "state"
        : "environment_or_default",
    publicSurface: {
      primaryDisplay: "conversation_notice",
      nativeEnhancementAllowed: true,
      popupRequired: false,
      hiddenInternalFields: [
        "Preflight",
        "nativeChoiceSurface",
        "conversation_fallback",
        "packet_id",
        "protocol_trace",
      ],
    },
    stagePurpose: stagePurposeByLocale[locale] || stagePurposeByLocale["en-US"],
    stagePurposeByLocale,
  };
}

export async function writeMetaRunStatus(cwd, state, options = {}) {
  if (!state || typeof state !== "object") return null;
  const envelope = createMetaRunStatusEnvelope(state, options);
  const profile = profileFromState(state);
  const paths = runStatusPaths(cwd, profile, envelope.runId);
  await ensureDir(paths.activeRun);
  await ensureDir(paths.runStatus);
  const serialized = JSON.stringify(envelope, null, 2);
  await Promise.all([
    writeFile(paths.activeRun, serialized, "utf-8"),
    writeFile(paths.runStatus, serialized, "utf-8"),
  ]);
  return envelope;
}

export async function readMetaRunStatus(cwd, profile) {
  const filePath = runStatusPaths(cwd, sanitizeStateProfile(profile), "latest")
    .activeRun;
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function advanceStage(state, stageName) {
  const stageOrder = STAGE_ORDER;

  const idx = stageOrder.indexOf(stageName);
  if (idx === -1) return state;

  const newState = { ...state };

  for (let i = 0; i < idx; i++) {
    const prev = stageOrder[i];
    if (newState.stages[prev].status !== "completed") {
      newState.stages[prev] = {
        status: "completed",
        completedAt: new Date().toISOString(),
        autoCompleted: true,
        reason: `Advanced past by stage ${stageName}`,
      };
    }
  }

  newState.stages[stageName] = {
    status: "in_progress",
    completedAt: null,
    startedAt: new Date().toISOString(),
  };
  newState.currentStage = stageName;

  if (stageName === "execution") {
    newState.executionStarted = true;
  }

  return newState;
}

export function completeStage(state, stageName) {
  if (!state.stages[stageName]) return state;
  const newState = { ...state };
  newState.stages[stageName] = {
    status: "completed",
    completedAt: new Date().toISOString(),
  };

  const stageOrder = STAGE_ORDER;
  const idx = stageOrder.indexOf(stageName);
  if (idx < stageOrder.length - 1) {
    const nextStage = stageOrder[idx + 1];
    newState.currentStage = nextStage;
    newState.stages[nextStage] = {
      status: "in_progress",
      startedAt: new Date().toISOString(),
    };
  }

  return newState;
}

export function recordDispatch(state, agentName, metaAgentName) {
  const newState = { ...state };
  if (!newState.dispatchedAgents.includes(agentName)) {
    newState.dispatchedAgents = [...newState.dispatchedAgents, agentName];
  }

  if (metaAgentName) {
    const chain = { ...newState.dispatchChain };
    const stage = newState.currentStage;
    if (!chain[stage]) chain[stage] = [];
    if (!chain[stage].includes(metaAgentName)) {
      chain[stage] = [...chain[stage], metaAgentName];
    }
    newState.dispatchChain = chain;
  }

  return newState;
}

export function checkStageRequirements(state) {
  const stage = state.currentStage;
  const req = STAGE_META_AGENT_MAP[stage];
  if (!req) return { met: true, missing: [], reason: "no requirements" };

  const chain = state.dispatchChain || {};
  const dispatched = chain[stage] || [];

  const missing = req.required.filter((a) => !dispatched.includes(a));

  if (req.requiresAgentDispatch && state.dispatchedAgents.length === 0) {
    return {
      met: false,
      missing: ["at least one agent via Agent tool"],
      reason: `Stage "${stage}" requires at least one agent dispatch before execution.`,
    };
  }

  // Verify fetchRecord exists when stage requires it
  if (req.requiresFetchRecord && !state.fetchRecord) {
    return {
      met: false,
      missing: ["fetchRecord in spine state"],
      reason:
        "Fetch stage must produce a fetchRecord before advancing to Thinking. " +
        "Complete capability search, write fetchRecord to spine state, then return to Thinking.",
    };
  }

  // Verify research validation when fetchRecord declares research required
  if (
    state.fetchRecord &&
    state.fetchRecord.researchRequired &&
    !state.fetchRecord.researchValidationPerformed
  ) {
    return {
      met: false,
      missing: ["research validation in fetchRecord"],
      reason:
        "Task requires research validation but researchValidationPerformed=false. " +
        "Discover web search tools via capability descriptors, search ≥5 source categories, " +
        "record in fetchRecord, then return to Thinking.",
    };
  }

  return {
    met: missing.length === 0,
    missing,
    reason:
      missing.length > 0
        ? `Stage "${stage}" requires meta-agent(s): ${missing.join(", ")}. Dispatch them via Agent tool first.`
        : "requirements met",
  };
}

export function setQueryBypass(state, bypass) {
  return { ...state, queryBypass: bypass };
}

export function deactivateState(state) {
  return {
    ...state,
    active: false,
    deactivatedAt: new Date().toISOString(),
  };
}

export function isExecutionTool(toolName) {
  const execTools = ["Write", "Edit", "Bash", "MultiEdit", "NotebookEdit"];
  return execTools.includes(toolName);
}

export function isReadOnlyTool(toolName) {
  const readOnlyTools = [
    "Read",
    "Glob",
    "Grep",
    "LSPO",
    "TaskList",
    "TaskGet",
    "TaskOutput",
    "WebFetch",
    "WebSearch",
    "ListMcpResourcesTool",
    "ReadMcpResourceTool",
  ];
  return readOnlyTools.includes(toolName);
}

/**
 * Enable or disable simple mode in spine state
 * Simple mode allows selective hook skipping for lightweight tasks
 */
export function setSimpleMode(state, enabled) {
  return { ...state, simpleMode: !!enabled };
}

/**
 * Record a skipped hook to the audit trail
 * @param {object} state - Current spine state
 * @param {string} hookName - Name of the hook being skipped
 * @param {string} reason - Why the hook was skipped
 * @returns {object} - Updated state with skip record added
 */
export function recordSkippedHook(state, hookName, reason) {
  const record = {
    hook: hookName,
    reason,
    timestamp: new Date().toISOString(),
  };

  return {
    ...state,
    skippedHooks: [...(state.skippedHooks || []), record],
  };
}

/**
 * Get the current governance flow from task classification
 * Maps task classification to governance flow for hook skip decisions
 */
export function getGovernanceFlow(state) {
  const tc = state?.taskClassification;

  // Direct mapping from common classifications to governance flows
  const flowMap = {
    query: "query",
    simple_exec: "simple_exec",
    complex_dev: "complex_dev",
    meta_theory_auto: "complex_dev", // meta-theory is always complex
  };

  return flowMap[tc] || "simple_exec"; // Default to simple_exec
}
