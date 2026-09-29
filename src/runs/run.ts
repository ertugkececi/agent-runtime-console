// Run-level view model shared by the chat, group room and graph screens.
//
// All three screens follow `GET /runs/{run_id}`, and the platform reports the
// same statuses and the same event shape for a chat run and a room run:
// `{ sequence, type, payload, created_at }`. Only a status the platform reports
// may end a follow loop: anything else, including a status this console does
// not know yet, keeps being treated as unfinished.

import { isRecord, readNumber, readRecord, readString } from "../api/payload";

/** One entry of the run's `events`, as `GET /runs/{run_id}` reports it. */
export interface RunEvent {
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export function parseRunEvent(payload: unknown): RunEvent {
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

const RUN_STATUS_LABELS: Record<string, string> = {
  queued: "Sırada",
  running: "Çalışıyor",
  completed: "Tamamlandı",
  failed: "Başarısız",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABELS[status] ?? status;
}

/** A run is terminal only when the platform says so. */
export function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

export function isActiveStatus(status: string): boolean {
  return status === "queued" || status === "running";
}

/**
 * The facts a timeline prints for an event. Only identifiers, statuses, codes,
 * counts and model names are ever read from a payload: message content and tool
 * arguments are not in this list, so no event can put them on screen. The
 * `mcp_tool_call` event carries `server`, `tool`, `status` and `phase` — that
 * the call happened, never what it was called with.
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
  room_run_started: "Oda çalıştırması başladı",
  room_turn_started: "Tur başladı",
  room_turn_completed: "Tur tamamlandı",
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
