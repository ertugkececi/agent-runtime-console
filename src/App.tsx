import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "./api/client";
import { AgentCatalog } from "./agents/AgentCatalog";
import { LoginScreen } from "./auth/LoginScreen";
import { useAuthSession } from "./auth/useAuthSession";
import { ChatScreen } from "./chat/ChatScreen";
import { GraphScreen } from "./graph/GraphScreen";
import { RoomScreen } from "./rooms/RoomScreen";

type Screen = "chat" | "rooms" | "agents" | "graph";

export function App() {
  const auth = useAuthSession();
  const [screen, setScreen] = useState<Screen>("chat");

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
      <nav aria-label="Ekranlar">
        <button type="button" aria-pressed={screen === "chat"} onClick={() => setScreen("chat")}>
          Sohbet
        </button>{" "}
        <button
          type="button"
          aria-pressed={screen === "rooms"}
          onClick={() => setScreen("rooms")}
        >
          Grup odaları
        </button>{" "}
        <button
          type="button"
          aria-pressed={screen === "agents"}
          onClick={() => setScreen("agents")}
        >
          Ajanlar
        </button>{" "}
        <button
          type="button"
          aria-pressed={screen === "graph"}
          onClick={() => setScreen("graph")}
        >
          Graf
        </button>
      </nav>
      {screen === "chat" ? (
        <ChatScreen />
      ) : screen === "rooms" ? (
        <RoomScreen />
      ) : screen === "agents" ? (
        <AgentCatalog />
      ) : (
        <GraphScreen />
      )}
    </main>
  );
}

export default App;
