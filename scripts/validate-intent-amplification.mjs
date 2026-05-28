#!/usr/bin/env node
import { assert, readJson } from "./governance-lib.mjs";

const contract = await readJson("config/governance/intent-amplification-contract.json");

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateShape(value, allowTemplate = true) {
  const required = ["surfaceRequest", "realIntent", "subject", "currentState", "targetState", "selectedPath", "whyThisPath", "doneCondition"];
  if (!allowTemplate) {
    for (const field of required) assert(nonEmpty(value[field]), `${field} is required`);
  }
  assert(Array.isArray(value.successCriteria), "successCriteria must be an array");
  assert(value.evidence && ["confirmed", "userProvided", "inference", "unconfirmed"].every((key) => Array.isArray(value.evidence[key])), "evidence must be classified");
  assert((value.pathCandidates ?? []).length >= 2, "At least two pathCandidates are required");
  for (const candidate of value.pathCandidates) {
    assert(nonEmpty(candidate.id), "path candidate id required");
    assert(typeof candidate.score === "number", "path candidate score required");
  }
  const firstAction = value.firstAction ?? {};
  for (const field of ["actor", "input", "action", "output", "passSignal", "killSignal", "timebox"]) {
    if (!allowTemplate) assert(nonEmpty(firstAction[field]), `firstAction.${field} is required`);
    else assert(Object.prototype.hasOwnProperty.call(firstAction, field), `firstAction.${field} key is required`);
  }
  assert(typeof value.intentAmplificationScore === "number", "intentAmplificationScore must be numeric");
  assert(typeof value.userGoalDone === "boolean", "userGoalDone must be boolean");
  if (value.userGoalDone || value.publicReadyScore >= 90) {
    assert(value.intentAmplificationScore >= 90, "userGoalDone/public-ready requires score >= 90");
    assert(nonEmpty(value.doneCondition), "userGoalDone requires doneCondition evidence");
  }
}

validateShape(contract, true);
console.log("intent amplification contract valid");
