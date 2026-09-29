// View model and builders for the graph screen.
//
// Every node and edge is derived from API reads — `GET /agents` (agents and
// their `agent_capabilities`), `GET /runs/{run_id}` (a run, its tasks and its
// `run_events`) and `GET /rooms/{room_id}` with the room's runs — and nothing
// is entered by hand. The contract types the writes but not these reads, so
// `parseGraphRun` narrows the one read shape the existing screens do not
// already narrow, at the boundary with the generated client.

import type { Agent } from "../agents/agent";
import { isRecord, readOptionalString, readString } from "../api/payload";
import type { ChatMessage } from "../chat/chat";
import type { Room, RoomRun } from "../rooms/room";
import { parseRunEvent, runStatusLabel, type RunEvent } from "../runs/run";

export type GraphNodeKind = "agent" | "capability" | "run" | "turn";

/**
 * One node the canvas renders. `status` is a raw platform status; the canvas
 * and the detail panel print it through `runStatusLabel`. `agentId` and the
 * other references point back at the API record the node was derived from, and
 * they are what the detail panel resolves.
 */
export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  subtitle: string | null;
  status: string | null;
  agentId: string | null;
  capability: string | null;
  runId: string | null;
  /** The turn's position inside its run; null for other node kinds. */
  position: number | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string | null;
}

export interface GraphView {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** One delegated task of a chat run, read from the run's `tasks`. */
export interface GraphTask {
  id: string;
  parentTaskId: string | null;
  agentId: string;
  agentName: string;
  capability: string;
  status: string;
  errorCode: string | null;
}

export interface GraphRunAgent {
  id: string;
  name: string;
}

/** A chat run as `GET /runs/{run_id}` reports it, narrowed once. */
export interface GraphRun {
  id: string;
  status: string;
  errorCode: string | null;
  targetAgent: GraphRunAgent | null;
  tasks: GraphTask[];
  events: RunEvent[];
}

/** One agent's part in one known run, for the run-history list. */
export interface KnownRunAgent {
  agentId: string;
  agentName: string;
  roles: string[];
  status: string;
}

/**
 * One run the loaded data knows about, whichever screen produced it, with the
 * agents that took part. This is what an agent node's "çalıştırma geçmişi"
 * lists.
 */
export interface KnownRun {
  id: string;
  origin: "chat" | "room";
  label: string;
  status: string;
  errorCode: string | null;
  events: RunEvent[];
  agents: KnownRunAgent[];
}

function parseGraphRunAgent(payload: unknown): GraphRunAgent | null {
  if (payload === null || payload === undefined) {
    return null;
  }
  if (!isRecord(payload)) {
    throw new Error('Yanıttaki "agent_snapshot" alanı nesne değil.');
  }
  return { id: readString(payload, "id"), name: readString(payload, "name") };
}

function parseGraphTask(payload: unknown): GraphTask {
  if (!isRecord(payload)) {
    throw new Error("Görev bir nesne değil.");
  }
  const snapshot = parseGraphRunAgent(payload.agent_snapshot);
  return {
    id: readString(payload, "id"),
    parentTaskId: readOptionalString(payload, "parent_task_id"),
    agentId: readString(payload, "agent_id"),
    agentName: snapshot?.name ?? readString(payload, "agent_id"),
    capability: readString(payload, "capability"),
    status: readString(payload, "status"),
    errorCode: readOptionalString(payload, "error_code"),
  };
}

/**
 * A chat run. The chat screen's `parseChatRun` reads only the timeline fields;
 * the graph needs the run's task tree and its target agent snapshot, which is
 * where the handoff chain comes from.
 */
export function parseGraphRun(payload: unknown): GraphRun {
  if (!isRecord(payload)) {
    throw new Error("Çalıştırma yanıtı bir nesne değil.");
  }
  const events = payload.events;
  if (!Array.isArray(events)) {
    throw new Error('Yanıttaki "events" alanı liste değil.');
  }
  const tasks = payload.tasks ?? [];
  if (!Array.isArray(tasks)) {
    throw new Error('Yanıttaki "tasks" alanı liste değil.');
  }
  const snapshots = payload.agent_snapshots;
  if (snapshots !== null && snapshots !== undefined && !isRecord(snapshots)) {
    throw new Error('Yanıttaki "agent_snapshots" alanı nesne değil.');
  }
  return {
    id: readString(payload, "id"),
    status: readString(payload, "status"),
    errorCode: readOptionalString(payload, "error_code"),
    targetAgent: isRecord(snapshots) ? parseGraphRunAgent(snapshots.target) : null,
    tasks: tasks.map(parseGraphTask),
    events: events.map(parseRunEvent),
  };
}

/**
 * The run ids of the conversation's messages, in the order the messages were
 * written. One user message starts one run; agent answers carry the same id.
 */
export function conversationRunIds(messages: ChatMessage[]): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    if (message.run_id !== null && !ids.includes(message.run_id)) {
      ids.push(message.run_id);
    }
  }
  return ids;
}

