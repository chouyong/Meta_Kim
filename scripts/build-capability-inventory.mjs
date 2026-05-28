#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { listFiles, readJson, repoPath, stateDir, toPosix, writeJson } from "./governance-lib.mjs";

const outputPath = path.join(stateDir, "capability-inventory.json");

async function packageScripts() {
  const pkg = await readJson("package.json");
  return Object.entries(pkg.scripts ?? {}).map(([id, command]) => ({ id, type: "package_script", command }));
}

async function inventory() {
  const agents = (await listFiles(repoPath("canonical/agents"), (file) => file.endsWith(".md"))).map((file) => ({
    id: path.basename(file, ".md"),
    path: toPosix(path.relative(repoPath("."), file)),
  }));
  const skills = (await listFiles(repoPath("canonical/skills"), (file) => path.basename(file) === "SKILL.md")).map((file) => ({
    id: path.basename(path.dirname(file)),
    path: toPosix(path.relative(repoPath("."), file)),
  }));
  const scripts = (await listFiles(repoPath("scripts"), (file) => file.endsWith(".mjs"))).map((file) => ({
    id: path.basename(file),
    path: toPosix(path.relative(repoPath("."), file)),
  }));
  const hooks = (await listFiles(repoPath("canonical/runtime-assets"), (file) => file.includes(`${path.sep}hooks${path.sep}`) && /\.(mjs|ts|js)$/.test(file))).map((file) => ({
    id: path.basename(file),
    path: toPosix(path.relative(repoPath("."), file)),
  }));
  const mcp = {
    project: JSON.parse(await fs.readFile(repoPath(".mcp.json"), "utf8")),
    codexConfigToml: await fs.readFile(repoPath(".codex/config.toml"), "utf8").catch(() => ""),
  };
  const dependencies = await readJson("config/capability-index/dependency-project-registry.json");
  const weapons = await readJson("config/capability-index/weapon-registry.json");
  return {
    generatedAt: new Date().toISOString(),
    owners: agents,
    skills,
    commands: await packageScripts(),
    MCPs: mcp,
    hooks,
    scripts,
    prompts: skills,
    runtimeTools: ["shell", "filesystem", "apply_patch", "browser", "web", "multi_agent"],
    graphMemoryTools: ["graphify", "MCP Memory Service", "meta-kim-runtime MCP"],
    dependencyProjects: dependencies.projects,
    weapons: weapons.weapons,
    missingCapabilityMetadata: weapons.weapons.filter((weapon) => !weapon.ownerCandidates?.length || !weapon.verification?.passCondition).map((weapon) => weapon.id),
  };
}

const result = await inventory();
await writeJson(outputPath, result);
console.log(JSON.stringify(result, null, 2));
