// View model for the agent catalog.
//
// The platform contract types agent writes (`AgentCreate` / `AgentUpdate`) and
// the agent-config catalog, but not agent or catalog reads: GET /agents,
// GET /codex/models, GET /opencode/models and GET /mcp/tools answer plain
// objects. This module narrows those payloads once, at the boundary with the
// generated client, so the screen works with checked values instead of a
// hand-written copy of the read schemas.

import type { components } from "../api/schema";

export type AgentUpdate = components["schemas"]["AgentUpdate"];

/** One configured provider and the capabilities its manifest declares. */
export type AgentConfigProvider = components["schemas"]["AgentConfigProvider"];

/**
 * The reasoning efforts the agent API accepts (`AgentCreate` /
 * `AgentUpdate`), as declared by the contract.
 */
export type ModelEffort = NonNullable<
  components["schemas"]["AgentUpdate"]["model_reasoning_effort"]
>;

export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model_provider: string;
  model_name: string;
  model_reasoning_effort: string | null;
  enabled: boolean;
  capabilities: string[];
  tool_ids: string[];
  version: number;
}

/** The fields the create and edit forms share. */
export interface AgentDraft {
  name: string;
  description: string;
  instructions: string;
  model_provider: string;
  model_name: string;
  model_reasoning_effort: ModelEffort | null;
  capabilities: string[];
  tool_ids: string[];
  enabled: boolean;
}

/**
 * One selectable model from a provider's catalog (`GET /codex/models`,
 * `GET /opencode/models`). `efforts` are the only reasoning efforts the
 * provider supports for that model; an empty list means the model has none.
 */
export interface ModelChoice {
  id: string;
  label: string;
  is_default: boolean;
  default_effort: string;
  efforts: string[];
}

/** One administrator-configured MCP tool from `GET /mcp/tools`. */
export interface ToolChoice {
  id: string;
  description: string;
  trusted_read_only: boolean;
}

/**
 * The backend stores and matches capabilities as `value.strip().casefold()`
 * (`schemas._normalize_capabilities`, `runtime.list_agents`). The console trims
 * and lowercases every capability before it sends or filters with one, and it
 * compares whole values: the match is exact, never a substring search.
 */
