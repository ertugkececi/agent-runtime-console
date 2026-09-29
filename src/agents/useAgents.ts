import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/client";
import { apiErrorMessage } from "../api/errorMessage";
import {
  agentChanges,
  parseAgent,
  parseAgentList,
  parseProviderIds,
  type Agent,
  type AgentDraft,
} from "./agent";

const AGENTS_QUERY_KEY = ["agents"] as const;
const AGENT_CONFIG_QUERY_KEY = ["agent-config", "catalog"] as const;

/**
 * All registered agents. A non-empty capability switches to the backend's
 * exact-match filter (`GET /agents?capability=`), which returns enabled agents
 * only; the screen says so next to the filter.
 */
export function useAgentList(capability: string) {
  return useQuery({
    queryKey: [...AGENTS_QUERY_KEY, capability],
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/agents",
        capability ? { params: { query: { capability } } } : {},
      );
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseAgentList(data);
    },
  });
}

/** Provider IDs the platform is configured with; the API rejects any other. */
export function useProviderIds() {
  return useQuery({
    queryKey: AGENT_CONFIG_QUERY_KEY,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/agent-config/catalog");
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseProviderIds(data);
    },
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: AgentDraft) => {
      const { data, error, response } = await api.POST("/agents", { body: draft });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseAgent(data);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY }),
  });
}

/**
 * Saves only changed fields. There is no delete call anywhere in this module:
 * disabling is `PATCH {enabled: false}`, so the agent record keeps its id for
 * existing conversations and task snapshots.
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ agent, draft }: { agent: Agent; draft: AgentDraft }) => {
      const changes = agentChanges(agent, draft);
      if (changes === null) {
        return null;
      }
      const { data, error, response } = await api.PATCH("/agents/{agent_id}", {
        params: { path: { agent_id: agent.id } },
        body: changes,
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseAgent(data);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY }),
  });
}
