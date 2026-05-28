#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { exists, readJson, repoPath, stateDir, toPosix, writeJson } from "./governance-lib.mjs";

const args = process.argv.slice(2);
const json = args.includes("--json");
const checkMode = args.includes("--check");
const projectArgIndex = args.indexOf("--project");
const projectFilter = projectArgIndex >= 0 ? args[projectArgIndex + 1] : null;
const outputPath = path.join(stateDir, "dependency-capability-index.json");

async function localProjectStatus(project) {
  const localPath = project.source?.localPath;
  if (!localPath) return project.source?.inspectionStatus ?? "external_reference";
  return (await exists(localPath)) ? project.source.inspectionStatus : "missing";
}

async function discoverFromSkillsManifest() {
  const manifest = await readJson("config/skills.json");
  return (manifest.skills ?? []).map((skill) => ({
    id: skill.id,
    repo: skill.repo ?? skill.upstreamPackage ?? skill.claudePlugin ?? null,
    targets: skill.targets ?? [],
    source: "config/skills.json",
  }));
}

async function discover() {
  const registry = await readJson("config/capability-index/dependency-project-registry.json");
  const skills = await discoverFromSkillsManifest();
  const projects = [];
  for (const project of registry.projects ?? []) {
    if (projectFilter && !project.name.toLowerCase().includes(projectFilter.toLowerCase()) && project.id !== projectFilter) {
      continue;
    }
    const inspectionStatus = await localProjectStatus(project);
    projects.push({
      id: project.id,
      name: project.name,
      source: project.source,
      inspectionStatus,
      canDo: project.capabilityCard?.taskShapes ?? [],
      canNotDo: project.capabilityCard?.notFor ?? [],
      triggerWords: project.capabilityCard?.triggerConditions ?? [],
      taskShapes: project.capabilityCard?.taskShapes ?? [],
      inputContract: project.capabilityCard?.inputContract ?? {},
      outputContract: project.capabilityCard?.outputContract ?? {},
      invocationPath: project.interface ?? {},
      verificationPath: project.capabilityCard?.verificationMethods ?? [],
      risk: project.capabilityCard?.knownRisks ?? [],
      runtimeCompatibility: project.interface?.requiredRuntime ?? [],
      osCompatibility: ["macos", "windows", "wsl2"],
      reuseScore: project.scoring?.overall ?? 0,
    });
  }
  const kimLocal = "D:/KimProject/Kim_Decision";
  const kimSkill = path.join(kimLocal, ".agents", "skills", "Kim", "SKILL.md");
  return {
    generatedAt: new Date().toISOString(),
    scannedSources: [
      "package.json",
      "config/skills.json",
      "config/capability-index",
      ".claude/.agents/.codex/.cursor/openclaw",
      "README/AGENTS/CLAUDE",
      "setup.mjs",
      "MCP configs"
    ],
    manifestDependencies: skills,
    discoveredDependencyProjects: projects,
    localDependencyProjects: projects.filter((p) => p.source?.type === "local" && p.inspectionStatus === "inspected"),
    externalDependencyProjects: projects.filter((p) => p.source?.type !== "local"),
    installedSkills: {
      kimDecisionCodexSkillExists: await exists(kimSkill),
      kimDecisionSkillPath: toPosix(kimSkill),
      kimDecisionBoundary: "reference_only_not_dependency_not_invokable"
    },
    referenceOnlyProjects: [
      {
        id: "kim-decision",
        name: "Kim_Decision",
        localPath: toPosix(kimLocal),
        inspectionStatus: (await exists(kimLocal)) ? "inspected_reference_only" : "missing",
        absorbedInto: "config/governance/decision-pattern-catalog.json",
        notDependency: true,
        notInvokable: true
      }
    ],
  };
}

function validateIndex(index) {
  const kim = index.discoveredDependencyProjects.find((project) => project.id === "kim-decision");
  if (kim) throw new Error("Kim_Decision is reference-only and must not be registered as dependency project");
  const kimRef = index.referenceOnlyProjects.find((project) => project.id === "kim-decision");
  if (!kimRef?.notDependency || !kimRef?.notInvokable) {
    throw new Error("Kim_Decision must be recorded only as reference material, not invokable dependency");
  }
  for (const project of index.discoveredDependencyProjects) {
    if (!Object.keys(project.inputContract).length || !Object.keys(project.outputContract).length) {
      throw new Error(`${project.id} is missing input/output contract`);
    }
    if (!project.verificationPath.length) {
      throw new Error(`${project.id} is missing verification methods`);
    }
  }
}

const index = await discover();
await writeJson(outputPath, index);
if (checkMode) validateIndex(index);
if (json) {
  console.log(JSON.stringify(index, null, 2));
} else {
  console.log(`Dependency capability index written to ${outputPath}`);
}
