// View model and render rules for the group room screen.
//
// The contract types room writes (`RoomCreate` / `RoomRunCreate`) but not the
// reads: GET /rooms/{id}, GET /rooms/{id}/runs and GET /runs/{id} answer plain
// objects. This module narrows those payloads once, at the boundary with the
// generated client, like src/agents/agent.ts and src/chat/chat.ts do for the
// screens they belong to, and it holds only the fields the room screen reads.

import {
  isRecord,
  readBoolean,
  readNumber,
  readOptionalString,
  readRecord,
  readString,
} from "../api/payload";

/** One participant of a room, in speaking order. */
export interface RoomParticipant {
  agent_id: string;
  agent_name: string;
  position: number;
  is_moderator: boolean;
}

export interface Room {
  id: string;
  name: string;
  /** Position 1 speaks first. */
  participants: RoomParticipant[];
}

/**
 * One step of a room run. The server marks the moderator's closing answer with
 * `phase: "moderator_summary"` and every earlier turn with
 * `phase: "participant"`; that field is what separates a contribution from the
 * moderator's summary on screen.
 */
export interface RoomRunTurn {
  position: number;
  agent_id: string;
  agent_name: string;
  phase: string;
  status: string;
  content: string | null;
}

export interface RoomRun {
  id: string;
  status: string;
  content: string;
  final_answer: string | null;
  error_code: string | null;
  turns: RoomRunTurn[];
}

const MODERATOR_PHASE = "moderator_summary";

/**
 * The room run's turns split by `phase`: the participant contributions in
 * speaking order, and the moderator's summary turn when one exists.
 */
export function splitRoomTurns(turns: RoomRunTurn[]): {
  participantTurns: RoomRunTurn[];
  summaryTurn: RoomRunTurn | undefined;
} {
  const ordered = [...turns].sort((left, right) => left.position - right.position);
  const participantTurns: RoomRunTurn[] = [];
  let summaryTurn: RoomRunTurn | undefined;
  for (const turn of ordered) {
    if (turn.phase === MODERATOR_PHASE) {
      summaryTurn ??= turn;
    } else {
      participantTurns.push(turn);
    }
  }
  return { participantTurns, summaryTurn };
}

function parseRoomParticipant(payload: unknown): RoomParticipant {
  if (!isRecord(payload)) {
    throw new Error("Oda katılımcısı bir nesne değil.");
  }
  const snapshot = readRecord(payload, "agent_snapshot");
  return {
    agent_id: readString(payload, "agent_id"),
    agent_name: readString(snapshot, "name"),
    position: readNumber(payload, "position"),
    is_moderator: readBoolean(payload, "is_moderator"),
  };
}

export function parseRoom(payload: unknown): Room {
  if (!isRecord(payload)) {
    throw new Error("Oda yanıtı bir nesne değil.");
  }
  const participants = payload.participants;
  if (!Array.isArray(participants)) {
    throw new Error('Yanıttaki "participants" alanı liste değil.');
  }
  return {
    id: readString(payload, "id"),
    name: readString(payload, "name"),
    participants: participants
      .map(parseRoomParticipant)
      .sort((left, right) => left.position - right.position),
  };
}

function parseRoomRunTurn(payload: unknown): RoomRunTurn {
  if (!isRecord(payload)) {
    throw new Error("Oda turu bir nesne değil.");
  }
  return {
    position: readNumber(payload, "position"),
    agent_id: readString(payload, "agent_id"),
    agent_name: readString(payload, "agent_name"),
    phase: readString(payload, "phase"),
    status: readString(payload, "status"),
    content: readOptionalString(payload, "content"),
  };
}

export function parseRoomRun(payload: unknown): RoomRun {
  if (!isRecord(payload)) {
    throw new Error("Oda çalıştırması bir nesne değil.");
  }
  const turns = payload.turns;
  if (!Array.isArray(turns)) {
    throw new Error('Yanıttaki "turns" alanı liste değil.');
  }
  return {
    id: readString(payload, "id"),
    status: readString(payload, "status"),
    content: readString(payload, "content"),
    final_answer: readOptionalString(payload, "final_answer"),
    error_code: readOptionalString(payload, "error_code"),
    turns: turns.map(parseRoomRunTurn).sort((left, right) => left.position - right.position),
  };
}

export function parseRoomRunList(payload: unknown): RoomRun[] {
  if (!Array.isArray(payload)) {
    throw new Error("Oda çalıştırma listesi bir dizi değil.");
  }
  return payload.map(parseRoomRun);
}

/** The 202 answer of `POST /rooms/{id}/runs`: the run to follow. */
export function parseEnqueuedRoomRun(payload: unknown): { id: string } {
  if (!isRecord(payload)) {
    throw new Error("Kuyruk yanıtı bir nesne değil.");
  }
  return { id: readString(payload, "id") };
}