/** A run the handoff graph draws, with its 1-based position in the chat. */
export interface HandoffRun {
  run: GraphRun;
  ordinal: number;
}

export function agentNodeId(agentId: string): string {
  return `agent:${agentId}`;
}

export function capabilityNodeId(capability: string): string {
  return `capability:${capability}`;
}

export function runNodeId(runId: string): string {
  return `run:${runId}`;
}

function turnNodeId(runId: string, position: number): string {
  return `turn:${runId}:${position}`;
}

function participantNodeId(agentId: string): string {
  return `participant:${agentId}`;
}

/** `Sırada`, `Çalışıyor`, … for a node status; the raw value when unknown. */
export function graphNodeStatusLabel(node: GraphNode): string | null {
  return node.status === null ? null : runStatusLabel(node.status);
}

/**
 * The agent–capability graph: one node per registered agent and one per
 * capability any agent declares, with the membership edges between them. The
 * data is `GET /agents`, whose entries carry the agent's capability records.
 */
export function buildAgentCapabilityGraph(agents: Agent[]): GraphView {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const capabilities = new Set<string>();

  for (const agent of agents) {
    const source = agentNodeId(agent.id);
    nodes.push({
      id: source,
      kind: "agent",
      label: agent.name,
      subtitle: `${agent.model_provider} / ${agent.model_name}`,
      status: agent.enabled ? "Etkin" : "Devre dışı",
      agentId: agent.id,
      capability: null,
      runId: null,
      position: null,
    });
    for (const capability of agent.capabilities) {
      const target = capabilityNodeId(capability);
      capabilities.add(capability);
      edges.push({ id: `${source}->${target}`, source, target, label: null });
    }
  }

  for (const capability of [...capabilities].sort()) {
    nodes.push({
      id: capabilityNodeId(capability),
      kind: "capability",
      label: capability,
      subtitle: "Yetenek",
      status: null,
      agentId: null,
      capability,
      runId: null,
      position: null,
    });
  }

  return { nodes, edges };
}

/**
 * The handoff chain: one node per loaded run, one node per agent the runs
 * mention, and an edge from a parent agent to the delegated agent labelled
 * with the capability the delegation asked for. Repeated handoffs between the
 * same pair are one edge carrying a count. Agent and capability facts come
 * from the runs' own snapshots and tasks; the run nodes come from the runs.
 */
