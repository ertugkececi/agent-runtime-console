// The graph screen: the agent–capability graph, the handoff chain of the
// stored chat, and a room's participant flow.
//
// Every node is derived from API reads (see graph.ts); the screen only picks
// the view and follows the selection. The chat run ids come from the stored
// conversation, the room ids from the same storage the room screen uses, and
// nothing is entered by hand.

import { useState } from "react";

import { useAgentList } from "../agents/useAgents";
import { useChatConversation } from "../chat/useChat";
import { useRoom, useRoomRun, useRoomRuns } from "../rooms/useRooms";
import { runStatusLabel } from "../runs/run";
import {
  ACTIVE_ROOM_STORAGE_KEY,
  CONVERSATION_STORAGE_KEY,
  readSavedRooms,
} from "../storage";
import { GraphCanvas } from "./GraphCanvas";
import { GraphDetail } from "./GraphDetail";
import {
  agentNameMap,
  buildAgentCapabilityGraph,
  buildHandoffGraph,
  buildRoomFlowGraph,
  chatKnownRun,
  conversationRunIds,
  graphEdgeTexts,
  graphNodeText,
  roomKnownRun,
  type GraphView,
  type HandoffRun,
  type KnownRun,
} from "./graph";
import { useGraphRuns } from "./useGraph";

// The API has no "list runs" endpoint; a conversation's runs are the ones its
// messages record. The graph reads the most recent ones and says so, instead
// of asking for every run a long conversation ever had.
const MAX_GRAPH_RUNS = 20;

type GraphViewName = "agents" | "handoff" | "room";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Bilinmeyen hata.";
}

