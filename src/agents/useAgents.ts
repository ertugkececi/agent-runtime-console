import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientPathsWithMethod } from "openapi-fetch";

import { api } from "../api/client";
import { apiErrorMessage } from "../api/errorMessage";
import {
  agentChanges,
  parseAgent,
  parseAgentList,
  parseModelChoices,
  parseToolChoices,
  type Agent,
  type AgentDraft,
} from "./agent";

const AGENTS_QUERY_KEY = ["agents"] as const;
const AGENT_CONFIG_QUERY_KEY = ["agent-config", "catalog"] as const;
const MODEL_CATALOG_QUERY_KEY = ["agent-config", "models"] as const;
const TOOL_CATALOG_QUERY_KEY = ["mcp", "tools"] as const;

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

/**
 * Configured providers with the capabilities their manifests declare. The
 * response is typed in the contract, so no narrowing is needed here; the
 * screen reads `supports_tool_ids` and `model_catalog_url` instead of keeping
 * its own provider list.
 */
export function useProviderCatalog() {
  return useQuery({
    queryKey: AGENT_CONFIG_QUERY_KEY,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/agent-config/catalog");
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return data.providers;
    },
  });
}

/**
 * The model catalog the provider's `model_catalog_url` points at, and the only
 * list of selectable models and reasoning efforts. The path comes from the
 * API, so a provider cannot be added to the platform without its catalog
 * showing up here.
 */
export function useModelCatalog(url: string | null) {
  return useQuery({
    queryKey: [...MODEL_CATALOG_QUERY_KEY, url],
    enabled: url !== null,
    queryFn: async () => {
      // `url` is a contract path reported by GET /agent-config/catalog; the
      // payload is narrowed in agent.ts like every other untyped read.
      const { data, error, response } = await api.GET(url as ClientPathsWithMethod<typeof api, "get">, {});
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseModelChoices(data);
    },
  });
}

/**
 * The administrator-approved MCP tool catalog (`GET /mcp/tools`). The backend
 * refuses a grant that is not listed here, so the picker offers nothing else.
 */
export function useToolCatalog(enabled: boolean) {
  return useQuery({
    queryKey: TOOL_CATALOG_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/mcp/tools");
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseToolChoices(data);
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
