import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/client";
import { apiErrorMessage } from "../api/errorMessage";
import { isTerminalStatus } from "../runs/run";
import {
  parseChatConversation,
  parseChatRun,
  parseEnqueuedRun,
  type ChatConversation,
  type ChatRun,
} from "./chat";

export const CONVERSATIONS_QUERY_KEY = ["conversations"] as const;
export const RUNS_QUERY_KEY = ["runs"] as const;

/**
 * A run in `queued`/`running` is polled, which is what makes the timeline and
 * the status line live; a terminal run is fetched once and then left alone.
 */
const RUN_POLL_INTERVAL_MS = 1500;

/**
 * The stored conversation, loaded on refresh. A `null` answer means the id is
 * not a conversation any more (the screen starts a new chat instead of showing
 * a dead view), which is why a 404 is not an error here.
 */
export function useChatConversation(conversationId: string | null) {
  return useQuery({
    queryKey: [...CONVERSATIONS_QUERY_KEY, conversationId],
    enabled: conversationId !== null,
    queryFn: async (): Promise<ChatConversation | null> => {
      if (conversationId === null) {
        throw new Error("Sohbet kimliği yok.");
      }
      const { data, error, response } = await api.GET("/conversations/{conversation_id}", {
        params: { path: { conversation_id: conversationId } },
      });
      if (response.status === 404) {
        return null;
      }
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseChatConversation(data);
    },
  });
}

/** One run followed by `GET /runs/{run_id}`, polled until it is terminal. */
export function useChatRun(runId: string | null) {
  return useQuery({
    queryKey: [...RUNS_QUERY_KEY, runId],
    enabled: runId !== null,
    queryFn: async (): Promise<ChatRun> => {
      if (runId === null) {
        throw new Error("Çalıştırma kimliği yok.");
      }
      const { data, error, response } = await api.GET("/runs/{run_id}", {
        params: { path: { run_id: runId } },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseChatRun(data);
    },
    refetchInterval: (query) => {
      const run = query.state.data;
      return run !== undefined && isTerminalStatus(run.status) ? false : RUN_POLL_INTERVAL_MS;
    },
  });
}

/** POST /chat/conversations: a conversation with one enabled agent. */
export function useCreateChatConversation() {
  return useMutation({
    mutationFn: async (agentId: string) => {
      const { data, error, response } = await api.POST("/chat/conversations", {
        body: { agent_id: agentId },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseChatConversation(data);
    },
  });
}

/**
 * POST /chat/conversations/{id}/messages/async: the 202 answer names the run to
 * follow. The user message is persisted before the answer, so the conversation
 * is refreshed right away.
 */
export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      const { data, error, response } = await api.POST(
        "/chat/conversations/{conversation_id}/messages/async",
        {
          params: { path: { conversation_id: conversationId } },
          body: { content },
        },
      );
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseEnqueuedRun(data);
    },
    onSuccess: (_accepted, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...CONVERSATIONS_QUERY_KEY, variables.conversationId],
      });
    },
  });
}
