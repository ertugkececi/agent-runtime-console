import { useQuery } from "@tanstack/react-query";

import { api } from "./api/client";

export function App() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error, response } = await api.GET("/health");
      if (error) {
        throw new Error(`GET /health failed with HTTP ${response.status}`);
      }
      return data;
    },
  });

  return (
    <main>
      <h1>Agent Runtime Console</h1>
      {health.isPending ? <p>Backend: checking…</p> : null}
      {health.isError ? <p>Backend: unreachable</p> : null}
      {health.isSuccess ? <p>Backend: {health.data.status}</p> : null}
    </main>
  );
}

export default App;
