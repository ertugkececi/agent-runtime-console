import { useEffect, useRef, useState, type ReactNode } from "react";

import { errorText } from "../api/errorMessage";
import { EmptyState, ErrorState, LoadingState, StatusLine } from "../ui/Status";
import { AgentForm } from "./AgentForm";
import { normalizeCapability, type AgentDraft } from "./agent";
import { useAgentList, useCreateAgent, useProviderCatalog, useUpdateAgent } from "./useAgents";

const FILTER_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function AgentCatalog() {
  const [filterInput, setFilterInput] = useState("");
  // The backend matches capabilities exactly after `strip().casefold()`; the
  // filter sends the normalised value and never a blank one.
  const capability = useDebouncedValue(normalizeCapability(filterInput), FILTER_DEBOUNCE_MS);

  const agentsQuery = useAgentList(capability);
  const providersQuery = useProviderCatalog();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // The details area sits below the whole agent list; moving focus to its
  // heading when it changes subject keeps the create/edit flow one Tab away
  // instead of a walk through every list item.
  const detailsHeadingRef = useRef<HTMLHeadingElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  function focusDetails() {
    requestAnimationFrame(() => detailsHeadingRef.current?.focus());
  }

  const agents = agentsQuery.data ?? [];
  const providers = providersQuery.data ?? [];
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  function showDetails(agentId: string) {
    setCreating(false);
    setSelectedId(agentId);
    setStatus(null);
    setFormError(null);
    focusDetails();
  }

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setStatus(null);
    setFormError(null);
    focusDetails();
  }

  function cancelCreate() {
    setCreating(false);
    setStatus(null);
    setFormError(null);
    // The form was opened from this button, so cancelling returns focus to it.
    requestAnimationFrame(() => createButtonRef.current?.focus());
  }

  async function handleCreate(draft: AgentDraft) {
    setStatus(null);
    setFormError(null);
    try {
      const created = await createAgent.mutateAsync(draft);
      setCreating(false);
      setSelectedId(created.id);
      // A capability filter lists enabled agents only; clearing it shows the
      // agent that was just created even when its capability does not match.
      setFilterInput("");
      setStatus(created.enabled ? "Ajan oluşturuldu." : "Ajan oluşturuldu; devre dışı olarak listelenir.");
      focusDetails();
    } catch (error) {
      setFormError(errorText(error));
    }
  }

  async function handleUpdate(draft: AgentDraft) {
    if (!selected) {
      return;
    }
    const wasEnabled = selected.enabled;
    setStatus(null);
    setFormError(null);
    try {
      const updated = await updateAgent.mutateAsync({ agent: selected, draft });
      // A save rebuilds the form from the API response; focus is put back on
      // the details heading because the button that had it is replaced.
      focusDetails();
      if (updated === null) {
        setStatus("Değişiklik yapılmadı.");
        return;
      }
      if (wasEnabled && !updated.enabled && capability) {
        // The filter lists enabled agents only; after disabling, clearing it
        // keeps the record on screen instead of making it look deleted.
        setFilterInput("");
      }
      setStatus(
        wasEnabled && !updated.enabled
          ? "Ajan devre dışı bırakıldı. Kaydı silinmedi; geçmiş konuşma ve görev referansları korunur."
          : "Ajan kaydedildi.",
      );
    } catch (error) {
      setFormError(errorText(error));
    }
  }

  let details: ReactNode;
  if (creating) {
    if (providersQuery.isPending) {
      details = <LoadingState>Sağlayıcılar yükleniyor…</LoadingState>;
    } else if (providersQuery.isError) {
      details = (
        <ErrorState>Sağlayıcılar yüklenemedi: {errorText(providersQuery.error)}</ErrorState>
      );
    } else if (providers.length === 0) {
      details = <EmptyState>Yapılandırılmış model sağlayıcısı yok; ajan oluşturulamaz.</EmptyState>;
    } else {
      details = (
        <AgentForm
          key="create"
          providers={providers}
          submitting={createAgent.isPending}
          error={formError}
          submitLabel="Ajanı oluştur"
          onSubmit={(draft) => void handleCreate(draft)}
          onCancel={cancelCreate}
        />
      );
    }
  } else if (selected) {
    details = (
      <AgentForm
        // The version in the key refreshes the form from the API response after
        // a save, so it shows the values the backend stored (for example the
        // normalised capabilities) instead of the raw draft.
        key={`${selected.id}:${selected.version}`}
        agent={selected}
        providers={providers}
        submitting={updateAgent.isPending}
        error={formError}
        submitLabel="Değişiklikleri kaydet"
        onSubmit={(draft) => void handleUpdate(draft)}
      />
    );
  } else {
    details = <EmptyState>Düzenlemek için listeden bir ajan seç.</EmptyState>;
  }

  return (
    <section className="screen" aria-labelledby="agent-catalog-heading">
      <h2 id="agent-catalog-heading" tabIndex={-1}>
        Ajan kataloğu
      </h2>
      <p>
        Kayıtlı ajanları listeler, yeteneğe göre arar, oluşturur ve düzenler. Ajanlar
        silinmez; kullanımdan çıkarmak için devre dışı bırakılır.
      </p>
      <p>
        <label htmlFor="agent-capability-filter">Yetenek filtresi</label>{" "}
        <input
          id="agent-capability-filter"
          type="search"
          value={filterInput}
          onChange={(event) => setFilterInput(event.target.value)}
          placeholder="araştırma"
        />
        <br />
        <small>
          Eşleşme tam eşleşmedir: değer kırpılır ve küçük harfe çevrilir (" Araştırma " →
          "araştırma"). Yetenek filtresi yalnızca etkin ajanları listeler.
        </small>
      </p>
      <p>
        <button type="button" ref={createButtonRef} onClick={startCreate}>
          Yeni ajan
        </button>
      </p>
      {status !== null ? <StatusLine>{status}</StatusLine> : null}
      {agentsQuery.isPending ? <LoadingState>Ajanlar yükleniyor…</LoadingState> : null}
      {agentsQuery.isError ? (
        <ErrorState>Ajanlar yüklenemedi: {errorText(agentsQuery.error)}</ErrorState>
      ) : null}
      {agentsQuery.isSuccess && agents.length === 0 ? (
        <EmptyState>
          {capability ? "Bu yetenekle eşleşen etkin ajan yok." : "Henüz ajan yok."}
        </EmptyState>
      ) : null}
      <ul>
        {agents.map((agent) => (
          <li key={agent.id}>
            <button
              type="button"
              aria-pressed={agent.id === selectedId}
              onClick={() => showDetails(agent.id)}
            >
              {agent.name} — {agent.enabled ? "Etkin" : "Devre dışı"} · {agent.model_provider} ·{" "}
              {agent.model_name}
              {agent.capabilities.length > 0 ? ` · ${agent.capabilities.join(", ")}` : ""}
            </button>
          </li>
        ))}
      </ul>
      <h3 ref={detailsHeadingRef} tabIndex={-1}>
        {creating ? "Yeni ajan" : selected ? selected.name : "Ajan ayrıntıları"}
      </h3>
      {details}
    </section>
  );
}
