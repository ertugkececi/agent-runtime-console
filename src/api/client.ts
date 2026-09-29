import createClient from "openapi-fetch";

import { AUTH_SESSION_QUERY_KEY, getCsrfToken } from "../auth/session";
import { queryClient } from "../queryClient";
import type { paths } from "./schema";

// Same origin: the backend serves the built console, and the Vite dev server
// proxies the contract paths to it (see vite.config.ts). `paths` is generated
// from the platform contract; no API type here is written by hand.
export const api = createClient<paths>();

// Every state-changing request must carry the CSRF token from GET /auth/session
// (src/auth/session.ts). Origin is the browser's to set: the console only calls
// its own origin, and the backend compares that Origin with its redirect URI.
api.use({
  onRequest({ request }) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
      const token = getCsrfToken();
      if (token) {
        request.headers.set("X-CSRF-Token", token);
      }
    }
  },
  onResponse({ response }) {
    if (response.status === 401) {
      // The session ended server-side. Refreshing the session query brings the
      // sign-in screen back instead of leaving the app on a dead view.
      void queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
    }
  },
});
