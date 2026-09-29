// The panel the graph screen shows when a node is selected.
//
// It resolves the selected node back to the API records the builders derived it
// from: an agent node to its `GET /agents` record, a capability node to the
// agents that declare it and the handoff events that asked for it, a run node
// to the run and its events, and a turn node to the room turn. Selecting a node
// moves focus here, so a keyboard user hears the details without tabbing
// through the whole canvas.

import { useEffect, useRef } from "react";

import type { Agent } from "../agents/agent";
import type { Room, RoomRun } from "../rooms/room";
import { eventDetails, eventLabel, formatTime, runStatusLabel } from "../runs/run";
import {
  agentRunHistory,
  capabilityHandoffStats,
  graphNodeStatusLabel,
  type GraphNode,
  type KnownRun,
} from "./graph";

interface GraphDetailProps {
  node: GraphNode | null;
  agents: Agent[];
  knownRuns: KnownRun[];
  room: Room | null;
  roomRun: RoomRun | null;
}

export function GraphDetail({ node, agents, knownRuns, room, roomRun }: GraphDetailProps) {
  const panelRef = useRef<HTMLElement>(null);
  const nodeId = node?.id ?? null;

  useEffect(() => {
    if (nodeId !== null) {
      panelRef.current?.focus();
    }
  }, [nodeId]);

  if (node === null) {
    return (
      <section aria-labelledby="graph-detail-heading">
        <h3 id="graph-detail-heading">Seçili düğüm</h3>
        <p>
          Graf üzerinde Tab ile düğümler arasında gezinip Enter veya boşlukla bir düğüm seç; ayrıntılar
          burada görünür.
        </p>
      </section>
    );
  }

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="graph-detail-heading"
      style={{ border: "1px solid #bbb", padding: "0 12px 12px", marginTop: 12 }}
    >
      <h3 id="graph-detail-heading">
        Seçili düğüm: {node.label}
        {graphNodeStatusLabel(node) !== null ? ` · ${graphNodeStatusLabel(node)}` : ""}
      </h3>
      {node.kind === "agent" ? (
        <AgentDetail node={node} agents={agents} knownRuns={knownRuns} />
      ) : node.kind === "capability" ? (
        <CapabilityDetail node={node} agents={agents} knownRuns={knownRuns} />
      ) : node.kind === "turn" ? (
        <TurnDetail node={node} room={room} roomRun={roomRun} />
      ) : (
        <RunDetail node={node} knownRuns={knownRuns} />
      )}
    </section>
  );
}

