// The platform registers its auth routes with `include_in_schema=False`, so
// they are absent from the generated contract in src/api/schema.d.ts. This is
// the only module that calls /auth/* directly; every contract route goes
// through the generated client in src/api/client.ts.

export interface AuthSession {
  authenticated: boolean;
  auth_enabled: boolean;
  csrf_token?: string;
}

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"] as const;

// The CSRF synchronizer token is derived from the opaque HttpOnly session
// cookie and only ever lives in memory.
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const response = await fetch("/auth/session", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`GET /auth/session failed with HTTP ${response.status}`);
  }
  return (await response.json()) as AuthSession;
}

export async function postLogout(): Promise<void> {
  const token = getCsrfToken();
  const response = await fetch("/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: token ? { "X-CSRF-Token": token } : {},
  });
  // A 401 means the session is already gone, which is also a finished sign-out.
  if (!response.ok && response.status !== 401) {
    throw new Error(`POST /auth/logout failed with HTTP ${response.status}`);
  }
}
