// View model for provider sign-ins.
//
// The platform contract types the connection writes
// (`OpenCodeConnectionCreate` / `OpenCodeConnectionCode`) but not its reads:
// GET /opencode/integrations and GET /opencode/connections/{id} answer plain
// objects. This module narrows those payloads once, at the boundary with the
// generated client, like every other untyped read.

import {
  isRecord,
  readBoolean,
  readOptionalString,
  readString,
} from "../api/payload";
import type { components } from "../api/schema";

export type ConnectionCreate = components["schemas"]["OpenCodeConnectionCreate"];

export interface IntegrationMethod {
  id: string;
  type: string;
  label: string;
}

/** One integration and the sign-in methods it offers (`GET /opencode/integrations`). */
export interface Integration {
  id: string;
  name: string;
  connected: boolean;
  methods: IntegrationMethod[];
}

/**
 * One sign-in attempt (`POST /opencode/connections` and
 * `GET /opencode/connections/{id}`). `status` is `waiting`, `complete` or
 * `failed`; `mode` is `auto` or `code`.
 */
export interface ConnectionAttempt {
  attempt_id: string;
  integration: string;
  method: string | null;
  status: string;
  url: string;
  instructions: string;
  mode: string;
  message: string | null;
}

/**
 * The method the screen offers: the headless one when the integration has it,
 * because the browser method needs the human's own browser to reach a callback
 * port on the server machine; otherwise the first OAuth method.
 */
export function preferredMethod(integration: Integration): IntegrationMethod | null {
  const oauth = integration.methods.filter((method) => method.type === "oauth");
  return oauth.find((method) => method.id.includes("headless")) ?? oauth[0] ?? null;
}

export function parseIntegrations(payload: unknown): Integration[] {
  if (!Array.isArray(payload)) {
    throw new Error("Sağlayıcı listesi bir dizi değil.");
  }
  return payload.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Sağlayıcı kaydı beklenen biçimde değil.");
    }
    const methods = entry["methods"];
    if (!Array.isArray(methods)) {
      throw new Error("Sağlayıcı yöntemleri bir dizi değil.");
    }
    return {
      id: readString(entry, "id"),
      name: readString(entry, "name"),
      connected: readBoolean(entry, "connected"),
      methods: methods.map(parseMethod),
    };
  });
}

export function parseAttempt(payload: unknown): ConnectionAttempt {
  if (!isRecord(payload)) {
    throw new Error("Bağlantı yanıtı bir nesne değil.");
  }
  return {
    attempt_id: readString(payload, "attempt_id"),
    integration: readString(payload, "integration"),
    method: readOptionalString(payload, "method"),
    status: readString(payload, "status"),
    url: readString(payload, "url"),
    instructions: readString(payload, "instructions"),
    mode: readString(payload, "mode"),
    message: readOptionalString(payload, "message"),
  };
}

function parseMethod(payload: unknown): IntegrationMethod {
  if (!isRecord(payload)) {
    throw new Error("Sağlayıcı yöntemi beklenen biçimde değil.");
  }
  return {
    id: readString(payload, "id"),
    type: readString(payload, "type"),
    label: readString(payload, "label"),
  };
}
