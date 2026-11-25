import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  Loader2,
  Pencil,
  PenLine,
  Plug,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { storageBridge } from "../../services/bridge";
import type {
  AiProviderRecord,
  AiProviderType,
  ConnectionTestResult,
} from "../../types/electron";

interface ProviderMeta {
  type: AiProviderType;
  label: string;
  defaultName: string;
  defaultModel: string;
  apiKeyUrl: string;
}

const PROVIDER_TYPES: ProviderMeta[] = [
  {
    type: "Gemini",
    label: "Google Gemini",
    defaultName: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    apiKeyUrl: "https://aistudio.google.com/apikey",
  },
  {
    type: "OpenAI",
    label: "OpenAI",
    defaultName: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
  {
    type: "Anthropic",
    label: "Anthropic (Claude)",
    defaultName: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-20250514",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    type: "CustomOpenAI",
    label: "Custom / Ollama",
    defaultName: "Ollama (Local)",
    defaultModel: "llama3.2",
    apiKeyUrl: "https://openrouter.ai/keys",
  },
];

const CUSTOM_PRESETS = [
  {
    label: "Ollama (Local)",
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    modelName: "llama3.2",
    apiKeyUrl: "https://ollama.com",
  },
  {
    label: "LM Studio",
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    modelName: "local-model",
    apiKeyUrl: "https://lmstudio.ai",
  },
  {
    label: "OpenRouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelName: "google/gemini-2.5-flash",
    apiKeyUrl: "https://openrouter.ai/keys",
  },
  {
    label: "DeepSeek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    modelName: "deepseek-chat",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    label: "Groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    modelName: "llama-3.3-70b-versatile",
    apiKeyUrl: "https://console.groq.com/keys",
  },
];

export function AiProvidersSection() {
  const { t } = useTranslation();

  const [providers, setProviders] = useState<AiProviderRecord[]>([]);
  const [encryptionAvailable, setEncryptionAvailable] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [providerType, setProviderType] = useState<AiProviderType>("Gemini");
  const [name, setName] = useState("Google Gemini");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isDefaultWriter, setIsDefaultWriter] = useState(true);
  const [isDefaultTranslator, setIsDefaultTranslator] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formTestLoading, setFormTestLoading] = useState(false);
  const [formTestResult, setFormTestResult] =
    useState<ConnectionTestResult | null>(null);

  const [cardTests, setCardTests] = useState<
    Record<number, { loading: boolean; result?: ConnectionTestResult }>
  >({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const [enc, list] = await Promise.all([
      storageBridge.getEncryptionStatus(),
      storageBridge.listAiProviders(),
    ]);
    setEncryptionAvailable(enc.available);
    setProviders(list);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = (nextType: AiProviderType = "Gemini") => {
    const meta =
      PROVIDER_TYPES.find((p) => p.type === nextType) ?? PROVIDER_TYPES[0];
    setEditingId(null);
    setProviderType(nextType);
    setName(meta.defaultName);
    setBaseUrl(nextType === "CustomOpenAI" ? "http://localhost:11434/v1" : "");
    setModelName(meta.defaultModel);
    setApiKey("");
    setShowKey(false);
    setIsDefaultWriter(providers.length === 0);
    setIsDefaultTranslator(providers.length === 0);
    setFormError(null);
    setFormTestResult(null);
  };

  const handleSelectProviderType = (nextType: AiProviderType) => {
    const meta =
      PROVIDER_TYPES.find((p) => p.type === nextType) ?? PROVIDER_TYPES[0];
    setProviderType(nextType);
    if (editingId === null) {
      setName(meta.defaultName);
      setModelName(meta.defaultModel);
      setBaseUrl(nextType === "CustomOpenAI" ? "http://localhost:11434/v1" : "");
    }
    setFormTestResult(null);
    setFormError(null);
  };

  const applyCustomPreset = (preset: (typeof CUSTOM_PRESETS)[number]) => {
    setProviderType("CustomOpenAI");
    setName(preset.name);
    setBaseUrl(preset.baseUrl);
    setModelName(preset.modelName);
    setFormTestResult(null);
    setFormError(null);
  };

  const startEditing = (provider: AiProviderRecord) => {
    setEditingId(provider.id);
    setProviderType(provider.providerType);
    setName(provider.name);
    setBaseUrl(provider.baseUrl);
    setModelName(provider.modelName);
    setApiKey("");
    setShowKey(false);
    setIsDefaultWriter(provider.isDefaultWriter);
    setIsDefaultTranslator(provider.isDefaultTranslator);
    setFormError(null);
    setFormTestResult(null);
  };

  const getApiKeyPortalUrl = (): string => {
    if (providerType === "CustomOpenAI") {
      const matched = CUSTOM_PRESETS.find((p) =>
        baseUrl.toLowerCase().includes(p.baseUrl.split("://")[1].split("/")[0])
      );
      if (matched) return matched.apiKeyUrl;
    }
    return (
      PROVIDER_TYPES.find((p) => p.type === providerType)?.apiKeyUrl ??
      "https://aistudio.google.com/apikey"
    );
  };

  const handleOpenApiKeyPortal = () => {
    void storageBridge.openExternalUrl(getApiKeyPortalUrl());
  };

  const handleTestForm = async () => {
    setFormTestLoading(true);
    setFormTestResult(null);
    setFormError(null);
    try {
      const result = await storageBridge.testAiProvider({
        providerId: editingId ?? undefined,
        providerType,
        baseUrl: providerType === "CustomOpenAI" ? baseUrl.trim() : "",
        modelName: modelName.trim(),
        apiKey: apiKey.trim() || undefined,
      });
      setFormTestResult(result);
    } catch (err) {
      setFormTestResult({
        ok: false,
        latencyMs: 0,
        message: err instanceof Error ? err.message : "Test failed.",
      });
    } finally {
      setFormTestLoading(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError(t("aiProviders.errors.nameRequired"));
      return;
    }
    if (!modelName.trim()) {
      setFormError(t("aiProviders.errors.modelRequired"));
      return;
    }
    if (providerType === "CustomOpenAI" && !baseUrl.trim()) {
      setFormError(t("aiProviders.errors.baseUrlRequired"));
      return;
    }
    if (
      editingId === null &&
      providerType !== "CustomOpenAI" &&
      !apiKey.trim()
    ) {
      setFormError(t("aiProviders.errors.keyRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        providerType,
        baseUrl: providerType === "CustomOpenAI" ? baseUrl.trim() : "",
        modelName: modelName.trim(),
        apiKey: apiKey.trim() || undefined,
        isDefaultWriter,
        isDefaultTranslator,
      };

      if (editingId !== null) {
        await storageBridge.updateAiProvider(editingId, payload);
      } else {
        await storageBridge.createAiProvider(payload);
      }

      await loadData();
      resetForm(providerType);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("aiProviders.errors.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestCard = async (providerId: number) => {
    setCardTests((prev) => ({ ...prev, [providerId]: { loading: true } }));
    try {
      const result = await storageBridge.testAiProvider({ providerId });
      setCardTests((prev) => ({
        ...prev,
        [providerId]: { loading: false, result },
      }));
    } catch (err) {
      setCardTests((prev) => ({
        ...prev,
        [providerId]: {
          loading: false,
          result: {
            ok: false,
            latencyMs: 0,
            message: err instanceof Error ? err.message : "Test failed.",
          },
        },
      }));
    }
  };

  const handleSetDefault = async (
    providerId: number,
    role: "writer" | "translator"
  ) => {
    const updated = await storageBridge.setDefaultAiProvider(providerId, role);
    setProviders(updated);
  };

  const handleDelete = async (providerId: number) => {
    const updated = await storageBridge.deleteAiProvider(providerId);
    setProviders(updated);
    setConfirmDeleteId(null);
    if (editingId === providerId) {
      resetForm();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* OS Vault Security Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-surface px-5 py-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-highlight">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">
              {t("aiProviders.securityTitle")}
            </h4>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
              {t("aiProviders.securityDescription")}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            encryptionAvailable
              ? "bg-accent-soft text-highlight"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              encryptionAvailable ? "bg-highlight" : "bg-red-400"
            }`}
          />
          {encryptionAvailable
            ? t("aiProviders.vaultActive")
            : t("aiProviders.vaultUnavailable")}
        </span>
      </div>

      {/* Add / Edit Provider Form */}
      <form
        onSubmit={(e) => void handleSave(e)}
        className="rounded-2xl border border-edge bg-surface p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-accent" />
            <h4 className="font-display text-base font-semibold text-ink">
              {editingId !== null
                ? t("aiProviders.editFormTitle")
                : t("aiProviders.addFormTitle")}
            </h4>
          </div>

          <button
            type="button"
            onClick={handleOpenApiKeyPortal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-edge-strong bg-elevated px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("aiProviders.getApiKey")}
          </button>
        </div>

        {/* Provider Type Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROVIDER_TYPES.map((item) => {
            const selected = providerType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => handleSelectProviderType(item.type)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                  selected
                    ? "border-accent bg-accent-soft text-accent shadow-xs"
                    : "border-edge bg-elevated text-ink-secondary hover:border-edge-strong hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Quick Presets for Custom OpenAI-Compatible Providers */}
        {providerType === "CustomOpenAI" && (
          <div className="mt-4 rounded-xl border border-edge bg-elevated/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {t("aiProviders.quickPresets")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CUSTOM_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyCustomPreset(preset)}
                  className="rounded-lg border border-edge-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-accent hover:text-ink"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fields */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="provider-name"
              className="block text-xs font-medium text-ink-secondary"
            >
              {t("aiProviders.nameLabel")} *
            </label>
            <input
              id="provider-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Google Gemini"
              className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="provider-model"
              className="block text-xs font-medium text-ink-secondary"
            >
              {t("aiProviders.modelLabel")} *
            </label>
            <input
              id="provider-model"
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="gemini-2.5-flash"
              className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          {providerType === "CustomOpenAI" && (
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="provider-baseurl"
                className="block text-xs font-medium text-ink-secondary"
              >
                {t("aiProviders.baseUrlLabel")} *
              </label>
              <input
                id="provider-baseurl"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <label
              htmlFor="provider-apikey"
              className="block text-xs font-medium text-ink-secondary"
            >
              {t("aiProviders.apiKeyLabel")}
              {providerType === "CustomOpenAI"
                ? ` (${t("aiProviders.optionalLocal")})`
                : editingId === null
                  ? " *"
                  : ` (${t("aiProviders.leaveBlankKeep")})`}
            </label>
            <div className="relative">
              <input
                id="provider-apikey"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                placeholder={
                  editingId !== null
                    ? t("aiProviders.keepExistingPlaceholder")
                    : t("aiProviders.apiKeyPlaceholder")
                }
                className="w-full rounded-lg border border-edge-strong bg-elevated py-2 pr-10 pl-3 font-mono text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-ink-muted hover:text-ink"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Default Role Checkboxes */}
        <div className="mt-4 flex flex-wrap gap-5">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-secondary">
            <input
              type="checkbox"
              checked={isDefaultWriter}
              onChange={(e) => setIsDefaultWriter(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            {t("aiProviders.defaultWriter")}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-secondary">
            <input
              type="checkbox"
              checked={isDefaultTranslator}
              onChange={(e) => setIsDefaultTranslator(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            {t("aiProviders.defaultTranslator")}
          </label>
        </div>

        {/* Validation Error or Test Result */}
        {formError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/15 px-3.5 py-2.5 text-xs text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {formTestResult && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs ${
              formTestResult.ok
                ? "bg-accent-soft text-highlight"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {formTestResult.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{formTestResult.message}</span>
            {formTestResult.latencyMs > 0 && (
              <span className="font-mono text-[11px] opacity-80">
                {formTestResult.latencyMs} ms
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {editingId !== null
              ? t("aiProviders.updateButton")
              : t("aiProviders.saveButton")}
          </button>

          <button
            type="button"
            disabled={formTestLoading}
            onClick={() => void handleTestForm()}
            className="inline-flex items-center gap-2 rounded-lg border border-edge-strong bg-elevated px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {formTestLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            {t("aiProviders.testConnection")}
          </button>

          {editingId !== null && (
            <button
              type="button"
              onClick={() => resetForm()}
              className="rounded-lg px-3 py-2 text-xs font-medium text-ink-secondary hover:text-ink"
            >
              {t("projects.cancel")}
            </button>
          )}
        </div>
      </form>

      {/* Saved Providers List */}
      <section className="rounded-2xl border border-edge bg-surface p-6 shadow-sm">
        <h4 className="font-display text-base font-semibold text-ink">
          {t("aiProviders.savedListTitle")} ({providers.length})
        </h4>

        {providers.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-edge-strong bg-elevated/40 p-6 text-center text-xs text-ink-secondary">
            {t("aiProviders.emptyList")}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {providers.map((provider) => {
              const testState = cardTests[provider.id];
              const isConfirming = confirmDeleteId === provider.id;

              return (
                <li
                  key={provider.id}
                  className="rounded-xl border border-edge bg-elevated/70 p-4 transition-colors hover:border-edge-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-semibold text-ink">
                          {provider.name}
                        </span>
                        <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                          {provider.providerType}
                        </span>
                        <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] text-accent">
                          {provider.modelName}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                        <span className="font-mono">
                          {provider.hasApiKey
                            ? provider.maskedKey
                            : t("aiProviders.noKeyLocal")}
                        </span>
                        {provider.baseUrl && (
                          <span className="truncate font-mono text-[11px]">
                            {provider.baseUrl}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleSetDefault(provider.id, "writer")
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          provider.isDefaultWriter
                            ? "border-accent bg-accent text-accent-fg"
                            : "border-edge bg-surface text-ink-secondary hover:border-edge-strong hover:text-ink"
                        }`}
                      >
                        <PenLine className="h-3 w-3" />
                        {t("aiProviders.writerRole")}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleSetDefault(provider.id, "translator")
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          provider.isDefaultTranslator
                            ? "border-accent bg-accent text-accent-fg"
                            : "border-edge bg-surface text-ink-secondary hover:border-edge-strong hover:text-ink"
                        }`}
                      >
                        <Languages className="h-3 w-3" />
                        {t("aiProviders.translatorRole")}
                      </button>

                      <button
                        type="button"
                        disabled={testState?.loading}
                        onClick={() => void handleTestCard(provider.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-edge-strong bg-surface px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                      >
                        {testState?.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plug className="h-3 w-3" />
                        )}
                        {t("aiProviders.testShort")}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditing(provider)}
                        title={t("aiProviders.edit")}
                        className="rounded-lg p-1.5 text-ink-muted hover:bg-surface hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {!isConfirming ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(provider.id)}
                          title={t("projects.delete")}
                          className="rounded-lg p-1.5 text-ink-muted hover:bg-surface hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDelete(provider.id)}
                            className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-500"
                          >
                            {t("projects.confirmDelete")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md bg-surface px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
                          >
                            {t("projects.cancel")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {testState?.result && (
                    <div
                      className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                        testState.result.ok
                          ? "bg-accent-soft text-highlight"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {testState.result.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="flex-1">{testState.result.message}</span>
                      {testState.result.latencyMs > 0 && (
                        <span className="font-mono text-[11px] opacity-80">
                          {testState.result.latencyMs} ms
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
