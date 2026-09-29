import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The top-level paths of the platform HTTP contract
// (ertugkececi/agent-runtime-platform: contracts/openapi.json), plus /auth/*,
// which the platform keeps out of the contract. The backend sends no CORS
// headers, so the dev server proxies them to a locally running backend instead
// of letting the browser call a different origin.
const apiPaths = [
  "/a2a",
  "/agent-config",
  "/agents",
  "/auth",
  "/chat",
  "/conversations",
  "/health",
  "/mcp",
  "/opencode",
  "/rooms",
  "/runs",
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      apiPaths.map((path) => [path, "http://127.0.0.1:8000"]),
    ),
  },
});