export function normalizeCapability(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Comma-separated form input to the stored shape: trim, lowercase, drop
 * blanks, deduplicate and sort — what the backend does with the list.
 */
export function parseCapabilities(value: string): string[] {
  const capabilities = new Set<string>();
  for (const item of value.split(",")) {
    const capability = normalizeCapability(item);
    if (capability) {
      capabilities.add(capability);
    }
  }
  return [...capabilities].sort();
}

/**
 * PATCH body holding only the fields the form changed, or null when the draft
 * equals the agent: an unchanged save must not bump the agent version.
 *
 * `model_reasoning_effort` is sent only when it has a value: PATCH drops
 * explicit nulls (`exclude_none`), so the API can set an effort but never clear
 * one, and a null here would not change the stored agent.
 */
export function agentChanges(agent: Agent, draft: AgentDraft): AgentUpdate | null {
  const changes: AgentUpdate = {};
  if (draft.name !== agent.name) changes.name = draft.name;
  if (draft.description !== agent.description) changes.description = draft.description;
  if (draft.instructions !== agent.instructions) changes.instructions = draft.instructions;
  if (draft.model_provider !== agent.model_provider) changes.model_provider = draft.model_provider;
  if (draft.model_name !== agent.model_name) changes.model_name = draft.model_name;
  if (
    draft.model_reasoning_effort !== null &&
    draft.model_reasoning_effort !== agent.model_reasoning_effort
  ) {
    changes.model_reasoning_effort = draft.model_reasoning_effort;
  }
  if (!sameStrings(draft.capabilities, agent.capabilities)) {
    changes.capabilities = draft.capabilities;
  }
  if (!sameStrings(draft.tool_ids, agent.tool_ids)) changes.tool_ids = draft.tool_ids;
  if (draft.enabled !== agent.enabled) changes.enabled = draft.enabled;
  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * The effort to select after the model changed: the current value while the
 * new model still supports it, otherwise the model's own default, then its
 * first supported value. A model without efforts keeps the stored value,
 * because the API cannot clear an effort.
 */
export function nextEffort(
  model: ModelChoice | undefined,
  current: string,
  stored: string | null,
): string {
  if (!model) return current;
  if (model.efforts.length === 0) return stored ?? "";
  if (model.efforts.includes(current)) return current;
  if (model.efforts.includes(model.default_effort)) return model.default_effort;
  return model.efforts[0];
}

/**
 * The model to select while a provider's catalog is loaded. A model the
 * catalog does not list is kept only while it is the agent's own stored model;
 * otherwise the form moves to the model with the same id, then the catalog
 * default, then its first entry.
 */
export function resolveModelName(
  choices: ModelChoice[],
  current: string,
  storedModel: string | null,
): string {
  if (choices.length === 0) return current;
  if (choices.some((choice) => choice.id === current)) return current;
  if (storedModel !== null && current === storedModel) return current;
  return (
    choices.find((choice) => choice.id === storedModel)?.id ??
    choices.find((choice) => choice.is_default)?.id ??
    choices[0].id
  );
}

export function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Yanıttaki "${key}" alanı metin değil.`);
  }
  return value;
}

function readOptionalString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Yanıttaki "${key}" alanı metin değil.`);
  }
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    throw new Error(`Yanıttaki "${key}" alanı doğru/yanlış değil.`);
  }
  return value;
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number") {
    throw new Error(`Yanıttaki "${key}" alanı sayı değil.`);
  }
  return value;
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    throw new Error(`Yanıttaki "${key}" alanı metin listesi değil.`);
  }
  return value;
}

export function parseAgent(payload: unknown): Agent {
  if (!isRecord(payload)) {
    throw new Error("Ajan yanıtı bir nesne değil.");
  }
  return {
    id: readString(payload, "id"),
    name: readString(payload, "name"),
    description: readString(payload, "description"),
    instructions: readString(payload, "instructions"),
    model_provider: readString(payload, "model_provider"),
    model_name: readString(payload, "model_name"),
    model_reasoning_effort: readOptionalString(payload, "model_reasoning_effort"),
    enabled: readBoolean(payload, "enabled"),
    capabilities: readStringArray(payload, "capabilities"),
    tool_ids: readStringArray(payload, "tool_ids"),
    version: readNumber(payload, "version"),
  };
}

export function parseAgentList(payload: unknown): Agent[] {
  if (!Array.isArray(payload)) {
    throw new Error("Ajan listesi bir dizi değil.");
  }
  return payload.map(parseAgent);
}

/**
 * A provider's model catalog. `id` and `efforts` are the only model names and
 * reasoning efforts the provider supports, so the form offers exactly these.
 */
export function parseModelChoices(payload: unknown): ModelChoice[] {
  if (!Array.isArray(payload)) {
    throw new Error("Model kataloğu bir dizi değil.");
  }
  return payload.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Model kataloğu beklenen biçimde değil.");
    }
    return {
      id: readString(entry, "id"),
      label: readString(entry, "label"),
      is_default: readBoolean(entry, "is_default"),
      default_effort: readString(entry, "default_effort"),
      efforts: readStringArray(entry, "efforts"),
    };
  });
}

/** The tool catalog; only entries the administrator approved as read-only. */
export function parseToolChoices(payload: unknown): ToolChoice[] {
  if (!Array.isArray(payload)) {
    throw new Error("Araç kataloğu bir dizi değil.");
  }
  return payload.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Araç kataloğu beklenen biçimde değil.");
    }
    return {
      id: readString(entry, "id"),
      description: readString(entry, "description"),
      trusted_read_only: readBoolean(entry, "trusted_read_only"),
    };
  });
}