export function GraphScreen() {
  const [viewName, setViewName] = useState<GraphViewName>("agents");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Agents: the agent–capability graph and the names behind every snapshot.
  const agentsQuery = useAgentList("");
  const agents = agentsQuery.data ?? [];
  const agentNames = agentNameMap(agents);

  // The stored conversation is where the handoff view gets its run ids.
  const [conversationId] = useState<string | null>(() =>
    window.localStorage.getItem(CONVERSATION_STORAGE_KEY),
  );
  const conversationQuery = useChatConversation(conversationId);
  const conversation = conversationQuery.data ?? null;
  const runIds = conversation === null ? [] : conversationRunIds(conversation.messages);
  const runOrdinals = new Map(runIds.map((id, index) => [id, index + 1]));
  const shownRunIds = runIds.slice(-MAX_GRAPH_RUNS);
  const graphRunsQuery = useGraphRuns(shownRunIds);
  const handoffs: HandoffRun[] = graphRunsQuery.runs.map((run) => ({
    run,
    ordinal: runOrdinals.get(run.id) ?? 0,
  }));

  // Rooms: the ids this browser recorded on the room screen.
  const [savedRooms] = useState(() => readSavedRooms());
  const [roomId, setRoomId] = useState<string | null>(() =>
    window.localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY),
  );
  const roomQuery = useRoom(roomId);
  const room = roomQuery.data ?? null;
  const roomRunsQuery = useRoomRuns(roomId);
  const roomRuns = roomRunsQuery.data ?? [];
  const [chosenRoomRunId, setChosenRoomRunId] = useState<string | null>(null);
  const newestRoomRunId = roomRuns[0]?.id ?? null;
  const flowRunId = chosenRoomRunId ?? newestRoomRunId;
  const flowRunQuery = useRoomRun(viewName === "room" ? flowRunId : null);
  const flowRun =
    flowRunQuery.data ?? roomRuns.find((run) => run.id === flowRunId) ?? null;
  const flowOrdinalIndex = roomRuns.findIndex((run) => run.id === flowRunId);
  const flowOrdinal = flowOrdinalIndex === -1 ? null : roomRuns.length - flowOrdinalIndex;

  const agentView = buildAgentCapabilityGraph(agents);
  const handoffView = buildHandoffGraph(handoffs, agentNames);
  const roomView =
    room === null ? { nodes: [], edges: [] } : buildRoomFlowGraph(room, flowRun, flowOrdinal);
  const activeView: GraphView =
    viewName === "agents" ? agentView : viewName === "handoff" ? handoffView : roomView;

  // The run history an agent node can list: the conversation's runs and the
  // selected room's runs, each from the reads this screen already made.
  const knownRuns: KnownRun[] = [
    ...graphRunsQuery.runs.map((run) =>
      chatKnownRun(run, runOrdinals.get(run.id) ?? 0, agentNames),
    ),
    ...roomRuns
      .slice()
      .reverse()
      .map((run, index) => roomKnownRun(run, index + 1)),
  ];

  const selectedNode = activeView.nodes.find((node) => node.id === selectedId) ?? null;

  function switchView(next: GraphViewName) {
    setViewName(next);
    setSelectedId(null);
  }

  const loadingAgents = agentsQuery.isPending;
  const noAgents = agentsQuery.isSuccess && agents.length === 0;

  return (
    <section aria-labelledby="graph-heading">
      <h2 id="graph-heading">Graf görünümü</h2>
      <p>
        Ajanları, yetenek eşleşmelerini, devir zincirini ve oda akışını düğüm–kenar olarak gösterir.
        Düğümler <code>agents</code>, <code>agent_capabilities</code>, <code>runs</code> ve{" "}
        <code>run_events</code> verisinden türetilir; graf otomatik yerleşir, elle sürükleme gerekmez.
        Tab ile düğümler arasında gezin, Enter veya boşlukla seç.
      </p>

      <nav aria-label="Graf görünümleri">
        <button
          type="button"
          aria-pressed={viewName === "agents"}
          onClick={() => switchView("agents")}
        >
          Ajan–yetenek
        </button>{" "}
        <button
          type="button"
          aria-pressed={viewName === "handoff"}
          onClick={() => switchView("handoff")}
        >
          Devir zinciri
        </button>{" "}
        <button type="button" aria-pressed={viewName === "room"} onClick={() => switchView("room")}>
          Oda akışı
        </button>
      </nav>

      {viewName === "handoff" && graphRunsQuery.failed > 0 ? (
        <p role="alert">
          {graphRunsQuery.failed} çalıştırma yüklenemedi; graf yalnızca yüklenen veriyi gösteriyor.
        </p>
      ) : null}
      {viewName === "handoff" && runIds.length > MAX_GRAPH_RUNS ? (
        <p>
          <small>
            Devir zinciri son {MAX_GRAPH_RUNS} çalıştırmayı kapsar ({runIds.length} çalıştırmadan).
          </small>
        </p>
      ) : null}

      {viewName === "room" ? (
        <p>
          <label htmlFor="graph-room-select">Oda</label>{" "}
          <select
            id="graph-room-select"
            value={roomId ?? ""}
            onChange={(event) => {
              setRoomId(event.target.value === "" ? null : event.target.value);
              setChosenRoomRunId(null);
              setSelectedId(null);
            }}
          >
            <option value="">Oda seç</option>
            {savedRooms.map((saved) => (
              <option key={saved.id} value={saved.id}>
                {saved.name}
              </option>
            ))}
          </select>{" "}
          {roomRuns.length > 0 ? (
            <>
              <label htmlFor="graph-room-run-select">Çalıştırma</label>{" "}
              <select
                id="graph-room-run-select"
                value={flowRunId ?? ""}
                onChange={(event) => {
                  setChosenRoomRunId(event.target.value === "" ? null : event.target.value);
                  setSelectedId(null);
                }}
              >
                {roomRuns
                  .slice()
                  .reverse()
                  .map((run, index) => (
                    <option key={run.id} value={run.id}>
                      Oda çalıştırması {index + 1} · {runStatusLabel(run.status)}
                    </option>
                  ))}
              </select>
            </>
          ) : null}
        </p>
      ) : null}

      {viewName === "agents" && loadingAgents ? <p role="status">Ajanlar yükleniyor…</p> : null}
      {viewName === "agents" && agentsQuery.isError ? (
        <p role="alert">Ajanlar yüklenemedi: {errorText(agentsQuery.error)}</p>
      ) : null}
      {viewName === "agents" && noAgents ? (
        <p>Graf için önce Ajanlar ekranından bir ajan oluştur.</p>
      ) : null}

      {viewName === "handoff" && conversationId === null ? (
        <p>Sohbet geçmişi olmadan devir zinciri yok. Sohbet ekranından bir konuşma başlat.</p>
      ) : null}
      {viewName === "handoff" && conversationQuery.isError ? (
        <p role="alert">Sohbet yüklenemedi: {errorText(conversationQuery.error)}</p>
      ) : null}
      {viewName === "handoff" && conversationQuery.isPending ? (
        <p role="status">Sohbet yükleniyor…</p>
      ) : null}
      {viewName === "handoff" && conversationQuery.isSuccess && graphRunsQuery.pending ? (
        <p role="status">Çalıştırmalar yükleniyor…</p>
      ) : null}
      {viewName === "handoff" &&
      conversationQuery.isSuccess &&
      !graphRunsQuery.pending &&
      handoffs.length === 0 ? (
        <p>Bu sohbette henüz çalıştırma yok.</p>
      ) : null}

      {viewName === "room" && savedRooms.length === 0 ? (
        <p>Bu tarayıcıda kayıtlı oda yok. Grup odaları ekranından bir oda oluştur.</p>
      ) : null}
      {viewName === "room" && roomId !== null && roomQuery.isPending ? (
        <p role="status">Oda yükleniyor…</p>
      ) : null}
      {viewName === "room" && roomQuery.isError ? (
        <p role="alert">Oda yüklenemedi: {errorText(roomQuery.error)}</p>
      ) : null}
      {viewName === "room" && roomRunsQuery.isError ? (
        <p role="alert">Oda çalıştırmaları yüklenemedi: {errorText(roomRunsQuery.error)}</p>
      ) : null}
      {viewName === "room" && room !== null && roomRuns.length === 0 ? (
        <p>Bu odada henüz görev yok; katılımcı sırası gösteriliyor.</p>
      ) : null}
      {viewName === "room" && room !== null && roomRuns.length > 0 && flowRun === null ? (
        <p role="status">Çalıştırma yükleniyor…</p>
      ) : null}

      {activeView.nodes.length > 0 ? (
        <>
          <p>
            <small>
              {viewName === "agents"
                ? "Mavi düğümler ajan, yeşil düğümler yetenek; bağlantı ajanın yeteneği bildirdiğini gösterir."
                : viewName === "handoff"
                  ? "Mor düğümler çalıştırma, mavi düğümler ajan; kenar etiketi devredilen yetenektir."
                  : "Mor düğüm çalıştırma, sarı düğümler turlar; sıra numarası konuşma sırasıdır."}
            </small>
          </p>
          <GraphCanvas
            view={activeView}
            direction={viewName === "agents" ? "RIGHT" : "DOWN"}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <details>
            <summary>Graf metin özeti</summary>
            <p>Düğümler</p>
            <ul>
              {activeView.nodes.map((node) => (
                <li key={node.id}>{graphNodeText(node)}</li>
              ))}
            </ul>
            <p>Bağlantılar</p>
            {activeView.edges.length === 0 ? (
              <p>Bağlantı yok.</p>
            ) : (
              <ul>
                {graphEdgeTexts(activeView).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </details>
        </>
      ) : null}

      <GraphDetail
        node={selectedNode}
        agents={agents}
        knownRuns={knownRuns}
        room={room}
        roomRun={flowRun}
      />
    </section>
  );
}
