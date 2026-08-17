import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import {
  parseCodexLiveProviderConfig,
  resolveCodexLiveProviderConfigSync,
  revalidateCodexLiveProviderConfigSync,
} from "../../scripts/codex-live-provider-config.mjs";

const validConfig = `
model = "gpt-5.6-sol"
model_provider = "packycode"

[model_providers.packycode]
base_url = "https://provider.example/v1"
name = "packycode"
requires_openai_auth = true
wire_api = "responses"

[mcp_servers.unrelated]
command = "ignored"
`;

test("Codex live provider parsing emits only explicit non-secret route overrides", () => {
  const parsed = parseCodexLiveProviderConfig(validConfig);
  assert.deepEqual(parsed.selected, {
    providerId: "packycode",
    model: "gpt-5.6-sol",
    name: "packycode",
    baseUrl: "https://provider.example/v1",
    wireApi: "responses",
    requiresOpenAiAuth: true,
  });
  assert.deepEqual(parsed.args, [
    "-c", 'model="gpt-5.6-sol"',
    "-c", 'model_provider="packycode"',
    "-c", 'model_providers.packycode.name="packycode"',
    "-c", 'model_providers.packycode.base_url="https://provider.example/v1"',
    "-c", "model_providers.packycode.requires_openai_auth=true",
    "-c", 'model_providers.packycode.wire_api="responses"',
  ]);
  assert.doesNotMatch(parsed.args.join(" "), /mcp_servers|command|api[_-]?key/iu);
});

test("Codex live provider parsing fails closed for unsafe or ambiguous routes", () => {
  assert.throws(() => parseCodexLiveProviderConfig(validConfig.replace("https://provider.example/v1", "http://provider.example/v1")), /missing or malformed/u);
  assert.throws(() => parseCodexLiveProviderConfig(validConfig.replace("requires_openai_auth = true", "requires_openai_auth = false")), /missing or malformed/u);
  assert.throws(() => parseCodexLiveProviderConfig(validConfig.replace('wire_api = "responses"', 'wire_api = "chat"')), /missing or malformed/u);
  assert.throws(() => parseCodexLiveProviderConfig(validConfig.replace('model_provider = "packycode"', 'model_provider = "packycode"\nmodel_provider = "other"')), /missing or malformed/u);
});

test("Codex live provider binding requires colocated auth and detects config drift", () => {
  const runtimeHome = mkdtempSync(path.join(tmpdir(), "meta-kim-codex-provider-"));
  try {
    mkdirSync(runtimeHome, { recursive: true });
    writeFileSync(path.join(runtimeHome, "config.toml"), validConfig, "utf8");
    assert.throws(() => resolveCodexLiveProviderConfigSync({ runtimeHome }), /missing or malformed/u);
    writeFileSync(path.join(runtimeHome, "auth.json"), '{"OPENAI_API_KEY":"test-only"}\n', "utf8");
    const binding = resolveCodexLiveProviderConfigSync({ runtimeHome });
    assert.equal(binding.sourceRuntimeHome, runtimeHome);
    assert.equal(revalidateCodexLiveProviderConfigSync(binding).configSha256, binding.configSha256);
    writeFileSync(path.join(runtimeHome, "config.toml"), validConfig.replace("gpt-5.6-sol", "gpt-5.5"), "utf8");
    assert.throws(() => revalidateCodexLiveProviderConfigSync(binding), /missing or malformed/u);
  } finally {
    rmSync(runtimeHome, { recursive: true, force: true });
  }
});
