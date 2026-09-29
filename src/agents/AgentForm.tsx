import { useState, type FormEvent } from "react";

import {
  nextEffort,
  parseCapabilities,
  resolveModelName,
  sameStrings,
  type Agent,
  type AgentConfigProvider,
  type AgentDraft,
  type ModelEffort,
} from "./agent";
import { useModelCatalog, useToolCatalog } from "./useAgents";

interface AgentFormProps {
  /** Present when editing an existing agent; absent when creating one. */
  agent?: Agent;
  /** Configured providers and the capabilities their manifests declare. */
  providers: AgentConfigProvider[];
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (draft: AgentDraft) => void;
  onCancel?: () => void;
}

const EFFORT_LABELS: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  xhigh: "Çok yüksek",
  max: "Maksimum",
  ultra: "Ultra",
};

function effortLabel(value: string): string {
  if (value === "") {
    return "Model varsayılanı";
  }
  return EFFORT_LABELS[value] ?? value;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Bilinmeyen hata.";
}

export function AgentForm({
  agent,
  providers,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: AgentFormProps) {
  const [name, setName] = useState(agent?.name ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [modelProvider, setModelProvider] = useState(agent?.model_provider ?? providers[0]?.id ?? "");
  const [modelName, setModelName] = useState(agent?.model_name ?? "");
  // The effort is kept together with the model it was chosen for: a model
  // change falls back to what the new model supports, while an untouched
  // model keeps the stored or explicitly chosen value.
  const [effortChoice, setEffortChoice] = useState({
    model: agent?.model_name ?? "",
    value: agent?.model_reasoning_effort ?? "",
  });
  const [capabilityInput, setCapabilityInput] = useState(agent ? agent.capabilities.join(", ") : "");
  // Every granted tool id, including ones the current catalog no longer lists;
  // a grant is only given up through an explicit action.
  const [toolIds, setToolIds] = useState<string[]>(agent?.tool_ids ?? []);
  const [enabled, setEnabled] = useState(agent?.enabled ?? true);
  const [localError, setLocalError] = useState<string | null>(null);

  const providerEntry = providers.find((provider) => provider.id === modelProvider);
  const catalogUrl = providerEntry?.model_catalog_url ?? null;
  const toolsSupported = providerEntry?.supports_tool_ids === true;

  const modelsQuery = useModelCatalog(catalogUrl);
  const models = modelsQuery.data ?? [];
  const toolsQuery = useToolCatalog(toolsSupported);

  // Only the models and efforts the provider's catalog lists are offered, plus
  // a stored model and effort of this very agent so an edit cannot lose them.
  const storedModel =
    agent !== undefined && agent.model_provider === modelProvider ? agent.model_name : null;
  const selectedModelName = resolveModelName(models, modelName, storedModel);
  const selectedModel = models.find((model) => model.id === selectedModelName);
  const storedEffort =
    agent !== undefined &&
    agent.model_provider === modelProvider &&
    agent.model_name === selectedModelName
      ? agent.model_reasoning_effort
      : null;
  const effort =
    effortChoice.model === selectedModelName
      ? effortChoice.value
      : nextEffort(selectedModel, effortChoice.value, storedEffort);
  const effortOptions = selectedModel?.efforts ?? [];

  // A provider that is no longer configured stays selectable for the agent
  // that already uses it, so unrelated edits cannot silently switch it.
  const providerOptions: AgentConfigProvider[] = providers.some(
    (provider) => provider.id === modelProvider,
  )
    ? providers
    : [{ id: modelProvider, supports_tool_ids: false, model_catalog_url: null }, ...providers];

  const modelChoices = models.map((model) => ({
    value: model.id,
    label: `${model.label} (${model.id})`,
  }));
  if (selectedModelName && !modelChoices.some((choice) => choice.value === selectedModelName)) {
    modelChoices.push({ value: selectedModelName, label: `${selectedModelName} (kayıtlı model)` });
  }

  // "Model default" is offered when omitting the effort is possible: an agent
  // that keeps a stored effort never pretends the API can clear it.
  const canOfferDefault = agent === undefined || agent.model_reasoning_effort === null;

  const trustedTools = (toolsQuery.data ?? []).filter((tool) => tool.trusted_read_only);
  const trustedIds = trustedTools.map((tool) => tool.id);
  const revokedIds = toolIds.filter((id) => !trustedIds.includes(id));
  // A provider that does not support tool grants must be saved with an empty
  // list: the backend re-validates stored grants whenever the provider or the
  // grants change. An unknown provider is left untouched.
  const draftToolIds =
    providerEntry !== undefined && !providerEntry.supports_tool_ids ? [] : [...toolIds].sort();
  const toolsDirty =
    agent === undefined ? draftToolIds.length > 0 : !sameStrings(draftToolIds, agent.tool_ids);
  const revokedRemaining = toolsSupported && toolsQuery.isSuccess ? revokedIds : [];

  const modelBlocked = catalogUrl !== null && modelChoices.length === 0;
  const shownError = error ?? localError;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (toolsDirty && revokedRemaining.length > 0) {
      // The API refuses a grant the administrator has not approved as
      // read-only; the revoked grants have to go before any tool change.
      setLocalError(
        "Araç izinleri değiştirilemedi. Katalogda görünmeyen kayıtlı izinleri tek tek kaldırıp yeniden kaydet.",
      );
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      model_provider: modelProvider,
      model_name: selectedModelName.trim(),
      // The catalog lists the efforts the provider supports; the API rejects
      // anything else, and an empty value means "keep the model default".
      model_reasoning_effort: effort === "" ? null : (effort as ModelEffort),
      capabilities: parseCapabilities(capabilityInput),
      tool_ids: draftToolIds,
      enabled,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>
        <label htmlFor="agent-name">Ad</label>
        <input
          id="agent-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
        />
      </p>
      <p>
        <label htmlFor="agent-description">Açıklama</label>
        <textarea
          id="agent-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          rows={2}
        />
      </p>
      <p>
        <label htmlFor="agent-model-provider">Model sağlayıcısı</label>
        <select
          id="agent-model-provider"
          value={modelProvider}
          onChange={(event) => {
            setModelProvider(event.target.value);
            setLocalError(null);
          }}
          required
        >
          {providerOptions.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {providers.some((entry) => entry.id === provider.id)
                ? provider.id
                : `${provider.id} (yapılandırılmamış)`}
            </option>
          ))}
        </select>
      </p>
      <p>
        <label htmlFor="agent-model-name">Model</label>{" "}
        {catalogUrl !== null ? (
          <select
            id="agent-model-name"
            value={selectedModelName}
            onChange={(event) => setModelName(event.target.value)}
            disabled={modelsQuery.isPending || modelChoices.length === 0}
            required
          >
            {modelChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="agent-model-name"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
            maxLength={160}
            required
          />
        )}
        {modelsQuery.isPending ? <small> Modeller yükleniyor…</small> : null}
        {modelsQuery.isError ? (
          <small role="alert"> Modeller yüklenemedi: {errorText(modelsQuery.error)}</small>
        ) : null}
        {modelsQuery.isSuccess && models.length === 0 ? (
          <small> Bu sağlayıcı için seçilebilir model yok.</small>
        ) : null}
      </p>
      {effortOptions.length > 0 ? (
        <p>
          <label htmlFor="agent-model-effort">Düşünme eforu</label>{" "}
          <select
            id="agent-model-effort"
            value={effort}
            onChange={(event) =>
              setEffortChoice({ model: selectedModelName, value: event.target.value })
            }
          >
            {canOfferDefault ? <option value="">Model varsayılanı</option> : null}
            {effortOptions.map((value) => (
              <option key={value} value={value}>
                {effortLabel(value)}
              </option>
            ))}
            {effort !== "" && !effortOptions.includes(effort) ? (
              <option value={effort}>{effortLabel(effort)}</option>
            ) : null}
          </select>
          {selectedModel !== undefined && effort !== "" && !effortOptions.includes(effort) ? (
            <small>
              {" "}
              Kayıtlı efor; seçili model bunu tanımlamıyor ve API bu alanı boşaltmaya izin
              vermediği için korunur.
            </small>
          ) : null}
        </p>
      ) : null}
      <p>
        <label htmlFor="agent-instructions">Talimatlar</label>
        <textarea
          id="agent-instructions"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          maxLength={20000}
          rows={6}
          required
        />
      </p>
      <p>
        <label htmlFor="agent-capabilities">Yetenekler</label>
        <input
          id="agent-capabilities"
          value={capabilityInput}
          onChange={(event) => setCapabilityInput(event.target.value)}
          placeholder="araştırma, yazılım"
        />
        <small>
          {" "}
          Virgülle ayır. Kaydederken baş ve son boşluklar kırpılır, değerler küçük harfe
          çevrilir; eşleşme tam eşleşmedir.
        </small>
      </p>
      {toolsSupported ? (
        <fieldset>
          <legend>Salt okunur MCP araç izinleri</legend>
          {toolsQuery.isPending ? <p> Araçlar yükleniyor…</p> : null}
          {toolsQuery.isError ? (
            <p role="alert"> Araçlar yüklenemedi: {errorText(toolsQuery.error)}</p>
          ) : null}
          {toolsQuery.isSuccess && trustedTools.length === 0 ? (
            <p> Yönetici tarafından onaylanmış salt okunur araç yok.</p>
          ) : null}
          {trustedTools.map((tool) => (
            <label key={tool.id}>
              <input
                type="checkbox"
                value={tool.id}
                checked={toolIds.includes(tool.id)}
                onChange={(event) =>
                  setToolIds((current) =>
                    event.target.checked
                      ? [...new Set([...current, tool.id])].sort()
                      : current.filter((id) => id !== tool.id),
                  )
                }
              />{" "}
              {tool.id}
              {tool.description ? ` · ${tool.description}` : ""}
            </label>
          ))}
          {toolsQuery.isSuccess && revokedIds.length > 0 ? (
            <div>
              <p>
                Katalogda görünmeyen kayıtlı izinler; yeniden kaydetmeden önce tek tek kaldır:
              </p>
              {revokedIds.map((id) => (
                <p key={id}>
                  {id}{" "}
                  <button
                    type="button"
                    onClick={() => setToolIds((current) => current.filter((value) => value !== id))}
                  >
                    İzni kaldır
                  </button>
                </p>
              ))}
            </div>
          ) : null}
          <small>
            {" "}
            Yalnızca yönetici tarafından salt okunur onaylanan araçlar listelenir; MCP
            komutları ve kimlik bilgileri gösterilmez.
          </small>
        </fieldset>
      ) : null}
      {providerEntry !== undefined &&
      !toolsSupported &&
      agent !== undefined &&
      agent.tool_ids.length > 0 ? (
        <p role="status">
          Seçili sağlayıcı MCP araç izinlerini desteklemiyor; kaydettiğinde mevcut izinler
          kaldırılır.
        </p>
      ) : null}
      <p>
        <label htmlFor="agent-enabled">
          <input
            id="agent-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />{" "}
          Etkin
        </label>
        <small>
          {" "}
          Devre dışı bırakma kaydı silmez; geçmiş konuşma ve görev referansları korunur.
        </small>
      </p>
      {shownError ? <p role="alert">{shownError}</p> : null}
      {modelBlocked ? (
        <p role="status">Seçili sağlayıcı için model listesi yüklenmeden kaydedilemez.</p>
      ) : null}
      <p>
        <button type="submit" disabled={submitting || modelBlocked}>
          {submitting ? "Kaydediliyor…" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={submitting}>
            Vazgeç
          </button>
        ) : null}
      </p>
    </form>
  );
}
