import { useState, type FormEvent } from "react";

import { parseCapabilities, type Agent, type AgentDraft } from "./agent";

interface AgentFormProps {
  /** Present when editing an existing agent; absent when creating one. */
  agent?: Agent;
  providers: string[];
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (draft: AgentDraft) => void;
  onCancel?: () => void;
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
  const [modelProvider, setModelProvider] = useState(agent?.model_provider ?? providers[0] ?? "");
  const [modelName, setModelName] = useState(agent?.model_name ?? "");
  const [capabilityInput, setCapabilityInput] = useState(agent ? agent.capabilities.join(", ") : "");
  const [enabled, setEnabled] = useState(agent?.enabled ?? true);

  // A provider that is no longer configured stays selectable for the agent
  // that already uses it, so unrelated edits cannot silently switch it.
  const providerOptions = providers.includes(modelProvider)
    ? providers
    : [modelProvider, ...providers].filter(Boolean);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      model_provider: modelProvider,
      model_name: modelName.trim(),
      capabilities: parseCapabilities(capabilityInput),
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
          onChange={(event) => setModelProvider(event.target.value)}
          required
        >
          {providerOptions.map((provider) => (
            <option key={provider} value={provider}>
              {providers.includes(provider) ? provider : `${provider} (yapılandırılmamış)`}
            </option>
          ))}
        </select>
      </p>
      <p>
        <label htmlFor="agent-model-name">Model</label>
        <input
          id="agent-model-name"
          value={modelName}
          onChange={(event) => setModelName(event.target.value)}
          maxLength={160}
          required
        />
      </p>
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
      {error ? <p role="alert">{error}</p> : null}
      <p>
        <button type="submit" disabled={submitting}>
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
