import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowLeftRight,
  BookA,
  Check,
  FolderPlus,
  Languages,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";
import { storageBridge } from "../../services/bridge";
import type {
  ChapterRecord,
  ChapterTranslationRecord,
  GlossaryTermRecord,
} from "../../types/electron";

type WorkspaceTab = "translate" | "glossary";

const COMMON_LANGUAGES = [
  { code: "tr", tr: "Türkçe", en: "Turkish" },
  { code: "en", tr: "İngilizce", en: "English" },
  { code: "de", tr: "Almanca", en: "German" },
  { code: "ja", tr: "Japonca", en: "Japanese" },
  { code: "fr", tr: "Fransızca", en: "French" },
  { code: "es", tr: "İspanyolca", en: "Spanish" },
  { code: "ru", tr: "Rusça", en: "Russian" },
  { code: "ko", tr: "Korece", en: "Korean" },
  { code: "it", tr: "İtalyanca", en: "Italian" },
  { code: "ar", tr: "Arapça", en: "Arabic" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function TranslationView() {
  const { t } = useTranslation();
  const { activeProject, language, openProjectModal, refreshDbInfo } = useApp();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("translate");

  // Translation Studio state
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(
    null
  );
  const [chapterTranslations, setChapterTranslations] = useState<
    ChapterTranslationRecord[]
  >([]);
  const [sourceLang, setSourceLang] = useState("tr");
  const [targetLang, setTargetLang] = useState("en");
  const [customTargetLang, setCustomTargetLang] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSavingTranslation, setIsSavingTranslation] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Glossary state (Two-column: Left Term | Right Description & Usage Rule)
  const [glossary, setGlossary] = useState<GlossaryTermRecord[]>([]);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const effectiveTargetLang =
    targetLang === "__custom__" ? customTargetLang.trim() : targetLang;

  const loadProjectData = useCallback(async (projectId: number) => {
    const [chList, terms] = await Promise.all([
      storageBridge.listChapters(projectId),
      storageBridge.listGlossaryTerms(projectId),
    ]);
    setChapters(chList);
    setGlossary(terms);
    return chList;
  }, []);

  useEffect(() => {
    if (!activeProject) {
      setChapters([]);
      setGlossary([]);
      setSelectedChapterId(null);
      setChapterTranslations([]);
      return;
    }

    let cancelled = false;
    void loadProjectData(activeProject.id).then((chList) => {
      if (cancelled) return;
      setSelectedChapterId(chList.length > 0 ? chList[0].id : null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id, loadProjectData]);

  const loadTranslationsForChapter = useCallback(async (chapterId: number) => {
    const list = await storageBridge.listChapterTranslations(chapterId);
    setChapterTranslations(list);
    return list;
  }, []);

  useEffect(() => {
    if (selectedChapterId === null) {
      setChapterTranslations([]);
      setTranslatedText("");
      return;
    }
    void loadTranslationsForChapter(selectedChapterId);
  }, [selectedChapterId, loadTranslationsForChapter]);

  // Sync translatedText editor when targetLang or chapterTranslations change
  useEffect(() => {
    const matched = chapterTranslations.find(
      (tr) => tr.targetLang.toLowerCase() === effectiveTargetLang.toLowerCase()
    );
    setTranslatedText(matched?.translatedText ?? "");
  }, [chapterTranslations, effectiveTargetLang]);

  const selectedChapter = useMemo(
    () => chapters.find((ch) => ch.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId]
  );

  const activeSavedTranslation = useMemo(
    () =>
      chapterTranslations.find(
        (tr) => tr.targetLang.toLowerCase() === effectiveTargetLang.toLowerCase()
      ) ?? null,
    [chapterTranslations, effectiveTargetLang]
  );

  if (!activeProject) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-2xl border border-dashed border-edge-strong bg-surface p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Languages className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-ink">
          {t("worldView.noProjectTitle")}
        </h3>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {t("translationView.noProjectSubtitle")}
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

  const handleSwapLanguages = () => {
    if (targetLang === "__custom__") return;
    const prevSource = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(prevSource);
  };

  const getLangDisplay = (code: string): string => {
    const found = COMMON_LANGUAGES.find((l) => l.code === code);
    if (!found) return code;
    return language === "en" ? found.en : found.tr;
  };

  const handleAiTranslate = async () => {
    if (!selectedChapter) return;
    if (!effectiveTargetLang) {
      setError(t("translationView.targetLangRequired"));
      return;
    }

    setIsTranslating(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await storageBridge.translateChapterWithGlossary({
        projectId: activeProject.id,
        chapterId: selectedChapter.id,
        sourceLang: getLangDisplay(sourceLang),
        targetLang: effectiveTargetLang,
      });
      await loadTranslationsForChapter(selectedChapter.id);
      setTranslatedText(result.translation.translatedText);
      await refreshDbInfo();
      setStatusMessage(
        t("translationView.aiTranslatedSuccess", {
          count: result.glossaryTermsInjected,
          model: result.model,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("translationView.translateError")
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveManualTranslation = async () => {
    if (!selectedChapter || !effectiveTargetLang) return;
    setIsSavingTranslation(true);
    setError(null);
    try {
      await storageBridge.upsertChapterTranslation(
        selectedChapter.id,
        sourceLang,
        effectiveTargetLang,
        translatedText
      );
      await loadTranslationsForChapter(selectedChapter.id);
      await refreshDbInfo();
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 1800);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("translationView.saveError")
      );
    } finally {
      setIsSavingTranslation(false);
    }
  };

  const handleAddGlossaryTerm = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTerm.trim() || !newDescription.trim()) return;
    const created = await storageBridge.createGlossaryTerm(
      activeProject.id,
      newTerm.trim(),
      newDescription.trim()
    );
    setGlossary((prev) =>
      [...prev, created].sort((a, b) => a.term.localeCompare(b.term))
    );
    setNewTerm("");
    setNewDescription("");
  };

  const handleUpdateGlossaryTerm = async (item: GlossaryTermRecord) => {
    if (!item.term.trim() || !item.description.trim()) return;
    await storageBridge.updateGlossaryTerm(
      item.id,
      item.term.trim(),
      item.description.trim()
    );
  };

  const handleDeleteGlossaryTerm = async (termId: number) => {
    await storageBridge.deleteGlossaryTerm(termId);
    setGlossary((prev) => prev.filter((g) => g.id !== termId));
  };

  const filteredGlossary = glossary.filter(
    (g) =>
      g.term.toLowerCase().includes(glossarySearch.trim().toLowerCase()) ||
      g.description.toLowerCase().includes(glossarySearch.trim().toLowerCase())
  );

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-5">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {t("sections.translation.title")}
          </h3>
          <p className="mt-1 text-xs text-ink-secondary">
            {t("sections.translation.subtitle")}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-edge bg-surface p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("translate")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === "translate"
                ? "bg-accent text-accent-fg shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            {t("translationView.tabs.studio")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("glossary")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === "glossary"
                ? "bg-accent text-accent-fg shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <BookA className="h-3.5 w-3.5" />
            {t("translationView.tabs.glossary")} ({glossary.length})
          </button>
        </div>
      </div>

      {activeTab === "translate" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Controls Bar: Chapter + Source -> Target Language + AI Translate */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-surface p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Chapter Picker */}
              <select
                value={selectedChapterId ?? ""}
                onChange={(e) =>
                  setSelectedChapterId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none"
              >
                {chapters.length === 0 ? (
                  <option value="">{t("translationView.noChapters")}</option>
                ) : (
                  chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.chapterNumber}. {ch.title}
                    </option>
                  ))
                )}
              </select>

              {/* Source Language */}
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="rounded-lg border border-edge-strong bg-elevated px-2.5 py-2 text-xs text-ink focus:border-accent focus:outline-none"
              >
                {COMMON_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {language === "en" ? l.en : l.tr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSwapLanguages}
                title={t("translationView.swapLangs")}
                className="rounded-lg border border-edge bg-elevated p-2 text-ink-secondary hover:border-accent hover:text-accent"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>

              {/* Target Language */}
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="rounded-lg border border-edge-strong bg-elevated px-2.5 py-2 text-xs text-ink focus:border-accent focus:outline-none"
              >
                {COMMON_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {language === "en" ? l.en : l.tr}
                  </option>
                ))}
                <option value="__custom__">
                  {t("translationView.customLanguageOption")}
                </option>
              </select>

              {targetLang === "__custom__" && (
                <input
                  type="text"
                  value={customTargetLang}
                  onChange={(e) => setCustomTargetLang(e.target.value)}
                  placeholder={t("translationView.customLangPlaceholder")}
                  className="w-36 rounded-lg border border-edge-strong bg-elevated px-2.5 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
              )}

              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent">
                <BookA className="h-3 w-3" />
                {t("translationView.glossaryActiveCount", {
                  count: glossary.length,
                })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isTranslating || !selectedChapter}
                onClick={() => void handleAiTranslate()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {isTranslating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {t("translationView.aiTranslateBtn")}
              </button>

              <button
                type="button"
                disabled={isSavingTranslation || !selectedChapter}
                onClick={() => void handleSaveManualTranslation()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-edge-strong bg-elevated px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {savedToast ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-highlight" />
                    {t("worldView.saved")}
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    {t("worldView.saveChanges")}
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/15 px-4 py-2.5 text-xs text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-2.5 text-xs text-highlight">
              <Check className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Side-by-Side Source & Target Translation Panes */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex min-h-[360px] flex-col rounded-2xl border border-edge bg-surface p-4 shadow-sm">
              <div className="mb-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">
                  {t("translationView.sourcePaneTitle")} (
                  {getLangDisplay(sourceLang)})
                </span>
                {selectedChapter && (
                  <span className="text-ink-muted">
                    {selectedChapter.chapterNumber}. {selectedChapter.title}
                  </span>
                )}
              </div>
              <textarea
                readOnly
                value={selectedChapter?.content ?? ""}
                placeholder={t("translationView.sourceEmptyPlaceholder")}
                className="flex-1 resize-none rounded-xl border border-edge bg-elevated/60 p-4 font-display text-sm leading-7 text-ink-secondary focus:outline-none"
              />
            </div>

            <div className="flex min-h-[360px] flex-col rounded-2xl border border-edge bg-surface p-4 shadow-sm">
              <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink">
                  {t("translationView.targetPaneTitle")} (
                  {getLangDisplay(effectiveTargetLang || "—")})
                </span>
                {activeSavedTranslation &&
                  activeSavedTranslation.rawBytes > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 font-mono text-[10px] text-highlight">
                      <Archive className="h-3 w-3" />
                      {formatBytes(activeSavedTranslation.rawBytes)} →{" "}
                      {formatBytes(activeSavedTranslation.compressedBytes)}
                    </span>
                  )}
              </div>
              <textarea
                value={translatedText}
                onChange={(e) => setTranslatedText(e.target.value)}
                placeholder={t("translationView.targetPlaceholder")}
                className="flex-1 resize-none rounded-xl border border-edge-strong bg-elevated p-4 font-display text-sm leading-7 text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Two-Column Technical Terms Glossary (Left: Term | Right: Description & Usage Rule) */
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-2xl border border-edge bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-base font-semibold text-ink">
                {t("translationView.glossaryTitle")}
              </h4>
              <p className="mt-0.5 text-xs text-ink-secondary">
                {t("translationView.glossarySubtitle")}
              </p>
            </div>

            <div className="relative w-60">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                placeholder={t("translationView.glossarySearchPlaceholder")}
                className="w-full rounded-lg border border-edge bg-elevated py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Add Term Two-Column Form */}
          <form
            onSubmit={(e) => void handleAddGlossaryTerm(e)}
            className="grid grid-cols-1 gap-3 rounded-xl border border-edge bg-elevated/60 p-4 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">
                {t("translationView.termColumnLabel")}
              </label>
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder={t("translationView.termPlaceholder")}
                className="w-full rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="mb-1 block text-[11px] font-semibold text-ink-muted">
                {t("translationView.descColumnLabel")}
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t("translationView.descPlaceholder")}
                className="w-full rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex items-end sm:col-span-2">
              <button
                type="submit"
                disabled={!newTerm.trim() || !newDescription.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("worldView.addElement")}
              </button>
            </div>
          </form>

          {/* Two-Column Split List */}
          <div className="flex-1 overflow-y-auto">
            {filteredGlossary.length === 0 ? (
              <div className="rounded-xl border border-dashed border-edge-strong bg-elevated/35 p-8 text-center text-xs text-ink-secondary">
                {t("translationView.glossaryEmpty")}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-edge">
                <div className="grid grid-cols-12 border-b border-edge bg-elevated px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  <div className="col-span-4">
                    {t("translationView.termColumnLabel")}
                  </div>
                  <div className="col-span-7">
                    {t("translationView.descColumnLabel")}
                  </div>
                  <div className="col-span-1 text-right" />
                </div>

                <ul className="divide-y divide-edge">
                  {filteredGlossary.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-12 items-center gap-3 bg-surface px-4 py-2.5 transition-colors hover:bg-elevated/50"
                    >
                      <input
                        type="text"
                        value={item.term}
                        onChange={(e) =>
                          setGlossary((prev) =>
                            prev.map((g) =>
                              g.id === item.id
                                ? { ...g, term: e.target.value }
                                : g
                            )
                          )
                        }
                        onBlur={() => void handleUpdateGlossaryTerm(item)}
                        className="col-span-4 rounded-md bg-transparent font-display text-sm font-semibold text-ink focus:bg-elevated focus:px-2 focus:py-1 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          setGlossary((prev) =>
                            prev.map((g) =>
                              g.id === item.id
                                ? { ...g, description: e.target.value }
                                : g
                            )
                          )
                        }
                        onBlur={() => void handleUpdateGlossaryTerm(item)}
                        className="col-span-7 rounded-md bg-transparent text-xs text-ink-secondary focus:bg-elevated focus:px-2 focus:py-1 focus:outline-none"
                      />
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleDeleteGlossaryTerm(item.id)}
                          title={t("projects.delete")}
                          className="rounded-md p-1 text-ink-muted hover:bg-elevated hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
