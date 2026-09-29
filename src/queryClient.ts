import { QueryClient } from "@tanstack/react-query";

// One client for the whole app: src/api/client.ts uses it to refresh the
// session query when a request answers 401 (see the middleware there).
export const queryClient = new QueryClient();
