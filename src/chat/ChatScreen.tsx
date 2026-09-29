import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAgentList } from "../agents/useAgents";
import { errorText } from "../api/errorMessage";
import { isActiveStatus, isTerminalStatus, runStatusLabel } from "../runs/run";
import { CONVERSATION_STORAGE_KEY } from "../storage";
import { EmptyState, ErrorState, LoadingState, StatusLine } from "../ui/Status";
import { newestRunId, type ChatMessage } from "./chat";
import { RunTimeline } from "./RunTimeline";
import {
  CONVERSATIONS_QUERY_KEY,
  useChatConversation,
  useChatRun,
  useCreateChatConversation,
  useSendChatMessage,
} from "./useChat";

// The last chat is restored on refresh, exactly like the single-file interface
// did. The conversation id (shared with the graph screen, see src/storage.ts)
// is what makes the history load; the agent id keeps the picker where the user
// left it.
const AGENT_STORAGE_KEY = "agentRuntimeConsoleAgentId";

export function ChatScreen() {
  const queryClient = useQueryClient();
  const [storedConversationId, setStoredConversationId] = useState<string | null>(() =>
    window.localStorage.getItem(CONVERSATION_STORAGE_KEY),
  );
  const [storedAgentId, setStoredAgentId] = useState<string>(
    () => window.localStorage.getItem(AGENT_STORAGE_KEY) ?? "",
  );
  const [acceptedRunId, setAcceptedRunId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const agentsQuery = useAgentList("");
  const agents = agentsQuery.data ?? [];
  const enabledAgents = agents.filter((agent) => agent.enabled);

  // A stored agent that is no longer enabled cannot receive messages; the
  // picker falls back to the first enabled agent without touching storage, so
  // a re-enabled agent is picked up again on the next visit.
  const agentId = enabledAgents.some((agent) => agent.id === storedAgentId)
    ? storedAgentId
    : (enabledAgents[0]?.id ?? "");
  const storedAgentUnavailable =
    agentsQuery.isSuccess &&
    enabledAgents.length > 0 &&
    !enabledAgents.some((agent) => agent.id === storedAgentId);

  const conversationQuery = useChatConversation(storedConversationId);
  // A conversation that belonged to another agent — for example after the
  // stored agent was disabled — is not a chat this screen can continue; it
  // starts clean instead.
  const conversation =
    conversationQuery.data !== null &&
    conversationQuery.data !== undefined &&
    conversationQuery.data.agent_ids.includes(agentId)
      ? conversationQuery.data
      : null;
  const conversationLoading = storedConversationId !== null && conversationQuery.isPending;
  const conversationFailed = storedConversationId !== null && conversationQuery.isError;

  // The run to follow: the one just accepted, otherwise the newest user message
  // of the restored conversation — which is what resumes a long run on refresh.
  const watchedRunId = acceptedRunId ?? newestRunId(conversation?.messages ?? []);
  const runQuery = useChatRun(watchedRunId);
  const run = runQuery.data ?? null;

  const createConversation = useCreateChatConversation();
  const sendMessage = useSendChatMessage();

  // The id of a conversation the API does not know any more is dropped, so the
  // next visit starts a new chat instead of asking for the same 404.
  useEffect(() => {
    if (conversationQuery.data === null) {
      window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    }
  }, [conversationQuery.data]);

  // When the followed run reaches `completed`/`failed`, the conversation is
  // refetched so the agent's answer (or the failure) shows in the history. The
  // effect keys on ids, not objects: a refetch must not invalidate again.
  const runStatus = run?.status ?? null;
  const conversationIdForRun = conversation?.id ?? null;
  useEffect(() => {
    if (runStatus !== null && isTerminalStatus(runStatus) && conversationIdForRun !== null) {
      void queryClient.invalidateQueries({
        queryKey: [...CONVERSATIONS_QUERY_KEY, conversationIdForRun],
      });
    }
  }, [runStatus, conversationIdForRun, queryClient]);

  const runActive = run !== null && isActiveStatus(run.status);
  const runStateUnknown = watchedRunId !== null && runQuery.isPending;
  const busy = runActive || runStateUnknown;
  const canSend =
    agentId !== "" &&
    draft.trim() !== "" &&
    !busy &&
    !sendMessage.isPending &&
    !conversationLoading &&
    !conversationFailed;

  function resetChat() {
    window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    setStoredConversationId(null);
    setAcceptedRunId(null);
    setDraft("");
    setError(null);
  }

  function changeAgent(next: string) {
    setStoredAgentId(next);
    window.localStorage.setItem(AGENT_STORAGE_KEY, next);
    resetChat();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!canSend || content === "") {
      return;
    }
    setError(null);
    try {
      let targetId = conversation?.id ?? null;
      if (targetId === null) {
        const created = await createConversation.mutateAsync(agentId);
        targetId = created.id;
        window.localStorage.setItem(CONVERSATION_STORAGE_KEY, targetId);
        window.localStorage.setItem(AGENT_STORAGE_KEY, agentId);
        setStoredAgentId(agentId);
        setStoredConversationId(targetId);
      }
      const accepted = await sendMessage.mutateAsync({ conversationId: targetId, content });
      setDraft("");
      setAcceptedRunId(accepted.id);
    } catch (submitError) {
      setError(errorText(submitError));
    }
  }

  const messages = conversation?.messages ?? [];
  const senderName = (message: ChatMessage) =>
    message.sender_type === "user"
      ? "Sen"
      : (agents.find((agent) => agent.id === message.sender_agent_id)?.name ?? "Ajan");

  let statusLine = "Etkin bir ajan seçip mesaj yazabilirsin.";
  if (enabledAgents.length === 0 && agentsQuery.isSuccess) {
    statusLine = "Sohbete başlamak için önce bir ajan oluştur.";
  } else if (storedAgentUnavailable) {
    statusLine = "Seçili ajan devre dışı; yerine etkin bir ajan seçildi. Yeni sohbet başlatabilirsin.";
  } else if (createConversation.isPending || sendMessage.isPending) {
    statusLine = "Mesaj kuyruğa gönderiliyor…";
  } else if (run !== null) {
    statusLine = runStatusLabel(run.status);
    if (run.queue) {
      statusLine += ` · Deneme ${run.queue.attempts}/${run.queue.max_attempts}`;
    }
    if (run.error_code) {
      statusLine += ` · ${run.error_code}`;
    }
  }

  return (
    <section className="screen" aria-labelledby="chat-heading">
      <h2 id="chat-heading" tabIndex={-1}>
        Sohbet
      </h2>
      <p>
        Etkin bir ajanla insan-ajan sohbeti. Gönderim kuyruğa alınır; çalıştırma durumu ve
        olayları bu ekranda canlı izlenir.
      </p>
      {agentsQuery.isPending ? <LoadingState>Ajanlar yükleniyor…</LoadingState> : null}
      {agentsQuery.isError ? (
        <ErrorState>Ajanlar yüklenemedi: {errorText(agentsQuery.error)}</ErrorState>
      ) : null}
      <p>
        <label htmlFor="chat-agent">Ajan</label>{" "}
        <select
          id="chat-agent"
          value={agentId}
          onChange={(event) => changeAgent(event.target.value)}
          disabled={agentsQuery.isPending || enabledAgents.length === 0}
        >
          {agentId === "" ? <option value="">Ajan seç</option> : null}
          {enabledAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>{" "}
        <button type="button" onClick={resetChat}>
          Yeni sohbet
        </button>
      </p>
      {conversationFailed ? (
        <ErrorState>Sohbet yüklenemedi: {errorText(conversationQuery.error)}</ErrorState>
      ) : null}
      <h3>{conversation !== null ? "Sohbet geçmişi" : "Yeni sohbet"}</h3>
      {conversationLoading ? (
        <LoadingState>Sohbet yükleniyor…</LoadingState>
      ) : messages.length === 0 ? (
        <EmptyState>Henüz mesaj yok.</EmptyState>
      ) : (
        <ol aria-label="Sohbet mesajları">
          {messages.map((message) => (
            <li key={message.id}>
              <strong>{senderName(message)}:</strong> {message.content}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={(event) => void handleSubmit(event)}>
        <p>
          <label htmlFor="chat-message">Mesaj</label>
          <textarea
            id="chat-message"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={enabledAgents.length === 0}
          />
        </p>
        <p>
          <button type="submit" disabled={!canSend}>
            Gönder
          </button>
        </p>
      </form>
      <StatusLine>{statusLine}</StatusLine>
      {busy ? <p>Çalıştırma sürüyor; ikinci mesaj için tamamlanmasını bekle.</p> : null}
      {error !== null ? <ErrorState>{error}</ErrorState> : null}
      {runQuery.isError ? (
        <ErrorState>Çalıştırma durumu alınamadı: {errorText(runQuery.error)}</ErrorState>
      ) : null}
      {run !== null ? <RunTimeline run={run} /> : null}
    </section>
  );
}
