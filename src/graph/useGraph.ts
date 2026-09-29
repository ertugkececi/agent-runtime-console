// Data loading for the graph screen.
//
// The API has no "list runs" endpoint, so the only runs the console can show
// are the ones it holds ids for: the stored conversation's messages carry one
// run id per exchange, and a room's runs come from `GET /rooms/{id}/runs`.
// Every run is read with `GET /runs/{run_id}` and narrowed by
// `parseGraphRun`, which keeps the task tree and the run events.

import { useQueries } from "@tanstack/react-query";

import { api } from "../api/client";
import { apiErrorMessage } from "../api/errorMessage";
import { parseGraphRun, type GraphRun } from "./graph";

export const GRAPH_RUNS_QUERY_KEY = ["graph-runs"] as const;

function graphRunQuery(runId: string) {
  return {
    queryKey: [...GRAPH_RUNS_QUERY_KEY, runId],
    queryFn: async (): Promise<GraphRun> => {
      const { data, error, response } = await api.GET("/runs/{run_id}", {
        params: { path: { run_id: runId } },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseGraphRun(data);
    },
  };
}

export interface GraphRunsResult {
  runs: GraphRun[];
  pending: boolean;
  failed: number;
}

/**
 * The runs behind a list of ids, in the order the ids were given. A single
 * failed read does not hide the rest: the screen states how many runs could
 * not be loaded.
 */
export function useGraphRuns(runIds: string[]): GraphRunsResult {
  const results = useQueries({ queries: runIds.map(graphRunQuery) });
  const runs: GraphRun[] = [];
  let pending = false;
  let failed = 0;
  for (const result of results) {
    if (result.data !== undefined) {
      runs.push(result.data);
    }
    if (result.isPending) {
      pending = true;
    }
    if (result.isError) {
      failed += 1;
    }
  }
  return { runs, pending, failed };
}
