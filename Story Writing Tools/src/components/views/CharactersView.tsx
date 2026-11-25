import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Clock,
  FolderPlus,
  Hash,
  Layers,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";
import { storageBridge } from "../../services/bridge";
import type {
  CharacterCustomModule,
  CharacterHistoryRecord,
  CharacterRecord,
} from "../../types/electron";
import { CustomModulesEditor } from "../characters/CustomModulesEditor";

type EditorTab = "profile" | "modules" | "history";

interface CharacterFormState {
  name: string;
  gender: string;
  age: string;
  family: string;
  abilities: string;
  personality: string;
  appearance: string;
  alignment: number;
  about: string;
  customModules: CharacterCustomModule[];
}

const EMPTY_FORM: CharacterFormState = {
  name: "",
  gender: "",
  age: "",
  family: "",
  abilities: "",
  personality: "",
  appearance: "",
  alignment: 50,
  about: "",
  customModules: [],
};

function parseCustomModules(raw: string): CharacterCustomModule[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as CharacterCustomModule[];
    }
  } catch {
    // Fallback
  }
  return [];
}

function getAlignmentMeta(alignment: number): {
  key: "evil" | "gray" | "good";
  badgeClass: string;
} {
  if (alignment <= 33) {
    return {
      key: "evil",
      badgeClass: "bg-red-500/15 text-red-400 border-red-500/30",
    };
  }
  if (alignment <= 66) {
    return {
      key: "gray",
      badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    };
  }
  return {
    key: "good",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
}

export function CharactersView() {
  const { t } = useTranslation();
  const { activeProject, openProjectModal } = useApp();

  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("profile");
  const [form, setForm] = useState<CharacterFormState>(EMPTY_FORM);

  const [history, setHistory] = useState<CharacterHistoryRecord[]>([]);
  const [historyChapter, setHistoryChapter] = useState("");
  const [historySummary, setHistorySummary] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadCharacters = useCallback(async (projectId: number) => {
    const list = await storageBridge.listCharacters(projectId);
    setCharacters(list);
    return list;
  }, []);

  const loadHistory = useCallback(async (characterId: number) => {
    const items = await storageBridge.listCharacterHistory(characterId);
    setHistory(items);
  }, []);

  useEffect(() => {
    if (!activeProject) {
      setCharacters([]);
      setSelectedId(null);
      setHistory([]);
      return;
    }

    let cancelled = false;
    void loadCharacters(activeProject.id).then((list) => {
      if (cancelled) return;
      if (list.length > 0) {
        setSelectedId(list[0].id);
      } else {
        setSelectedId("new");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeProject?.id, loadCharacters]);

  const selectedCharacter = useMemo(
    () =>
      typeof selectedId === "number"
        ? characters.find((c) => c.id === selectedId) ?? null
        : null,
    [characters, selectedId]
  );

  useEffect(() => {
    setConfirmDelete(false);
    setError(null);
    setSavedToast(false);

    if (selectedId === "new" || !selectedCharacter) {
      setForm(EMPTY_FORM);
      setHistory([]);
      if (activeTab === "history") {
        setActiveTab("profile");
      }
      return;
    }

    setForm({
      name: selectedCharacter.name,
      gender: selectedCharacter.gender,
      age: selectedCharacter.age,
      family: selectedCharacter.family,
      abilities: selectedCharacter.abilities,
      personality: selectedCharacter.personality,
      appearance: selectedCharacter.appearance,
      alignment: selectedCharacter.alignment,
      about: selectedCharacter.about,
      customModules: parseCustomModules(selectedCharacter.customModulesJson),
    });

    void loadHistory(selectedCharacter.id);
  }, [selectedCharacter, selectedId, loadHistory]);

  if (!activeProject) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-2xl border border-dashed border-edge-strong bg-surface p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Users className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-ink">
          {t("worldView.noProjectTitle")}
        </h3>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {t("charactersView.noProjectSubtitle")}
        </p>
        <button
          type="button"
          onClick={openProjectModal}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
        >
          <FolderPlus className="h-4 w-4" />
          {t("placeholder.openProjects")}
        </button>
      </div>
    );
  }

  const filteredCharacters = characters.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const alignmentMeta = getAlignmentMeta(form.alignment);

  const handleSaveCharacter = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!form.name.trim()) {
      setError(t("charactersView.nameRequired"));
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        gender: form.gender.trim(),
        age: form.age.trim(),
        family: form.family.trim(),
        abilities: form.abilities.trim(),
        personality: form.personality.trim(),
        appearance: form.appearance.trim(),
        alignment: form.alignment,
        about: form.about.trim(),
        customModulesJson: JSON.stringify(form.customModules),
      };

      if (typeof selectedId === "number") {
        const updated = await storageBridge.updateCharacter(selectedId, payload);
        setCharacters((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      } else {
        const created = await storageBridge.createCharacter(
          activeProject.id,
          payload
        );
        setCharacters((prev) => [...prev, created]);
        setSelectedId(created.id);
      }

      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("charactersView.saveError")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCharacter = async () => {
    if (typeof selectedId !== "number") return;
    await storageBridge.deleteCharacter(selectedId);
    const remaining = characters.filter((c) => c.id !== selectedId);
    setCharacters(remaining);
    setConfirmDelete(false);
    setSelectedId(remaining.length > 0 ? remaining[0].id : "new");
  };

  const handleAddHistory = async (event: FormEvent) => {
    event.preventDefault();
    if (typeof selectedId !== "number" || !historySummary.trim()) return;

    const chapterNum =
      historyChapter.trim() === "" ? null : Number(historyChapter.trim());

    await storageBridge.addCharacterHistory(selectedId, {
      chapterNumber:
        chapterNum !== null && Number.isFinite(chapterNum) ? chapterNum : null,
      changeSummary: historySummary.trim(),
    });

    setHistoryChapter("");
    setHistorySummary("");
    await loadHistory(selectedId);
  };

  const handleDeleteHistory = async (historyId: number) => {
    if (typeof selectedId !== "number") return;
    await storageBridge.deleteCharacterHistory(historyId);
    await loadHistory(selectedId);
  };

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-5 lg:flex-row">
      {/* Left Roster Panel */}
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-edge bg-surface p-4 shadow-sm lg:w-72">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-ink">
            {t("charactersView.rosterTitle")} ({characters.length})
          </h3>
          <button
            type="button"
            onClick={() => {
              setSelectedId("new");
              setActiveTab("profile");
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {t("charactersView.newButton")}
          </button>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("charactersView.searchPlaceholder")}
            className="w-full rounded-lg border border-edge bg-elevated py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Character List */}
        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
          {filteredCharacters.length === 0 ? (
            <p className="rounded-xl border border-dashed border-edge bg-elevated/35 p-4 text-center text-xs text-ink-muted">
              {t("charactersView.emptyRoster")}
            </p>
          ) : (
            filteredCharacters.map((char) => {
              const isSelected = selectedId === char.id;
              const align = getAlignmentMeta(char.alignment);
              const moduleCount = parseCustomModules(
                char.customModulesJson
              ).length;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => setSelectedId(char.id)}
                  className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-accent bg-accent-soft"
                      : "border-edge bg-elevated/60 hover:border-edge-strong"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-sm font-semibold text-ink">
                      {char.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${align.badgeClass}`}
                    >
                      {t(`charactersView.alignment.${align.key}`)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span className="truncate">
                      {[char.gender, char.age].filter(Boolean).join(" · ") ||
                        "—"}
                    </span>
                    {moduleCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-accent">
                        <Layers className="h-3 w-3" />
                        {moduleCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Character Editor Panel */}
      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-edge bg-surface p-6 shadow-sm">
        {/* Top Editor Bar */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-edge pb-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">
              {selectedCharacter
                ? selectedCharacter.name
                : t("charactersView.createHeading")}
            </h3>
            {selectedCharacter && (
              <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
                <Hash className="h-3 w-3 text-highlight" />
                ContentHash: {selectedCharacter.contentHash.slice(0, 16)}…
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCharacter &&
              (!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-xs font-medium text-ink-secondary hover:border-red-400 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("projects.delete")}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleDeleteCharacter()}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    {t("projects.confirmDelete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg bg-elevated px-3 py-2 text-xs text-ink-secondary hover:text-ink"
                  >
                    {t("projects.cancel")}
                  </button>
                </div>
              ))}

            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSaveCharacter()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {savedToast ? (
                <>
                  <Check className="h-4 w-4" />
                  {t("worldView.saved")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t("worldView.saveChanges")}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === "profile"
                ? "bg-accent text-accent-fg"
                : "bg-elevated text-ink-secondary hover:text-ink"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            {t("charactersView.tabs.profile")}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("modules")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === "modules"
                ? "bg-accent text-accent-fg"
                : "bg-elevated text-ink-secondary hover:text-ink"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            {t("charactersView.tabs.modules")} ({form.customModules.length})
          </button>

          <button
            type="button"
            disabled={!selectedCharacter}
            onClick={() => setActiveTab("history")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-45 ${
              activeTab === "history"
                ? "bg-accent text-accent-fg"
                : "bg-elevated text-ink-secondary hover:text-ink"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {t("charactersView.tabs.history")} ({history.length})
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/15 px-3.5 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {/* Tab Body */}
        <div className="mt-5 flex-1 overflow-y-auto pr-1">
          {activeTab === "profile" && (
            <form
              onSubmit={(e) => void handleSaveCharacter(e)}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="block text-xs font-medium text-ink-secondary">
                    {t("charactersView.fields.name")} *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder={t("charactersView.placeholders.name")}
                    className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink-secondary">
                    {t("charactersView.fields.gender")}
                  </label>
                  <input
                    type="text"
                    value={form.gender}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, gender: e.target.value }))
                    }
                    className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink-secondary">
                    {t("charactersView.fields.age")}
                  </label>
                  <input
                    type="text"
                    value={form.age}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, age: e.target.value }))
                    }
                    className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Alignment Slider (0 - 100: Evil / Gray / Good) */}
              <div className="rounded-xl border border-edge bg-elevated/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="alignment-slider"
                    className="text-xs font-semibold text-ink"
                  >
                    {t("charactersView.fields.alignment")}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-ink">
                      {form.alignment} / 100
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${alignmentMeta.badgeClass}`}
                    >
                      {t(`charactersView.alignment.${alignmentMeta.key}`)}
                    </span>
                  </div>
                </div>

                <input
                  id="alignment-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={form.alignment}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      alignment: Number(e.target.value),
                    }))
                  }
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full"
                  style={{
                    background:
                      "linear-gradient(to right, #ef4444 0%, #ef4444 33%, #f59e0b 33%, #f59e0b 66%, #10b981 66%, #10b981 100%)",
                  }}
                />
                <div className="mt-1.5 flex justify-between text-[11px] text-ink-muted">
                  <span>0–33 · {t("charactersView.alignment.evil")}</span>
                  <span>34–66 · {t("charactersView.alignment.gray")}</span>
                  <span>67–100 · {t("charactersView.alignment.good")}</span>
                </div>
              </div>

              {/* Remaining Standard Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink-secondary">
                    {t("charactersView.fields.family")}
                  </label>
                  <input
                    type="text"
                    value={form.family}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, family: e.target.value }))
                    }
                    className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink-secondary">
                    {t("charactersView.fields.abilities")}
                  </label>
                  <input
                    type="text"
                    value={form.abilities}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        abilities: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink-secondary">
                    {t("charactersView.fields.personality")}
                  </label>
                  <textarea
                    rows={3}
                    value={form.personality}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        personality: e.target.value,
                      }))
                    }
                    className="w-full resize-none rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink-secondary">
                    {t("charactersView.fields.appearance")}
                  </label>
                  <textarea
                    rows={3}
                    value={form.appearance}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appearance: e.target.value,
                      }))
                    }
                    className="w-full resize-none rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-medium text-ink-secondary">
                    {t("charactersView.fields.about")}
                  </label>
                  <textarea
                    rows={4}
                    value={form.about}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, about: e.target.value }))
                    }
                    className="w-full resize-y rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </form>
          )}

          {activeTab === "modules" && (
            <CustomModulesEditor
              modules={form.customModules}
              onChange={(nextModules) =>
                setForm((prev) => ({ ...prev, customModules: nextModules }))
              }
            />
          )}

          {activeTab === "history" && selectedCharacter && (
            <div className="flex flex-col gap-5">
              {/* Append Progression Form */}
              <form
                onSubmit={(e) => void handleAddHistory(e)}
                className="rounded-xl border border-edge bg-elevated/60 p-4"
              >
                <h5 className="text-xs font-semibold uppercase tracking-wider text-ink">
                  {t("charactersView.history.addTitle")}
                </h5>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  {t("charactersView.history.addSubtitle")}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                  <input
                    type="number"
                    min={1}
                    value={historyChapter}
                    onChange={(e) => setHistoryChapter(e.target.value)}
                    placeholder={t("charactersView.history.chapterPlaceholder")}
                    className="rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:col-span-3"
                  />
                  <input
                    type="text"
                    value={historySummary}
                    onChange={(e) => setHistorySummary(e.target.value)}
                    placeholder={t("charactersView.history.summaryPlaceholder")}
                    className="rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:col-span-7"
                  />
                  <button
                    type="submit"
                    disabled={!historySummary.trim()}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50 sm:col-span-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("charactersView.history.addButton")}
                  </button>
                </div>
              </form>

              {/* Chronological Timeline */}
              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-edge-strong bg-elevated/30 p-6 text-center text-xs text-ink-secondary">
                  {t("charactersView.history.empty")}
                </div>
              ) : (
                <ol className="relative ml-3 space-y-3 border-l-2 border-edge-strong pl-5">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="relative rounded-xl border border-edge bg-elevated/70 p-3.5"
                    >
                      <span className="absolute top-4 -left-[27px] h-3 w-3 rounded-full border-2 border-surface bg-accent" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-ink">
                            {entry.changeSummary}
                            {entry.chapterNumber !== null && (
                              <span className="ml-2 inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                                {t("charactersView.history.inChapter", {
                                  num: entry.chapterNumber,
                                })}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteHistory(entry.id)}
                          title={t("projects.delete")}
                          className="rounded-md p-1 text-ink-muted hover:bg-surface hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
