import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

async function readJsonIfExists(filePath) {
  try {
    return {
      exists: true,
      valid: true,
      value: JSON.parse(await fs.readFile(filePath, "utf8")),
    };
  } catch (error) {
    return {
      exists: error?.code !== "ENOENT",
      valid: error?.code === "ENOENT",
      value: null,
    };
  }
}

function pluginRecords(value) {
  if (Array.isArray(value)) return value;
  return value && typeof value === "object" ? [value] : [];
}

function scalarFrontmatterValue(frontmatter, key) {
  const match = frontmatter.match(
    new RegExp(`^${key}:\\s*(.+)$`, "mu"),
  );
  if (!match) return null;
  const value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim() || null;
  }
  return value || null;
}

export function parseClaudeAgentDefinition(content, inventoryId) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1] ?? "";
  const declaredName = scalarFrontmatterValue(frontmatter, "name");
  const metadata = {
    name: declaredName,
    displayName: declaredName ?? inventoryId,
    description: scalarFrontmatterValue(frontmatter, "description"),
  };
  const errors = [
    ...(!declaredName ? ["missing_name"] : []),
    ...(!metadata.description ? ["missing_description"] : []),
  ];
  return { metadata, errors };
}

function normalizedPluginName(pluginId) {
  return String(pluginId ?? "").split("@")[0].trim();
}

function sameFilesystemPath(left, right) {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function isFilesystemDescendant(candidate, root) {
  const relative = path.relative(root, candidate);
  return Boolean(relative) &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

async function verifiedPluginRoot(record, pluginId, claudeHome) {
  const configuredPath = record?.installPath ?? record?.path;
  if (typeof configuredPath !== "string" || !configuredPath.trim()) return null;
  const pluginRoot = path.isAbsolute(configuredPath)
    ? path.resolve(configuredPath)
    : path.resolve(claudeHome, configuredPath);
  try {
    const canonicalPluginsRoot = await fs.realpath(path.resolve(claudeHome, "plugins"));
    const rootStat = await fs.lstat(pluginRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return null;
    const canonicalPluginRoot = await fs.realpath(pluginRoot);
    if (!sameFilesystemPath(canonicalPluginRoot, pluginRoot)) return null;
    if (!isFilesystemDescendant(canonicalPluginRoot, canonicalPluginsRoot)) return null;
    const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
    const manifestStat = await fs.lstat(manifestPath);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) return null;
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest?.name !== normalizedPluginName(pluginId)) return null;
    return { pluginRoot, manifest };
  } catch {
    return null;
  }
}

function sourceReference(claudeHome, pluginId, pluginRoot, agentPath) {
  const relativeToHome = path.relative(claudeHome, agentPath);
  const withinClaudeHome =
    relativeToHome &&
    !relativeToHome.startsWith(`..${path.sep}`) &&
    relativeToHome !== ".." &&
    !path.isAbsolute(relativeToHome);
  if (withinClaudeHome) {
    return {
      sourceRoot: `~/.claude/${path.relative(claudeHome, pluginRoot).replace(/\\/gu, "/")}`,
      sourceRef: `~/.claude/${relativeToHome.replace(/\\/gu, "/")}`,
    };
  }
  const fileName = path.basename(agentPath);
  return {
    sourceRoot: `claude-plugin:${pluginId}`,
    sourceRef: `claude-plugin:${pluginId}/agents/${fileName}`,
  };
}

export async function scanInstalledClaudePluginAgents(claudeHome) {
  const pluginsDir = path.join(claudeHome, "plugins");
  const [installedPluginsResult, settingsResult] = await Promise.all([
    readJsonIfExists(path.join(pluginsDir, "installed_plugins.json")),
    readJsonIfExists(path.join(claudeHome, "settings.json")),
  ]);
  const settings = settingsResult.value;
  const enabledPlugins = settings?.enabledPlugins;
  if (
    !installedPluginsResult.valid ||
    !settingsResult.exists ||
    !settingsResult.valid ||
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings) ||
    !enabledPlugins ||
    typeof enabledPlugins !== "object" ||
    Array.isArray(enabledPlugins)
  ) {
    return [];
  }
  const installedPlugins = installedPluginsResult.value;
  const discovered = [];

  for (const [pluginId, value] of Object.entries(installedPlugins?.plugins ?? {}).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (enabledPlugins[pluginId] !== true) continue;
    for (const record of pluginRecords(value)) {
      if (record?.scope !== "user") continue;
      const verified = await verifiedPluginRoot(record, pluginId, claudeHome);
      if (!verified) continue;
      const agentsDir = path.join(verified.pluginRoot, "agents");
      let entries;
      try {
        const agentsStat = await fs.lstat(agentsDir);
        if (!agentsStat.isDirectory() || agentsStat.isSymbolicLink()) continue;
        entries = await fs.readdir(agentsDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const agentPath = path.join(agentsDir, entry.name);
        let content;
        let stat;
        try {
          stat = await fs.lstat(agentPath);
          if (!stat.isFile() || stat.isSymbolicLink()) continue;
          content = await fs.readFile(agentPath, "utf8");
        } catch {
          continue;
        }
        const inventoryId = path.basename(entry.name, ".md");
        const { metadata, errors } = parseClaudeAgentDefinition(content, inventoryId);
        const id = metadata.name ?? inventoryId;
        const refs = sourceReference(
          claudeHome,
          pluginId,
          verified.pluginRoot,
          agentPath,
        );
        discovered.push({
          id,
          inventoryId,
          path: agentPath,
          relativePath: `plugins/${pluginId}/agents/${entry.name}`,
          size: stat.size,
          modified: stat.mtime,
          metadata: {
            ...metadata,
            version: record.version ?? verified.manifest.version ?? null,
            source: `claude-plugin:${pluginId}`,
            providerKind: "claude-plugin-agent",
            nativeAgentName: id,
            validCustomAgentDefinition: errors.length === 0,
            customAgentDefinitionErrors: errors,
          },
          nativeAgentName: id,
          validCustomAgentDefinition: errors.length === 0,
          customAgentDefinitionErrors: errors,
          contentDigest: createHash("sha256").update(content).digest("hex"),
          sourceClass: "plugin",
          sourcePriority: 150,
          executionBlock: true,
          routeEligible: false,
          trustRequired: true,
          trustReview: "third_party_plugin",
          trustReviewStatus: "trust_review_required",
          trustReviewReason: "third_party_plugins_require_trust_review_before_execution",
          trustAdmissionRecord: null,
          ...refs,
          sourceKey: `claudeCode:agents:${id}:plugin:${refs.sourceRef}`,
        });
      }
    }
  }

  return discovered;
}
