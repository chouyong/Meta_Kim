export function capabilitySourceIsValid(source) {
  const declaredValidity =
    source?.sourceValid ??
    source?.validCustomAgentDefinition ??
    source?.metadata?.validCustomAgentDefinition;
  return declaredValidity !== false;
}

export function compareCapabilitySources(left, right) {
  return (
    (right?.sourcePriority ?? 0) - (left?.sourcePriority ?? 0) ||
    Number(capabilitySourceIsValid(right)) - Number(capabilitySourceIsValid(left)) ||
    String(left?.sourceRef ?? "").localeCompare(String(right?.sourceRef ?? "")) ||
    String(left?.sourceKey ?? "").localeCompare(String(right?.sourceKey ?? ""))
  );
}
