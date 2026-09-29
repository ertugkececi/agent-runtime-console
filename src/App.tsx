import { useQuery } from "@tanstack/react-query";

import { api } from "./api/client";
import { AgentCatalog } from "./agents/AgentCatalog";
import { LoginScreen } from "./auth/LoginScreen";
import { useAuthSession } from "./auth/useAuthSession";

export function App() {
  const auth = useAuthSession();

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

  if (auth.state === "loading") {
    return null;
  }
  if (auth.state === "anonymous") {
    return <LoginScreen />;
  }

  return (
    <main>
      <h1>Agent Runtime Console</h1>
      {auth.state === "authenticated" ? (
        <button type="button" onClick={() => void auth.signOut()}>
          Sign out
        </button>
      ) : null}
      {health.isPending ? <p>Backend: checking…</p> : null}
      {health.isError ? <p>Backend: unreachable</p> : null}
      {health.isSuccess ? <p>Backend: {health.data.status}</p> : null}
      <AgentCatalog />
    </main>
  );
}

export default App;
