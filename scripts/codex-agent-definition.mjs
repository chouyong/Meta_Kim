function scalarTomlValue(content, key) {
  const triple = content.match(
    new RegExp(`^${key}\\s*=\\s*(?:\"\"\"|''')([\\s\\S]*?)(?:\"\"\"|''')`, "mu"),
  );
  if (triple) return triple[1].trim();
  const single = content.match(new RegExp(`^${key}\\s*=\\s*[\"']([^\"']+)[\"']`, "mu"));
  return single?.[1]?.trim() ?? null;
}

export function parseCodexAgentDefinition(
  content,
  inventoryId = null,
  { allowRuntimeNativeProfile = false } = {},
) {
  const metadata = {
    name: scalarTomlValue(content, "name"),
    description: scalarTomlValue(content, "description"),
    developer_instructions: scalarTomlValue(content, "developer_instructions"),
  };
  const fallbackName = typeof inventoryId === "string" && inventoryId.trim()
    ? inventoryId.trim()
    : null;
  const nativeAgentName = metadata.name ?? fallbackName;
  const errors = [
    ...(!nativeAgentName ? ["missing_name"] : []),
    ...(!metadata.name && !allowRuntimeNativeProfile ? ["missing_name"] : []),
    ...(!metadata.description && !allowRuntimeNativeProfile ? ["missing_description"] : []),
    ...(!metadata.developer_instructions ? ["missing_developer_instructions"] : []),
  ];
  return {
    metadata,
    errors: [...new Set(errors)],
    nativeAgentName,
  };
}
