import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/client";
import { apiErrorMessage } from "../api/errorMessage";
import { isTerminalStatus } from "../runs/run";
import {
  parseEnqueuedRoomRun,
  parseRoom,
  parseRoomRun,
  parseRoomRunList,
  type Room,
  type RoomRun,
} from "./room";

export const ROOMS_QUERY_KEY = ["rooms"] as const;
export const ROOM_RUNS_QUERY_KEY = ["room-runs"] as const;
const ROOM_RUN_QUERY_KEY = ["room-run"] as const;

/**
 * A run in `queued`/`running` is polled, which is what makes the turns and the
 * status line live; a terminal run is fetched once and then left alone.
 */
const ROOM_RUN_POLL_INTERVAL_MS = 1500;

/**
 * The open room, loaded on refresh. A 404 is a load error here, not an empty
 * answer: the screen says the room cannot be loaded instead of pretending it
 * is open.
 */
export function useRoom(roomId: string | null) {
  return useQuery({
    queryKey: [...ROOMS_QUERY_KEY, roomId],
    enabled: roomId !== null,
    queryFn: async (): Promise<Room> => {
      if (roomId === null) {
        throw new Error("Oda kimliği yok.");
      }
      const { data, error, response } = await api.GET("/rooms/{room_id}", {
        params: { path: { room_id: roomId } },
      });
      if (response.status === 404) {
        throw new Error("Oda bulunamadı.");
      }
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseRoom(data);
    },
  });
}

/** The room's runs, newest first as the API returns them. */
export function useRoomRuns(roomId: string | null) {
  return useQuery({
    queryKey: [...ROOM_RUNS_QUERY_KEY, roomId],
    enabled: roomId !== null,
    queryFn: async (): Promise<RoomRun[]> => {
      if (roomId === null) {
        throw new Error("Oda kimliği yok.");
      }
      const { data, error, response } = await api.GET("/rooms/{room_id}/runs", {
        params: { path: { room_id: roomId } },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseRoomRunList(data);
    },
  });
}

/** One run followed by `GET /runs/{run_id}`, polled until it is terminal. */
export function useRoomRun(runId: string | null) {
  return useQuery({
    queryKey: [...ROOM_RUN_QUERY_KEY, runId],
    enabled: runId !== null,
    queryFn: async (): Promise<RoomRun> => {
      if (runId === null) {
        throw new Error("Çalıştırma kimliği yok.");
      }
      const { data, error, response } = await api.GET("/runs/{run_id}", {
        params: { path: { run_id: runId } },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseRoomRun(data);
    },
    refetchInterval: (query) => {
      const run = query.state.data;
      return run !== undefined && isTerminalStatus(run.status)
        ? false
        : ROOM_RUN_POLL_INTERVAL_MS;
    },
  });
}

/** POST /rooms: a named room with 2–5 enabled agents and a moderator among them. */
export function useCreateRoom() {
  return useMutation({
    mutationFn: async (draft: {
      name: string;
      participant_agent_ids: string[];
      moderator_agent_id: string;
    }) => {
      const { data, error, response } = await api.POST("/rooms", { body: draft });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseRoom(data);
    },
  });
}

/**
 * POST /rooms/{id}/runs: the 202 answer names the run to follow, and the run
 * joins the room's history right away, so that list is refreshed.
 */
export function useEnqueueRoomRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, content }: { roomId: string; content: string }) => {
      const { data, error, response } = await api.POST("/rooms/{room_id}/runs", {
        params: { path: { room_id: roomId } },
        body: { content },
      });
      if (error) {
        throw new Error(apiErrorMessage(error, response.status));
      }
      return parseEnqueuedRoomRun(data);
    },
    onSuccess: (_accepted, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...ROOM_RUNS_QUERY_KEY, variables.roomId],
      });
    },
  });
}
