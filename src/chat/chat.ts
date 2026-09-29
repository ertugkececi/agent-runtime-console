// View model and render rules for the human-agent chat screen.
//
// The contract types the chat writes (`HumanChatCreate`,
// `HumanChatMessageCreate`) but not the reads: GET /conversations/{id} and
// GET /runs/{id} answer plain objects. This module narrows those payloads once,
// at the boundary with the generated client, like src/agents/agent.ts does for
// the agent catalog, and it holds only the fields the screen reads.

import { isRecord, readNumber, readOptionalString, readRecord, readString, readStringArray } from "../api/payload";

export interface ChatMessage {
  id: string;
  run_id: string | null;
  sender_type: string;
  sender_agent_id: string | null;
  content: string;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  agent_ids: string[];
  messages: ChatMessage[];
}

export interface RunEvent {
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** The queue job of an asynchronous run, when one exists. */
export interface RunQueue {
  attempts: number;
  max_attempts: number;
}

export interface ChatRun {
  id: string;
  status: string;
  error_code: string | null;
  queue: RunQueue | null;
  events: RunEvent[];
}

/** The 202 answer of the async send: the run to follow. */
export interface EnqueuedRun {
  id: string;
}

/**
 * A run is terminal only when the platform says so. Anything else (including a
 * status this console does not know yet) keeps being followed.
 */
export function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

export function isActiveStatus(status: string): boolean {
  return status === "queued" || status === "running";
}

const RUN_STATUS_LABELS: Record<string, string> = {
  queued: "Sırada",
  running: "Çalışıyor",
  completed: "Tamamlandı",
  failed: "Başarısız",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABELS[status] ?? status;
}

/**
 * The run of the newest user message. A run the server still holds in
 * `queued`/`running` is what the screen resumes after a reload.
 */
export function newestRunId(messages: ChatMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.sender_type === "user" && message.run_id !== null) {
      return message.run_id;
    }
  }
  return null;
}

/**
 * The facts the timeline prints for an event. Only identifiers, statuses,
 * codes, counts and model names are ever read from a payload: message content
 * and tool arguments are not in this list, so no event can put them on screen.
 * The `mcp_tool_call` event carries `server`, `tool`, `status` and `phase` —
 * that the call happened, never what it was called with.
 */
const SAFE_EVENT_DETAIL_KEYS = [
  "server",
  "tool",
  "status",
  "phase",
  "error_code",
  "attempt",
  "capability",
  "provider",
  "model",
  "output_type",
  "reason",
  "disabled_match_count",
  "candidate_count",
  "remote_status",
] as const;

const EVENT_LABELS: Record<string, string> = {
  run_queued: "Çalıştırma kuyruğa alındı",
  run_started: "Çalıştırma başladı",
  user_message_received: "Kullanıcı mesajı alındı",
  mcp_tool_permissions_checked: "Araç izinleri denetlendi",
  model_call_started: "Model çağrısı başladı",
  model_call_completed: "Model çağrısı tamamlandı",
  mcp_tool_call: "Araç çağrısı",
  handoff_requested: "Alt görev devri istendi",
  handoff_rejected: "Alt görev devri reddedildi",
  handoff_target_resolved: "Devir hedefi belirlendi",
  handoff_result_reused: "Devir sonucu yeniden kullanıldı",
  handoff_result_returned: "Devir sonucu döndü",
  delegated_task_started: "Alt görev başladı",
  delegated_task_resumed: "Alt görev sürdürüldü",
  delegated_task_completed: "Alt görev tamamlandı",
  delegated_task_failed: "Alt görev başarısız",
  a2a_remote_task_created: "Uzak görev oluşturuldu",
  a2a_remote_task_status: "Uzak görev durumu alındı",
  agent_response_saved: "Ajan yanıtı kaydedildi",
  run_completed: "Çalıştırma tamamlandı",
  run_failed: "Çalıştırma başarısız",
  retry_scheduled: "Yeniden deneme planlandı",
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}

export function eventDetails(event: RunEvent): string[] {
  const details: string[] = [];
  for (const key of SAFE_EVENT_DETAIL_KEYS) {
    const value = event.payload[key];
    if (typeof value === "string" || typeof value === "number") {
      details.push(`${key}: ${value}`);
    }
  }
  return details;
}

export function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString("tr-TR");
}

function parseChatMessage(payload: unknown): ChatMessage {
  if (!isRecord(payload)) {
    throw new Error("Sohbet mesajı bir nesne değil.");
  }
  return {
    id: readString(payload, "id"),
    run_id: readOptionalString(payload, "run_id"),
    sender_type: readString(payload, "sender_type"),
    sender_agent_id: readOptionalString(payload, "sender_agent_id"),
    content: readString(payload, "content"),
    created_at: readString(payload, "created_at"),
  };
}

export function parseChatConversation(payload: unknown): ChatConversation {
  if (!isRecord(payload)) {
    throw new Error("Sohbet yanıtı bir nesne değil.");
  }
  const messages = payload.messages;
  if (!Array.isArray(messages)) {
    throw new Error('Yanıttaki "messages" alanı liste değil.');
  }
  return {
    id: readString(payload, "id"),
    agent_ids: readStringArray(payload, "agent_ids"),
    messages: messages.map(parseChatMessage),
  };
}

function parseRunEvent(payload: unknown): RunEvent {
  if (!isRecord(payload)) {
    throw new Error("Çalıştırma olayı bir nesne değil.");
  }
  return {
    sequence: readNumber(payload, "sequence"),
    type: readString(payload, "type"),
    payload: readRecord(payload, "payload"),
    created_at: readString(payload, "created_at"),
  };
}

function parseRunQueue(payload: unknown): RunQueue | null {
  if (payload === null || payload === undefined) {
    return null;
  }
  if (!isRecord(payload)) {
    throw new Error('Yanıttaki "queue" alanı nesne değil.');
  }
  return {
    attempts: readNumber(payload, "attempts"),
    max_attempts: readNumber(payload, "max_attempts"),
  };
}

export function parseChatRun(payload: unknown): ChatRun {
  if (!isRecord(payload)) {
    throw new Error("Çalıştırma yanıtı bir nesne değil.");
  }
  const events = payload.events;
  if (!Array.isArray(events)) {
    throw new Error('Yanıttaki "events" alanı liste değil.');
  }
  return {
    id: readString(payload, "id"),
    status: readString(payload, "status"),
    error_code: readOptionalString(payload, "error_code"),
    queue: parseRunQueue(payload.queue),
    events: events.map(parseRunEvent),
  };
}

export function parseEnqueuedRun(payload: unknown): EnqueuedRun {
  if (!isRecord(payload)) {
    throw new Error("Kuyruk yanıtı bir nesne değil.");
  }
  return { id: readString(payload, "id") };
}
