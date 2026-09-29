import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/client";
import { apiErrorMessage } from "../api/errorMessage";
import {
  parseAttempt,
  parseIntegrations,
  preferredMethod,
  type ConnectionAttempt,
  type Integration,
} from "./connection";

export const INTEGRATIONS_QUERY_KEY = ["opencode", "integrations"] as const;
const CONNECTION_QUERY_KEY = ["opencode", "connection"] as const;
const STATUS_POLL_MS = 2000;

/** The integrations the server offers, with their sign-in methods. */
export function useIntegrations() {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/opencode/integrations");
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseIntegrations(data);
    },
  });
}

/**
 * Starts one sign-in with the integration's preferred method. The attempt is
 * owned by the API worker that answered; the screen keeps its id and polls it.
 */
export function useStartConnection() {
  return useMutation({
    mutationFn: async (integration: Integration) => {
      const method = preferredMethod(integration);
      if (method === null) {
        throw new Error("Bu sağlayıcı için giriş yöntemi yok.");
      }
      const { data, error, response } = await api.POST("/opencode/connections", {
        body: { integration: integration.id, method: method.id },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseAttempt(data);
    },
  });
}

/**
 * One attempt's status. The query polls while the attempt is waiting and stops
 * as soon as the server reports `complete` or `failed`.
 */
export function useConnectionStatus(attemptId: string | null) {
  return useQuery({
    queryKey: [...CONNECTION_QUERY_KEY, attemptId],
    enabled: attemptId !== null,
    refetchInterval: (query) => {
      const attempt = query.state.data;
      return attempt && attempt.status !== "waiting" ? false : STATUS_POLL_MS;
    },
    queryFn: async () => {
      const { data, error, response } = await api.GET("/opencode/connections/{attempt_id}", {
        params: { path: { attempt_id: attemptId as string } },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseAttempt(data);
    },
  });
}

/** Sends the human's code to a `code`-mode attempt. */
export function useSubmitConnectionCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ attemptId, code }: { attemptId: string; code: string }) => {
      const { data, error, response } = await api.POST("/opencode/connections/{attempt_id}/code", {
        params: { path: { attempt_id: attemptId } },
        body: { code },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseAttempt(data);
    },
    onSuccess: (attempt: ConnectionAttempt) => {
      queryClient.setQueryData([...CONNECTION_QUERY_KEY, attempt.attempt_id], attempt);
    },
  });
}

/** Stops an attempt and releases its process. */
export function useCancelConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attemptId: string) => {
      const { error, response } = await api.DELETE("/opencode/connections/{attempt_id}", {
        params: { path: { attempt_id: attemptId } },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return attemptId;
    },
    onSuccess: (attemptId: string) => {
      queryClient.removeQueries({ queryKey: [...CONNECTION_QUERY_KEY, attemptId] });
    },
  });
}
