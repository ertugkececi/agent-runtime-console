import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import {
  AUTH_SESSION_QUERY_KEY,
  fetchAuthSession,
  postLogout,
  setCsrfToken,
} from "./session";

export type AuthState = "loading" | "off" | "anonymous" | "authenticated" | "error";

export function useAuthSession() {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: fetchAuthSession,
    retry: false,
  });

  useEffect(() => {
    setCsrfToken(
      session.data?.authenticated ? (session.data.csrf_token ?? null) : null,
    );
  }, [session.data]);

  const signOut = useCallback(async () => {
    // The session query below is the source of truth: if the logout call
    // fails, refetching it keeps the signed-in state honest.
    await postLogout().catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
  }, [queryClient]);

  const { refetch } = session;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  // An unreachable session endpoint is its own state: assuming auth is off
  // would show the console as if it were unauthenticated.
  let state: AuthState = "off";
  if (session.isPending) {
    state = "loading";
  } else if (session.isError) {
    state = "error";
  } else if (session.data?.auth_enabled) {
    state = session.data.authenticated ? "authenticated" : "anonymous";
  }

  return { state, signOut, error: session.error, retry };
}