function AgentDetail({
  node,
  agents,
  knownRuns,
}: {
  node: GraphNode;
  agents: Agent[];
  knownRuns: KnownRun[];
}) {
  const agent = agents.find((item) => item.id === node.agentId) ?? null;
  const history = node.agentId === null ? [] : agentRunHistory(knownRuns, node.agentId);

  return (
    <>
      {agent === null ? (
        <p>
          Bu ajan için <code>GET /agents</code> kaydı yok; ad, çalıştırma anlık görüntüsünden geliyor.
        </p>
      ) : (
        <>
          <dl>
            <dt>Durum</dt>
            <dd>{agent.enabled ? "Etkin" : "Devre dışı"}</dd>
            <dt>Sağlayıcı / model</dt>
            <dd>
              {agent.model_provider} / {agent.model_name}
              {agent.model_reasoning_effort !== null ? ` · ${agent.model_reasoning_effort}` : ""}
            </dd>
            <dt>Yetenekler</dt>
            <dd>{agent.capabilities.length > 0 ? agent.capabilities.join(", ") : "—"}</dd>
            <dt>Araç izinleri</dt>
            <dd>{agent.tool_ids.length > 0 ? agent.tool_ids.join(", ") : "—"}</dd>
            <dt>Sürüm</dt>
            <dd>{agent.version}</dd>
          </dl>
          {agent.description !== "" ? <p>{agent.description}</p> : null}
        </>
      )}
      <h4>Çalıştırma geçmişi</h4>
      {history.length === 0 ? (
        <p>Yüklenen çalıştırmalarda bu ajan geçmiyor.</p>
      ) : (
        <ul>
          {history.map((entry) => (
            <li key={entry.run.id}>
              {entry.run.label} · {runStatusLabel(entry.status)} · {entry.roles.join(", ")}
              {entry.run.errorCode !== null ? ` · ${entry.run.errorCode}` : ""}{" "}
              <small>({entry.run.id})</small>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CapabilityDetail({
  node,
  agents,
  knownRuns,
}: {
  node: GraphNode;
  agents: Agent[];
  knownRuns: KnownRun[];
}) {
  const capability = node.capability ?? node.label;
  const holders = agents.filter((agent) => agent.capabilities.includes(capability));
  const stats = capabilityHandoffStats(knownRuns, capability);

  return (
    <>
      <p>
        Bu yeteneği bildiren ajanlar:{" "}
        {holders.length === 0
          ? "—"
          : holders
              .map((agent) => (agent.enabled ? agent.name : `${agent.name} (devre dışı)`))
              .join(", ")}
      </p>
      <p>
        Devir olayları (yüklenen çalıştırmaların <code>run_events</code> kayıtlarından): istendi{" "}
        {stats.requested}, hedef bulundu {stats.resolved}, reddedildi {stats.rejected}
        {stats.rejectionReasons.length > 0 ? ` (${stats.rejectionReasons.join(", ")})` : ""}.
      </p>
    </>
  );
}

function RunDetail({ node, knownRuns }: { node: GraphNode; knownRuns: KnownRun[] }) {
  const run = knownRuns.find((item) => item.id === node.runId) ?? null;

  if (run === null) {
    return (
      <p>
        Bu çalıştırmanın kaydı yüklenemedi. Kimlik: <code>{node.runId}</code>.
      </p>
    );
  }

  return (
    <>
      <p>
        {run.label} · {runStatusLabel(run.status)}
        {run.errorCode !== null ? ` · ${run.errorCode}` : ""} ·{" "}
        {run.origin === "chat" ? "sohbet" : "grup odası"}
      </p>
      <p>
        Görev alan ajanlar:{" "}
        {run.agents.length === 0
          ? "—"
          : run.agents
              .map(
                (agent) =>
                  `${agent.agentName} (${agent.roles.join(", ")} · ${runStatusLabel(agent.status)})`,
              )
              .join("; ")}
      </p>
      <h4>Olaylar</h4>
      {run.events.length === 0 ? (
        <p>Bu çalıştırmada olay kaydı yok.</p>
      ) : (
        <ol>
          {run.events.map((event) => {
            const details = eventDetails(event);
            return (
              <li key={event.sequence}>
                {eventLabel(event.type)} · {formatTime(event.created_at)}
                {details.length > 0 ? ` · ${details.join(" · ")}` : ""}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

function TurnDetail({
  node,
  room,
  roomRun,
}: {
  node: GraphNode;
  room: Room | null;
  roomRun: RoomRun | null;
}) {
  const turn =
    roomRun === null
      ? null
      : (roomRun.turns.find((item) => item.position === node.position) ?? null);
  const turnEvents =
    roomRun === null
      ? []
      : roomRun.events.filter((event) => event.payload.position === node.position);

  return (
    <>
      {room !== null ? <p>Oda: {room.name}</p> : null}
      {turn === null ? (
        <p>Bu turun kaydı yüklenemedi.</p>
      ) : (
        <>
          <p>
            {turn.position}. tur · {turn.phase === "moderator_summary" ? "Moderatör özeti" : "Katkı"} ·{" "}
            {runStatusLabel(turn.status)}
            {turn.is_moderator ? " · Moderatör" : ""}
          </p>
          {turn.content !== null && turn.content !== "" ? <p>{turn.content}</p> : null}
        </>
      )}
      <h4>Tur olayları</h4>
      {turnEvents.length === 0 ? (
        <p>Bu tur için olay kaydı yok.</p>
      ) : (
        <ol>
          {turnEvents.map((event) => (
            <li key={event.sequence}>
              {eventLabel(event.type)} · {formatTime(event.created_at)}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
