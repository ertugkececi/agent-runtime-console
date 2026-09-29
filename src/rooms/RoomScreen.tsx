import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAgentList } from "../agents/useAgents";
import { isActiveStatus, isTerminalStatus, runStatusLabel } from "../runs/run";
import {
  ACTIVE_ROOM_STORAGE_KEY,
  readSavedRooms,
  writeSavedRooms,
  type SavedRoom,
} from "../storage";
import { RoomRunView } from "./RoomRunView";
import {
  ROOM_RUNS_QUERY_KEY,
  useCreateRoom,
  useEnqueueRoomRun,
  useRoom,
  useRoomRun,
  useRoomRuns,
} from "./useRooms";

const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 5;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Bilinmeyen hata.";
}

export function RoomScreen() {
  const queryClient = useQueryClient();

  // The saved list and the open room are this browser's memory of the server
  // records; a refresh restores both, and with them a run still in progress.
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>(readSavedRooms);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    window.localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY),
  );
  const [selectedRoomId, setSelectedRoomId] = useState(
    () => window.localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY) ?? "",
  );

  // Room creation: the selection order is the speaking order.
  const [roomName, setRoomName] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [moderatorChoice, setModeratorChoice] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // The task composer and the run being followed.
  const [taskDraft, setTaskDraft] = useState("");
  const [acceptedRunId, setAcceptedRunId] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);

  const agentsQuery = useAgentList("");
  const agents = agentsQuery.data ?? [];
  const enabledAgents = agents.filter((agent) => agent.enabled);

  const roomQuery = useRoom(activeRoomId);
  const runsQuery = useRoomRuns(activeRoomId);
  const runs = runsQuery.data ?? [];

  // The run to follow: the one just accepted, otherwise the newest run the
  // platform still holds in `queued`/`running` — which is what resumes a long
  // run on refresh.
  const pendingRunId = runs.find((run) => isActiveStatus(run.status))?.id ?? null;
  const watchedRunId = acceptedRunId ?? pendingRunId;
  const watchedRunQuery = useRoomRun(watchedRunId);
  const watchedRun = watchedRunQuery.data ?? null;

  const createRoom = useCreateRoom();
  const enqueueRun = useEnqueueRoomRun();

  // The moderator is always one of the participants: the select offers exactly
  // them, and a removed moderator falls back to the first participant.
  const moderatorId = participantIds.includes(moderatorChoice)
    ? moderatorChoice
    : (participantIds[0] ?? "");

  // The API lists runs newest first; the screen reads them oldest first, with
  // the followed run's freshest state in place.
  const history = [...runs].reverse();
  const shownRuns =
    watchedRun === null
      ? history
      : history.some((run) => run.id === watchedRun.id)
        ? history.map((run) => (run.id === watchedRun.id ? watchedRun : run))
        : [...history, watchedRun];

  const room = roomQuery.data ?? null;
  const roster =
    room?.participants
      .map((participant) =>
        participant.is_moderator
          ? `${participant.agent_name} (moderatör)`
          : participant.agent_name,
      )
      .join(" → ") ?? "";

  // When the followed run reaches `completed`/`failed`, the history is
  // refetched so the stored final state is what stays on screen. The effect
  // keys on the status, not the object: a refetch must not invalidate again.
  const watchedStatus = watchedRun?.status ?? null;
  useEffect(() => {
    if (watchedStatus !== null && isTerminalStatus(watchedStatus) && activeRoomId !== null) {
      void queryClient.invalidateQueries({ queryKey: [...ROOM_RUNS_QUERY_KEY, activeRoomId] });
    }
  }, [watchedStatus, activeRoomId, queryClient]);

  // The saved list is this browser's memory of the rooms it opened; it is
  // written back whenever it changes.
  useEffect(() => {
    writeSavedRooms(savedRooms);
  }, [savedRooms]);

  function rememberRoom(room: SavedRoom) {
    setSavedRooms((current) => [room, ...current.filter((item) => item.id !== room.id)]);
  }

  function openRoom(roomId: string, name?: string) {
    if (name !== undefined) {
      rememberRoom({ id: roomId, name });
    }
    setActiveRoomId(roomId);
    setSelectedRoomId(roomId);
    window.localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, roomId);
    setAcceptedRunId(null);
    setTaskDraft("");
    setRoomError(null);
  }

  function toggleParticipant(agentId: string, checked: boolean) {
    if (!checked && moderatorChoice === agentId) {
      setModeratorChoice("");
    }
    setParticipantIds((current) => {
      if (checked) {
        if (current.includes(agentId) || current.length >= MAX_PARTICIPANTS) {
          return current;
        }
        return [...current, agentId];
      }
      return current.filter((id) => id !== agentId);
    });
  }

  function moveParticipant(index: number, step: number) {
    setParticipantIds((current) => {
      const target = index + step;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const canCreateRoom =
    roomName.trim() !== "" &&
    participantIds.length >= MIN_PARTICIPANTS &&
    participantIds.length <= MAX_PARTICIPANTS &&
    moderatorId !== "" &&
    !createRoom.isPending;

  async function handleCreateRoom(event: FormEvent) {
    event.preventDefault();
    const name = roomName.trim();
    if (!canCreateRoom || name === "") {
      return;
    }
    setCreateError(null);
    try {
      const created = await createRoom.mutateAsync({
        name,
        participant_agent_ids: participantIds,
        moderator_agent_id: moderatorId,
      });
      openRoom(created.id, created.name);
    } catch (error) {
      setCreateError(errorText(error));
    }
  }

  const runActive = watchedRun !== null && isActiveStatus(watchedRun.status);
  const runStateUnknown = watchedRunId !== null && watchedRunQuery.isPending;
  const busy = runActive || runStateUnknown;
  const roomLoading = activeRoomId !== null && roomQuery.isPending;
  const canSend =
    room !== null && taskDraft.trim() !== "" && !busy && !enqueueRun.isPending && !roomLoading;

  async function handleSendTask(event: FormEvent) {
    event.preventDefault();
    const content = taskDraft.trim();
    if (!canSend || content === "" || activeRoomId === null) {
      return;
    }
    setRoomError(null);
    try {
      const accepted = await enqueueRun.mutateAsync({ roomId: activeRoomId, content });
      setTaskDraft("");
      setAcceptedRunId(accepted.id);
    } catch (error) {
      setRoomError(errorText(error));
    }
  }

  let statusLine = "";
  if (room !== null) {
    const lastRun = watchedRun ?? history.at(-1) ?? null;
    if (lastRun !== null) {
      statusLine = `Grup görevi ${runStatusLabel(lastRun.status).toLocaleLowerCase("tr-TR")}.`;
      if (lastRun.error_code !== null) {
        statusLine += ` · ${lastRun.error_code}`;
      }
    } else {
      statusLine = "Bu odada henüz görev yok.";
    }
  }

  const nameOf = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? agentId;

  return (
    <section aria-labelledby="rooms-heading">
      <h2 id="rooms-heading">Grup odaları</h2>
      <p>
        Sınırlı bir grup odasında 2–5 etkin ajanı sırayla çalıştır; katkıları ve
        moderatörün son yanıtını izle. Oda kayıtları sunucuda, oda kimlikleri bu
        tarayıcıda saklanır.
      </p>

      <section aria-labelledby="room-create-heading">
        <h3 id="room-create-heading">Yeni grup odası</h3>
        <p>
          Ajanları seçtiğin sıra konuşma sırasıdır; oklarla değiştirebilirsin. Bir odaya en az
          iki, en fazla beş ajan katılır ve moderatör katılımcılardan biri olur.
        </p>
        {agentsQuery.isPending ? <p>Ajanlar yükleniyor…</p> : null}
        {agentsQuery.isError ? (
          <p role="alert">Ajanlar yüklenemedi: {errorText(agentsQuery.error)}</p>
        ) : null}
        {agentsQuery.isSuccess && enabledAgents.length === 0 ? (
          <p>Grup odası oluşturmak için önce bir ajan oluştur.</p>
        ) : null}
        <form onSubmit={(event) => void handleCreateRoom(event)}>
          <p>
            <label htmlFor="room-name">Oda adı</label>
            <br />
            <input
              id="room-name"
              maxLength={120}
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
            />
          </p>
          <fieldset>
            <legend>Katılımcı ajanlar (2–5)</legend>
            {enabledAgents.map((agent) => (
              <div key={agent.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={participantIds.includes(agent.id)}
                    disabled={
                      !participantIds.includes(agent.id) &&
                      participantIds.length >= MAX_PARTICIPANTS
                    }
                    onChange={(event) => toggleParticipant(agent.id, event.target.checked)}
                  />{" "}
                  {agent.name}
                </label>
              </div>
            ))}
            {participantIds.length >= MAX_PARTICIPANTS ? (
              <p>
                <small>Bir odaya en fazla beş ajan katılabilir.</small>
              </p>
            ) : null}
          </fieldset>
          <h4>Konuşma sırası</h4>
          {participantIds.length === 0 ? (
            <p>
              <small>Henüz katılımcı seçilmedi.</small>
            </p>
          ) : (
            <ol aria-label="Ajan konuşma sırası">
              {participantIds.map((agentId, index) => (
                <li key={agentId}>
                  <span>
                    {index + 1}. {nameOf(agentId)}
                  </span>{" "}
                  <button
                    type="button"
                    aria-label={`${nameOf(agentId)} sırasını yukarı taşı`}
                    disabled={index === 0}
                    onClick={() => moveParticipant(index, -1)}
                  >
                    ↑
                  </button>{" "}
                  <button
                    type="button"
                    aria-label={`${nameOf(agentId)} sırasını aşağı taşı`}
                    disabled={index === participantIds.length - 1}
                    onClick={() => moveParticipant(index, 1)}
                  >
                    ↓
                  </button>
                </li>
              ))}
            </ol>
          )}
          <p>
            <label htmlFor="room-moderator">Moderatör</label>{" "}
            <select
              id="room-moderator"
              value={moderatorId}
              onChange={(event) => setModeratorChoice(event.target.value)}
              disabled={participantIds.length < MIN_PARTICIPANTS}
            >
              {participantIds.length < MIN_PARTICIPANTS ? (
                <option value="">Önce katılımcı seç</option>
              ) : null}
              {participantIds.map((agentId) => (
                <option key={agentId} value={agentId}>
                  {nameOf(agentId)}
                </option>
              ))}
            </select>
          </p>
          <p>
            <button type="submit" disabled={!canCreateRoom}>
              Odayı oluştur
            </button>
          </p>
        </form>
        {createError !== null ? <p role="alert">{createError}</p> : null}
      </section>

      <section aria-labelledby="room-open-heading">
        <h3 id="room-open-heading">Kayıtlı odalar</h3>
        {savedRooms.length === 0 ? (
          <p>Bu tarayıcıda kayıtlı oda yok.</p>
        ) : (
          <p>
            <label htmlFor="room-open-select">Oda</label>{" "}
            <select
              id="room-open-select"
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
            >
              <option value="">Oda seç</option>
              {savedRooms.map((saved) => (
                <option key={saved.id} value={saved.id}>
                  {saved.name}
                </option>
              ))}
            </select>{" "}
            <button
              type="button"
              disabled={selectedRoomId === "" || createRoom.isPending}
              onClick={() => openRoom(selectedRoomId)}
            >
              Aç
            </button>
          </p>
        )}
      </section>

      <section aria-labelledby="room-view-heading">
        <h3 id="room-view-heading">{room !== null ? room.name : "Grup odası"}</h3>
        {activeRoomId === null ? (
          <p>Henüz açık bir oda yok. Bir oda oluştur veya kayıtlı odalardan birini aç.</p>
        ) : null}
        {roomLoading ? <p>Oda yükleniyor…</p> : null}
        {roomQuery.isError ? (
          <p role="alert">Oda yüklenemedi: {errorText(roomQuery.error)}</p>
        ) : null}
        {room !== null ? (
          <>
            <p>Sıra: {roster}</p>
            <form onSubmit={(event) => void handleSendTask(event)}>
              <p>
                <label htmlFor="room-task">Görev</label>
                <br />
                <textarea
                  id="room-task"
                  rows={3}
                  value={taskDraft}
                  onChange={(event) => setTaskDraft(event.target.value)}
                  placeholder="Grup odasına vereceğin görevi yaz…"
                />
              </p>
              <p>
                <button type="submit" disabled={!canSend}>
                  Görevi gönder
                </button>
              </p>
            </form>
            <p role="status">{statusLine}</p>
            {busy ? <p>Grup görevi sürüyor; ikinci görev için tamamlanmasını bekle.</p> : null}
            <h4>Görev ve çalıştırma geçmişi</h4>
            {runsQuery.isPending ? <p>Geçmiş yükleniyor…</p> : null}
            {shownRuns.length === 0 && runsQuery.isSuccess ? (
              <p>Bu odada henüz görev yok.</p>
            ) : null}
            <ol aria-label="Grup odası çalıştırmaları">
              {shownRuns.map((run) => (
                <li key={run.id}>
                  <RoomRunView run={run} />
                </li>
              ))}
            </ol>
            {runsQuery.isError ? (
              <p role="alert">Görev geçmişi yüklenemedi: {errorText(runsQuery.error)}</p>
            ) : null}
            {watchedRunQuery.isError ? (
              <p role="alert">Çalıştırma durumu alınamadı: {errorText(watchedRunQuery.error)}</p>
            ) : null}
          </>
        ) : null}
        {roomError !== null ? <p role="alert">{roomError}</p> : null}
      </section>
    </section>
  );
}
