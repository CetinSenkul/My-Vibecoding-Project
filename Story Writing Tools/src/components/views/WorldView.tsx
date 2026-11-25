import { useEffect, useState, type FormEvent } from "react";
import {
  BookOpenText,
  Check,
  FolderPlus,
  Globe2,
  Hash,
  Plus,
  Save,
  Scale,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";
import type { WorldRuleCategory, WorldRuleItem } from "../../types/electron";

const CATEGORIES: {
  id: WorldRuleCategory;
  icon: typeof Scale;
}[] = [
  { id: "rule", icon: Scale },
  { id: "magic_power", icon: Sparkles },
  { id: "faction", icon: Shield },
  { id: "lore", icon: BookOpenText },
];

function parseWorldRules(raw: string): WorldRuleItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is WorldRuleItem =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as WorldRuleItem).id === "string" &&
          typeof (item as WorldRuleItem).title === "string"
      );
    }
  } catch {
    // Fallback to empty list
  }
  return [];
}

export function WorldView() {
  const { t } = useTranslation();
  const { activeProject, updateProjectWorld, openProjectModal } = useApp();

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [worldSummary, setWorldSummary] = useState("");
  const [rules, setRules] = useState<WorldRuleItem[]>([]);
  const [filterCategory, setFilterCategory] = useState<
    WorldRuleCategory | "all"
  >("all");

  const [newCategory, setNewCategory] = useState<WorldRuleCategory>("rule");
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleDesc, setNewRuleDesc] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setTitle("");
      setGenre("");
      setWorldSummary("");
      setRules([]);
      return;
    }
    setTitle(activeProject.title);
    setGenre(activeProject.genre);
    setWorldSummary(activeProject.worldSummary);
    setRules(parseWorldRules(activeProject.worldRulesJson));
    setError(null);
    setSavedFeedback(false);
  }, [activeProject?.id]);

  if (!activeProject) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-2xl border border-dashed border-edge-strong bg-surface p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Globe2 className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-ink">
          {t("worldView.noProjectTitle")}
        </h3>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {t("worldView.noProjectSubtitle")}
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

  const persistWorld = async (nextRules: WorldRuleItem[] = rules) => {
    if (!title.trim()) {
      setError(t("projects.titleRequired"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateProjectWorld(activeProject.id, {
        title: title.trim(),
        genre: genre.trim(),
        worldSummary: worldSummary.trim(),
        worldRulesJson: JSON.stringify(nextRules),
      });
      setSavedFeedback(true);
      window.setTimeout(() => setSavedFeedback(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("worldView.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOverview = (event: FormEvent) => {
    event.preventDefault();
    void persistWorld(rules);
  };

  const handleAddRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!newRuleTitle.trim()) return;
    const item: WorldRuleItem = {
      id: crypto.randomUUID(),
      category: newCategory,
      title: newRuleTitle.trim(),
      description: newRuleDesc.trim(),
    };
    const updated = [...rules, item];
    setRules(updated);
    setNewRuleTitle("");
    setNewRuleDesc("");
    await persistWorld(updated);
  };

  const handleUpdateRuleField = (
    id: string,
    field: "title" | "description" | "category",
    value: string
  ) => {
    setRules((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleDeleteRule = async (id: string) => {
    const updated = rules.filter((item) => item.id !== id);
    setRules(updated);
    await persistWorld(updated);
  };

  const visibleRules =
    filterCategory === "all"
      ? rules
      : rules.filter((r) => r.category === filterCategory);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-8">
      {/* Header + Save Action + Live WorldHash */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {t("sections.world.title")}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Hash className="h-3.5 w-3.5 text-highlight" />
              WorldHash: {activeProject.worldHash.slice(0, 16)}…
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={() => void persistWorld(rules)}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {savedFeedback ? (
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

      {error && (
        <p className="rounded-xl bg-red-500/15 px-4 py-2.5 text-xs text-red-400">
          {error}
        </p>
      )}

      {/* Core World Overview Form */}
      <form
        onSubmit={handleSaveOverview}
        className="rounded-2xl border border-edge bg-surface p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="world-book-title"
              className="block text-xs font-medium text-ink-secondary"
            >
              {t("projects.titleLabel")} *
            </label>
            <input
              id="world-book-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="world-genre"
              className="block text-xs font-medium text-ink-secondary"
            >
              {t("worldView.genreLabel")}
            </label>
            <input
              id="world-genre"
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder={t("projects.genrePlaceholder")}
              className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label
              htmlFor="world-summary"
              className="block text-xs font-medium text-ink-secondary"
            >
              {t("worldView.summaryLabel")}
            </label>
            <textarea
              id="world-summary"
              rows={5}
              value={worldSummary}
              onChange={(e) => setWorldSummary(e.target.value)}
              placeholder={t("worldView.summaryPlaceholder")}
              className="w-full resize-y rounded-lg border border-edge-strong bg-elevated px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </form>

      {/* Structured Rules, Magic Systems, Factions & Lore */}
      <section className="rounded-2xl border border-edge bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-display text-base font-semibold text-ink">
              {t("worldView.elementsTitle")} ({rules.length})
            </h4>
            <p className="mt-0.5 text-xs text-ink-secondary">
              {t("worldView.elementsSubtitle")}
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterCategory("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filterCategory === "all"
                  ? "bg-accent text-accent-fg"
                  : "bg-elevated text-ink-secondary hover:text-ink"
              }`}
            >
              {t("worldView.categories.all")}
            </button>
            {CATEGORIES.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilterCategory(id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  filterCategory === id
                    ? "bg-accent text-accent-fg"
                    : "bg-elevated text-ink-secondary hover:text-ink"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t(`worldView.categories.${id}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Add New Element Form */}
        <form
          onSubmit={(e) => void handleAddRule(e)}
          className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-edge bg-elevated/60 p-4 sm:grid-cols-12"
        >
          <div className="sm:col-span-4">
            <label className="mb-1 block text-[11px] font-medium text-ink-muted">
              {t("worldView.categoryLabel")}
            </label>
            <select
              value={newCategory}
              onChange={(e) =>
                setNewCategory(e.target.value as WorldRuleCategory)
              }
              className="w-full rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
            >
              {CATEGORIES.map(({ id }) => (
                <option key={id} value={id}>
                  {t(`worldView.categories.${id}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-8">
            <label className="mb-1 block text-[11px] font-medium text-ink-muted">
              {t("worldView.elementTitleLabel")}
            </label>
            <input
              type="text"
              value={newRuleTitle}
              onChange={(e) => setNewRuleTitle(e.target.value)}
              placeholder={t("worldView.elementTitlePlaceholder")}
              className="w-full rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="sm:col-span-10">
            <textarea
              rows={2}
              value={newRuleDesc}
              onChange={(e) => setNewRuleDesc(e.target.value)}
              placeholder={t("worldView.elementDescPlaceholder")}
              className="w-full resize-none rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              disabled={!newRuleTitle.trim()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("worldView.addElement")}
            </button>
          </div>
        </form>

        {/* Elements Grid */}
        {visibleRules.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-edge-strong bg-elevated/35 p-6 text-center text-xs text-ink-secondary">
            {t("worldView.emptyElements")}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {visibleRules.map((item) => {
              const catMeta =
                CATEGORIES.find((c) => c.id === item.category) ?? CATEGORIES[0];
              const Icon = catMeta.icon;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border border-edge bg-elevated/75 p-4 transition-colors hover:border-edge-strong"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                      <Icon className="h-3 w-3" />
                      {t(`worldView.categories.${item.category}`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteRule(item.id)}
                      title={t("projects.delete")}
                      className="rounded-md p-1 text-ink-muted hover:bg-surface hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) =>
                      handleUpdateRuleField(item.id, "title", e.target.value)
                    }
                    className="rounded-md bg-transparent font-display text-sm font-semibold text-ink focus:bg-surface focus:px-2 focus:outline-none"
                  />
                  <textarea
                    rows={3}
                    value={item.description}
                    onChange={(e) =>
                      handleUpdateRuleField(
                        item.id,
                        "description",
                        e.target.value
                      )
                    }
                    className="resize-none rounded-md bg-transparent text-xs leading-relaxed text-ink-secondary focus:bg-surface focus:p-2 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
