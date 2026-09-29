import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api } from "./api/client";
import { errorText } from "./api/errorMessage";
import { AgentCatalog } from "./agents/AgentCatalog";
import { LoginScreen } from "./auth/LoginScreen";
import { useAuthSession } from "./auth/useAuthSession";
import { ChatScreen } from "./chat/ChatScreen";
import { GraphScreen } from "./graph/GraphScreen";
import { RoomScreen } from "./rooms/RoomScreen";
import { ErrorState, LoadingState } from "./ui/Status";

type Screen = "chat" | "rooms" | "agents" | "graph";

const SCREEN_LABELS: Record<Screen, string> = {
  chat: "Sohbet",
  rooms: "Grup odaları",
  agents: "Ajanlar",
  graph: "Graf",
};

export function App() {
  const auth = useAuthSession();
  const [screen, setScreen] = useState<Screen>("chat");
  const screenRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Switching a screen moves focus to the new screen's heading, so a keyboard
  // user continues from the content instead of tabbing through the navigation.
  // The first render keeps the browser's own focus.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    screenRef.current?.querySelector("h2")?.focus();
  }, [screen]);

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
    return (
      <main className="app-centered">
        <LoadingState>Oturum denetleniyor…</LoadingState>
      </main>
    );
  }
  if (auth.state === "error") {
    return (
      <main className="app-centered">
        <section className="screen" aria-labelledby="session-error-heading">
          <h1 id="session-error-heading">Oturum denetlenemedi</h1>
          <ErrorState>Oturum bilgisi alınamadı: {errorText(auth.error)}</ErrorState>
          <p>
            <button type="button" onClick={auth.retry}>
              Tekrar dene
            </button>
          </p>
        </section>
      </main>
    );
  }
  if (auth.state === "anonymous") {
    return <LoginScreen />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <header className="app-header">
        <h1>Agent Runtime Console</h1>
        <span className="app-header__meta">
          {auth.state === "authenticated" ? (
            <button type="button" onClick={() => void auth.signOut()}>
              Çıkış yap
            </button>
          ) : null}
          {health.isPending ? <span role="status">Sunucu: denetleniyor…</span> : null}
          {health.isError ? <span role="alert">Sunucu: erişilemez</span> : null}
          {health.isSuccess ? <span>Sunucu: {health.data.status}</span> : null}
        </span>
      </header>
      <nav className="app-nav" aria-label="Ekranlar">
        {(Object.keys(SCREEN_LABELS) as Screen[]).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={screen === name}
            onClick={() => setScreen(name)}
          >
            {SCREEN_LABELS[name]}
          </button>
        ))}
      </nav>
      <main id="main-content" tabIndex={-1} ref={screenRef}>
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
    </div>
  );
}

export default App;
