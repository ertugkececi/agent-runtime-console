import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { errorText } from "../api/errorMessage";
import { EmptyState, ErrorState, LoadingState, StatusLine } from "../ui/Status";
import { preferredMethod } from "./connection";
import {
  INTEGRATIONS_QUERY_KEY,
  useCancelConnection,
  useConnectionStatus,
  useIntegrations,
  useStartConnection,
  useSubmitConnectionCode,
} from "./useConnections";

/**
 * Connects one model-provider account — for example a ChatGPT/Plus
 * subscription — and follows the attempt until the server stores the
 * credential. The screen never sees a token; it shows the sign-in details the
 * platform returns and sends back only what the human typed.
 */
export function ConnectionScreen() {
  const queryClient = useQueryClient();
  const integrationsQuery = useIntegrations();
  const startConnection = useStartConnection();
  const submitCode = useSubmitConnectionCode();
  const cancelConnection = useCancelConnection();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [chosenIntegrationId, setChosenIntegrationId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const integrations = integrationsQuery.data ?? [];
  const selectable = integrations.filter((integration) => preferredMethod(integration) !== null);
  // Derive the selection during render: the first offer until the user picks
  // another one, so no effect has to write state back into the component.
  const selected =
    selectable.find((integration) => integration.id === chosenIntegrationId) ??
    selectable[0] ??
    null;
  const integrationId = selected?.id ?? "";

  const attemptQuery = useConnectionStatus(attemptId);
  const attempt = attemptQuery.data ?? null;

  // A completed sign-in changes which integrations report as connected.
  const attemptStatus = attempt?.status;
  useEffect(() => {
    if (attemptStatus === "complete") {
      void queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
    }
  }, [attemptStatus, queryClient]);

  const busy = startConnection.isPending || submitCode.isPending || cancelConnection.isPending;
  const waiting = attempt?.status === "waiting";
  const integrationName =
    integrations.find((integration) => integration.id === attempt?.integration)?.name ??
    attempt?.integration ??
    "";

  async function handleStart() {
    if (selected === null) return;
    setError(null);
    setCode("");
    try {
      const started = await startConnection.mutateAsync(selected);
      setAttemptId(started.attempt_id);
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function handleSubmitCode() {
    if (attemptId === null || !code.trim()) return;
    setError(null);
    try {
      await submitCode.mutateAsync({ attemptId, code: code.trim() });
      setCode("");
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function handleCancel() {
    if (attemptId === null) return;
    setError(null);
    try {
      await cancelConnection.mutateAsync(attemptId);
    } catch (cause) {
      setError(errorText(cause));
    }
    setAttemptId(null);
    setCode("");
  }

  return (
    <section className="screen" aria-labelledby="connections-heading">
      <h2 id="connections-heading" tabIndex={-1}>
        Sağlayıcı bağlantısı
      </h2>
      <p>
        Model sağlayıcısının hesabını buradan bağla — örneğin ChatGPT/Plus
        aboneliği. Bağlantı sunucuda saklanır ve sonraki tüm model çağrılarında
        kullanılır; kimlik bilgisi bu tarayıcıya hiç gelmez.
      </p>

      {integrationsQuery.isPending ? (
        <LoadingState>Sağlayıcılar yükleniyor…</LoadingState>
      ) : null}
      {integrationsQuery.isError ? (
        <ErrorState>Sağlayıcı listesi yüklenemedi: {errorText(integrationsQuery.error)}</ErrorState>
      ) : null}
      {integrationsQuery.isSuccess && selectable.length === 0 ? (
        <EmptyState>
          Bağlanabilir sağlayıcı bulunamadı. Sunucuda ortam değişkeniyle tanımlı bir
          kimlik bilgisi zaten kullanılıyor olabilir.
        </EmptyState>
      ) : null}
      {error ? <ErrorState>{error}</ErrorState> : null}

      {selectable.length > 0 ? (
        <p>
          <label htmlFor="connection-integration">Sağlayıcı</label>
          <select
            id="connection-integration"
            value={integrationId}
            disabled={waiting || busy}
            onChange={(event) => setChosenIntegrationId(event.target.value)}
          >
            {selectable.map((integration) => (
              <option key={integration.id} value={integration.id}>
                {integration.name}
                {integration.connected ? " (bağlı)" : ""}
              </option>
            ))}
          </select>
        </p>
      ) : null}

      {!waiting && selectable.length > 0 ? (
        <p>
          <button type="button" onClick={() => void handleStart()} disabled={busy || selected === null}>
            {selected?.connected ? "Yeniden bağlan" : "Bağlan"}
          </button>
        </p>
      ) : null}

      {attemptQuery.isError ? (
        <ErrorState>Bağlantı durumu okunamadı: {errorText(attemptQuery.error)}</ErrorState>
      ) : null}

      {attempt ? (
        <section aria-labelledby="connection-attempt-heading">
          <h3 id="connection-attempt-heading">{integrationName} bağlantısı</h3>
          {attempt.instructions ? <p>{attempt.instructions}</p> : null}
          {attempt.url ? (
            <p>
              <a href={attempt.url} target="_blank" rel="noreferrer">
                {attempt.url}
              </a>
            </p>
          ) : null}

          {waiting ? (
            <>
              <StatusLine>
                {attempt.mode === "code"
                  ? "Kodu sağlayıcının sayfasına gir, sonra buradan gönder."
                  : "Tarayıcıda onay bekleniyor…"}
              </StatusLine>
              {attempt.mode === "code" ? (
                <p>
                  <label htmlFor="connection-code">Doğrulama kodu</label>
                  <input
                    id="connection-code"
                    maxLength={400}
                    autoComplete="off"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubmitCode()}
                    disabled={busy || !code.trim()}
                  >
                    Kodu gönder
                  </button>
                </p>
              ) : null}
              <p>
                <button type="button" onClick={() => void handleCancel()} disabled={busy}>
                  İptal
                </button>
              </p>
            </>
          ) : null}

          {attempt.status === "complete" ? <StatusLine>Bağlantı tamamlandı.</StatusLine> : null}
          {attempt.status === "failed" ? (
            <ErrorState>{attempt.message ?? "Bağlantı tamamlanamadı."}</ErrorState>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
