import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PROVIDER_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const TOP_LEVEL_STRING_KEYS = new Set(["model_provider", "model"]);
const PROVIDER_STRING_KEYS = new Set(["name", "base_url", "wire_api"]);

function fail() {
  throw new Error("Codex global live-provider configuration is missing or malformed");
}

function codeBeforeTomlComment(line = "") {
  let quote = null;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (quote === '"' && escaped) {
        escaped = false;
        continue;
      }
      if (quote === '"' && character === "\\") {
        escaped = true;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "#") return line.slice(0, index);
    if (character === '"' || character === "'") quote = character;
  }
  if (quote) fail();
  return line;
}

function parseTomlString(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "string") fail();
      return parsed;
    } catch {
      fail();
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && !value.slice(1, -1).includes("'")) {
    return value.slice(1, -1);
  }
  fail();
}

function setUnique(target, key, value) {
  if (target.has(key)) fail();
  target.set(key, value);
}

export function parseCodexLiveProviderConfig(configText = "") {
  const topLevel = new Map();
  const providers = new Map();
  const seenProviderSections = new Set();
  let section = null;

  for (const rawLine of String(configText).replace(/\r\n/gu, "\n").split("\n")) {
    const code = codeBeforeTomlComment(rawLine).trim();
    if (!code) continue;
    const header = code.match(/^\[([^\]]+)\]$/u);
    if (header) {
      const providerHeader = header[1].match(/^model_providers\.([A-Za-z0-9_-]+)$/u);
      if (!providerHeader) {
        section = { type: "other" };
        continue;
      }
      const providerId = providerHeader[1];
      if (!PROVIDER_ID_PATTERN.test(providerId) || seenProviderSections.has(providerId)) fail();
      seenProviderSections.add(providerId);
      if (!providers.has(providerId)) providers.set(providerId, new Map());
      section = { type: "provider", providerId };
      continue;
    }
    const assignment = code.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/u);
    if (!assignment) continue;
    const [, key, rawValue] = assignment;
    if (section === null && TOP_LEVEL_STRING_KEYS.has(key)) {
      setUnique(topLevel, key, parseTomlString(rawValue));
      continue;
    }
    if (section?.type !== "provider") continue;
    const provider = providers.get(section.providerId);
    if (PROVIDER_STRING_KEYS.has(key)) {
      setUnique(provider, key, parseTomlString(rawValue));
    } else if (key === "requires_openai_auth") {
      if (!/^(?:true|false)$/u.test(rawValue.trim())) fail();
      setUnique(provider, key, rawValue.trim() === "true");
    }
  }

  const providerId = topLevel.get("model_provider");
  const model = topLevel.get("model");
  if (!PROVIDER_ID_PATTERN.test(providerId ?? "") || typeof model !== "string" || !model.trim()) fail();
  const provider = providers.get(providerId);
  const name = provider?.get("name");
  const baseUrl = provider?.get("base_url");
  const wireApi = provider?.get("wire_api");
  if (typeof name !== "string" || !name.trim() || typeof baseUrl !== "string" || wireApi !== "responses") fail();
  if (provider.get("requires_openai_auth") !== true) fail();
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    fail();
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) fail();

  const selected = Object.freeze({ providerId, model, name, baseUrl, wireApi, requiresOpenAiAuth: true });
  return Object.freeze({
    selected,
    args: Object.freeze([
      "-c", `model=${JSON.stringify(model)}`,
      "-c", `model_provider=${JSON.stringify(providerId)}`,
      "-c", `model_providers.${providerId}.name=${JSON.stringify(name)}`,
      "-c", `model_providers.${providerId}.base_url=${JSON.stringify(baseUrl)}`,
      "-c", `model_providers.${providerId}.requires_openai_auth=true`,
      "-c", `model_providers.${providerId}.wire_api=${JSON.stringify(wireApi)}`,
    ]),
  });
}

function resolveRuntimeHome({ runtimeHome, homeDir, ambientEnv }) {
  const candidate = runtimeHome ?? ambientEnv?.CODEX_HOME ?? path.join(homeDir, ".codex");
  if (typeof candidate !== "string" || candidate.trim() !== candidate || !path.isAbsolute(candidate)) fail();
  const resolved = realpathSync.native(candidate);
  if (!lstatSync(resolved).isDirectory()) fail();
  return resolved;
}

export function resolveCodexLiveProviderConfigSync({
  runtimeHome,
  homeDir = os.homedir(),
  ambientEnv = process.env,
} = {}) {
  try {
    const sourceRuntimeHome = resolveRuntimeHome({ runtimeHome, homeDir, ambientEnv });
    const configPath = path.join(sourceRuntimeHome, "config.toml");
    const authPath = path.join(sourceRuntimeHome, "auth.json");
    if (!existsSync(configPath) || !lstatSync(configPath).isFile() || !existsSync(authPath) || !lstatSync(authPath).isFile()) fail();
    const configText = readFileSync(configPath, "utf8");
    const parsed = parseCodexLiveProviderConfig(configText);
    return Object.freeze({
      ...parsed,
      sourceRuntimeHome,
      configPath,
      authPath,
      configSha256: createHash("sha256").update(configText).digest("hex"),
    });
  } catch (error) {
    if (error?.message === "Codex global live-provider configuration is missing or malformed") throw error;
    fail();
  }
}

export function revalidateCodexLiveProviderConfigSync(binding) {
  const current = resolveCodexLiveProviderConfigSync({ runtimeHome: binding?.sourceRuntimeHome });
  if (
    current.configPath !== binding?.configPath ||
    current.authPath !== binding?.authPath ||
    current.configSha256 !== binding?.configSha256 ||
    JSON.stringify(current.selected) !== JSON.stringify(binding?.selected) ||
    JSON.stringify(current.args) !== JSON.stringify(binding?.args)
  ) fail();
  return current;
}
