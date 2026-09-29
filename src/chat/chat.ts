// View model and render rules for the human-agent chat screen.
//
// The contract types the chat writes (`HumanChatCreate`,
// `HumanChatMessageCreate`) but not the reads: GET /conversations/{id} and
// GET /runs/{id} answer plain objects. This module narrows those payloads once,
// at the boundary with the generated client, like src/agents/agent.ts does for
// the agent catalog, and it holds only the fields the screen reads.

import { isRecord, readNumber, readOptionalString, readString, readStringArray } from "../api/payload";
import { parseRunEvent, type RunEvent } from "../runs/run";

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
