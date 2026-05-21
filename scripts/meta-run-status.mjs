#!/usr/bin/env node

import process from "node:process";
import { readMetaRunStatus } from "../canonical/runtime-assets/shared/hooks/spine-state.mjs";

const args = new Set(process.argv.slice(2));
const json = args.has("--json");
const profileArg = process.argv.find((arg) => arg.startsWith("--profile="));
const localeArg = process.argv.find((arg) => arg.startsWith("--locale="));
const profile =
  profileArg?.slice("--profile=".length) || process.env.META_KIM_STATE_PROFILE;
const locale = normalizeLocale(
  localeArg?.slice("--locale=".length) ||
    process.env.META_KIM_LOCALE ||
    process.env.LANG,
);

function normalizeLocale(input) {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (raw.startsWith("zh")) return "zh-CN";
  return "en-US";
}

const LABELS = {
  "en-US": {
    inactive: "Meta governance status: inactive",
    active: "Meta governance active",
    completed: "Completed",
    current: "Current",
    next: "Next",
    blocked: "Blocked",
    none: "none",
  },
  "zh-CN": {
    inactive: "元治理状态：未运行",
    active: "元治理已触发",
    completed: "已完成",
    current: "当前",
    next: "下一步",
    blocked: "阻塞",
    none: "无",
  },
};

const status = await readMetaRunStatus(process.cwd(), profile);

if (json) {
  console.log(JSON.stringify(status || null, null, 2));
  process.exit(0);
}

if (!status) {
  console.log(LABELS[locale].inactive);
  process.exit(0);
}

const labels = LABELS[locale];
const completed = status.completed?.length
  ? status.completed.join(", ")
  : labels.none;
const stagePurpose =
  status.stagePurposeByLocale?.[locale] || status.stagePurpose || labels.none;

console.log(
  [
    `${labels.active}: ${status.currentStage} (${status.stageIndex}/${status.stageTotal}, ${status.percent}%)`,
    `${labels.completed}: ${completed}`,
    `${labels.current}: ${stagePurpose}`,
    `${labels.next}: ${status.next || labels.none}`,
    `${labels.blocked}: ${status.blockedOn || labels.none}`,
  ].join("\n"),
);
