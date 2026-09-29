// View model for the agent catalog.
//
// The platform contract types agent writes (`AgentCreate` / `AgentUpdate`) but
// not agent reads: GET /agents answers plain objects. This module narrows that
// payload once, at the boundary with the generated client, so the screen works
// with checked values instead of a hand-written copy of the read schema.

import type { components } from "../api/schema";

export type AgentUpdate = components["schemas"]["AgentUpdate"];

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
  version: number;
}

/** The fields the create and edit forms share. */
export interface AgentDraft {
  name: string;
  description: string;
  instructions: string;
  model_provider: string;
  model_name: string;
  capabilities: string[];
  enabled: boolean;
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
 */
export function agentChanges(agent: Agent, draft: AgentDraft): AgentUpdate | null {
  const changes: AgentUpdate = {};
  if (draft.name !== agent.name) changes.name = draft.name;
  if (draft.description !== agent.description) changes.description = draft.description;
  if (draft.instructions !== agent.instructions) changes.instructions = draft.instructions;
  if (draft.model_provider !== agent.model_provider) changes.model_provider = draft.model_provider;
  if (draft.model_name !== agent.model_name) changes.model_name = draft.model_name;
  if (!sameCapabilities(draft.capabilities, agent.capabilities)) {
    changes.capabilities = draft.capabilities;
  }
  if (draft.enabled !== agent.enabled) changes.enabled = draft.enabled;
  return Object.keys(changes).length > 0 ? changes : null;
}

function sameCapabilities(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Ajan yanıtındaki "${key}" alanı metin değil.`);
  }
  return value;
}

function readOptionalString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Ajan yanıtındaki "${key}" alanı metin değil.`);
  }
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    throw new Error(`Ajan yanıtındaki "${key}" alanı doğru/yanlış değil.`);
  }
  return value;
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number") {
    throw new Error(`Ajan yanıtındaki "${key}" alanı sayı değil.`);
  }
  return value;
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    throw new Error(`Ajan yanıtındaki "${key}" alanı metin listesi değil.`);
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
    version: readNumber(payload, "version"),
  };
}

export function parseAgentList(payload: unknown): Agent[] {
  if (!Array.isArray(payload)) {
    throw new Error("Ajan listesi bir dizi değil.");
  }
  return payload.map(parseAgent);
}

export function parseProviderIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.providers)) {
    throw new Error("Sağlayıcı kataloğu beklenen biçimde değil.");
  }
  return payload.providers.map((provider) => {
    if (!isRecord(provider)) {
      throw new Error("Sağlayıcı kataloğu beklenen biçimde değil.");
    }
    return readString(provider, "id");
  });
}