export function buildHandoffGraph(
  handoffs: HandoffRun[],
  agentNames: Map<string, string>,
): GraphView {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge & { count: number }>();

  const addAgentNode = (agentId: string, name: string, role: string) => {
    const id = agentNodeId(agentId);
    const existing = nodes.get(id);
    if (existing === undefined) {
      nodes.set(id, {
        id,
        kind: "agent",
        label: agentNames.get(agentId) ?? name,
        subtitle: role,
        status: null,
        agentId,
        capability: null,
        runId: null,
        position: null,
      });
      return;
    }
    if (existing.subtitle !== null && !existing.subtitle.split(" ve ").includes(role)) {
      existing.subtitle = `${existing.subtitle} ve ${role}`;
    }
  };

  for (const { run, ordinal } of handoffs) {
    const runId = runNodeId(run.id);
    nodes.set(runId, {
      id: runId,
      kind: "run",
      label: `Çalıştırma ${ordinal}`,
      subtitle: "Sohbet çalıştırması",
      status: run.status,
      agentId: null,
      capability: null,
      runId: run.id,
      position: null,
    });

    const rootId = run.targetAgent?.id ?? null;
    if (rootId !== null && run.targetAgent !== null) {
      addAgentNode(rootId, run.targetAgent.name, "Kök ajan");
      const edgeId = `${runId}->${agentNodeId(rootId)}`;
      edges.set(edgeId, {
        id: edgeId,
        source: runId,
        target: agentNodeId(rootId),
        label: null,
        count: 1,
      });
    }

    const taskById = new Map(run.tasks.map((task) => [task.id, task]));
    for (const task of run.tasks) {
      addAgentNode(task.agentId, task.agentName, "Devredilen ajan");
      const parentTask = task.parentTaskId === null ? undefined : taskById.get(task.parentTaskId);
      const parentAgentId = parentTask?.agentId ?? rootId ?? task.agentId;
      const source = agentNodeId(parentAgentId);
      const target = agentNodeId(task.agentId);
      const edgeId = `${source}->${target}|${task.capability}`;
      const existing = edges.get(edgeId);
      if (existing === undefined) {
        edges.set(edgeId, {
          id: edgeId,
          source,
          target,
          label: task.capability,
          count: 1,
        });
      } else {
        existing.count += 1;
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()].map(({ id, source, target, label, count }) => ({
      id,
      source,
      target,
      label: count > 1 ? `${label} ×${count}` : label,
    })),
  };
}

/**
 * The room flow: the selected run's task followed by its turns in speaking
 * order — the moderator's summary last. Without a run yet, the room's
 * participant order is drawn instead, because that is all the room record
 * holds.
 */
export function buildRoomFlowGraph(
  room: Room,
  run: RoomRun | null,
  ordinal: number | null,
): GraphView {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  if (run === null) {
    const participants = room.participants
      .slice()
      .sort((left, right) => left.position - right.position);
    participants.forEach((participant, index) => {
      const id = participantNodeId(participant.agent_id);
      nodes.push({
        id,
        kind: "agent",
        label: participant.agent_name,
        subtitle: `${participant.position}. sıra${
          participant.is_moderator ? " · Moderatör" : ""
        }`,
        status: null,
        agentId: participant.agent_id,
        capability: null,
        runId: null,
        position: participant.position,
      });
      const previous = participants[index - 1];
      if (previous !== undefined) {
        edges.push({
          id: `${participantNodeId(previous.agent_id)}->${id}`,
          source: participantNodeId(previous.agent_id),
          target: id,
          label: `sıra ${participant.position}`,
        });
      }
    });
    return { nodes, edges };
  }

  const runId = runNodeId(run.id);
  nodes.push({
    id: runId,
    kind: "run",
    label: ordinal === null ? "Oda çalıştırması" : `Oda çalıştırması ${ordinal}`,
    subtitle: run.content.length > 60 ? `${run.content.slice(0, 60)}…` : run.content,
    status: run.status,
    agentId: null,
    capability: null,
    runId: run.id,
    position: null,
  });

  const turns = run.turns.slice().sort((left, right) => left.position - right.position);
  let previousId = runId;
  for (const turn of turns) {
    const id = turnNodeId(run.id, turn.position);
    nodes.push({
      id,
      kind: "turn",
      label: turn.agent_name,
      subtitle:
        turn.phase === "moderator_summary"
          ? "Moderatör özeti"
          : `${turn.position}. tur · ${
              turn.is_moderator ? "Moderatör katkısı" : "Katkı"
            }`,
      status: turn.status,
      agentId: turn.agent_id,
      capability: null,
      runId: run.id,
      position: turn.position,
    });
    edges.push({
      id: `${previousId}->${id}`,
      source: previousId,
      target: id,
      label: `sıra ${turn.position}`,
    });
    previousId = id;
  }

  return { nodes, edges };
}

/** The run-history entry for one chat run. */
export function chatKnownRun(
  run: GraphRun,
  ordinal: number,
  agentNames: Map<string, string>,
): KnownRun {
  const agents: KnownRunAgent[] = [];
  if (run.targetAgent !== null) {
    agents.push({
      agentId: run.targetAgent.id,
      agentName: agentNames.get(run.targetAgent.id) ?? run.targetAgent.name,
      roles: ["Kök ajan"],
      status: run.status,
    });
  }
  for (const task of run.tasks) {
    agents.push({
      agentId: task.agentId,
      agentName: agentNames.get(task.agentId) ?? task.agentName,
      roles: ["Devredilen ajan"],
      status: task.status,
    });
  }
  return {
    id: run.id,
    origin: "chat",
    label: `Sohbet çalıştırması ${ordinal}`,
    status: run.status,
    errorCode: run.errorCode,
    events: run.events,
    agents,
  };
}

/** The run-history entry for one room run. */
export function roomKnownRun(run: RoomRun, ordinal: number): KnownRun {
  const agents = new Map<string, KnownRunAgent>();
  for (const turn of run.turns) {
    const existing = agents.get(turn.agent_id);
    const role = turn.phase === "moderator_summary" ? "Moderatör" : "Katılımcı";
    if (existing === undefined) {
      agents.set(turn.agent_id, {
        agentId: turn.agent_id,
        agentName: turn.agent_name,
        roles: [role],
        status: turn.status,
      });
    } else if (!existing.roles.includes(role)) {
      existing.roles.push(role);
    }
  }
  return {
    id: run.id,
    origin: "room",
    label: `Oda çalıştırması ${ordinal}`,
    status: run.status,
    errorCode: run.error_code,
    events: run.events,
    agents: [...agents.values()],
  };
}

/** One agent's part in one known run. */
export interface AgentRunHistory {
  run: KnownRun;
  roles: string[];
  status: string;
}

/** The known runs the agent took part in, oldest first. */
export function agentRunHistory(runs: KnownRun[], agentId: string): AgentRunHistory[] {
  const history: AgentRunHistory[] = [];
  for (const run of runs) {
    const participation = run.agents.find((agent) => agent.agentId === agentId);
    if (participation !== undefined) {
      history.push({ run, roles: participation.roles, status: participation.status });
    }
  }
  return history;
}

/** What the loaded run events say about one capability. */
export interface CapabilityStats {
  requested: number;
  resolved: number;
  rejected: number;
  rejectionReasons: string[];
}

/** Counts of `handoff_*` events whose payload carries this capability. */
export function capabilityHandoffStats(runs: KnownRun[], capability: string): CapabilityStats {
  const stats: CapabilityStats = { requested: 0, resolved: 0, rejected: 0, rejectionReasons: [] };
  for (const run of runs) {
    for (const event of run.events) {
      if (event.payload.capability !== capability) {
        continue;
      }
      if (event.type === "handoff_requested") {
        stats.requested += 1;
      } else if (event.type === "handoff_target_resolved") {
        stats.resolved += 1;
      } else if (event.type === "handoff_rejected") {
        stats.rejected += 1;
        const reason = event.payload.reason;
        if (typeof reason === "string" && !stats.rejectionReasons.includes(reason)) {
          stats.rejectionReasons.push(reason);
        }
      }
    }
  }
  return stats;
}

/** The agent names `GET /agents` gives, for run snapshots that predate a rename. */
export function agentNameMap(agents: Agent[]): Map<string, string> {
  return new Map(agents.map((agent) => [agent.id, agent.name]));
}

const KIND_LABELS: Record<GraphNodeKind, string> = {
  agent: "Ajan",
  capability: "Yetenek",
  run: "Çalıştırma",
  turn: "Tur",
};

/** One readable line per node, for the text summary under the canvas. */
export function graphNodeText(node: GraphNode): string {
  const parts = [`${KIND_LABELS[node.kind]}: ${node.label}`];
  if (node.subtitle !== null) {
    parts.push(node.subtitle);
  }
  const status = graphNodeStatusLabel(node);
  if (status !== null) {
    parts.push(status);
  }
  return parts.join(" · ");
}

/** One readable line per edge, for the same summary. */
export function graphEdgeTexts(view: GraphView): string[] {
  const labels = new Map(view.nodes.map((node) => [node.id, node.label]));
  return view.edges.map((edge) => {
    const source = labels.get(edge.source) ?? edge.source;
    const target = labels.get(edge.target) ?? edge.target;
    return edge.label === null
      ? `${source} → ${target}`
      : `${source} — ${edge.label} → ${target}`;
  });
}
