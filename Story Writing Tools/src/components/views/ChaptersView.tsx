import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  FolderPlus,
  Languages,
  NotebookPen,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";
import { storageBridge } from "../../services/bridge";
import type {
  ChapterRecord,
  ChapterStatus,
  ChapterTranslationRecord,
} from "../../types/electron";
import { AiWritingPanel } from "../chapters/AiWritingPanel";

type ChapterTab = "draft" | "content" | "translations";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ChaptersView() {
  const { t } = useTranslation();
  const { activeProject, openProjectModal, refreshDbInfo } = useApp();

  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ChapterTab>("draft");

  const [newTitle, setNewTitle] = useState("");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ChapterStatus>("Draft");

  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [translations, setTranslations] = useState<ChapterTranslationRecord[]>(
    []
  );
  const [selectedTranslationLang, setSelectedTranslationLang] = useState<
    string | null
  >(null);

  const loadChapters = useCallback(async (projectId: number) => {
    const list = await storageBridge.listChapters(projectId);
    setChapters(list);
    return list;
  }, []);

  useEffect(() => {
    if (!activeProject) {
      setChapters([]);
      setSelectedId(null);
      return;
    }

    let cancelled = false;
    void loadChapters(activeProject.id).then((list) => {
      if (cancelled) return;
      setSelectedId(list.length > 0 ? list[0].id : null);
    });

    return () => {
      cancelled = true;
    };
  }, [activeProject?.id, loadChapters]);

  const selectedChapter = useMemo(
    () => chapters.find((ch) => ch.id === selectedId) ?? null,
    [chapters, selectedId]
  );

  useEffect(() => {
    setConfirmDelete(false);
    setError(null);
    setSavedToast(false);

    if (!selectedChapter) {
      setTitle("");
      setDraftNotes("");
      setContent("");
      setStatus("Draft");
      setChapterNumber(1);
      return;
    }

    setChapterNumber(selectedChapter.chapterNumber);
    setTitle(selectedChapter.title);
    setDraftNotes(selectedChapter.draftNotes);
    setContent(selectedChapter.content);
    setStatus(selectedChapter.status);

    void storageBridge
      .listChapterTranslations(selectedChapter.id)
      .then((list) => {
        setTranslations(list);
        setSelectedTranslationLang(list.length > 0 ? list[0].targetLang : null);
      });
  }, [selectedChapter]);

  const handleSave = useCallback(
    async (overrideStatus?: ChapterStatus, overrideContent?: string) => {
      if (!selectedChapter) return;
      if (!title.trim()) {
        setError(t("chaptersView.titleRequired"));
        return;
      }

      setIsSaving(true);
      setError(null);
      try {
        const nextStatus = overrideStatus ?? status;
        const nextContent = overrideContent ?? content;
        const updated = await storageBridge.updateChapter(selectedChapter.id, {
          chapterNumber,
          title: title.trim(),
          draftNotes,
          content: nextContent,
          status: nextStatus,
        });
        setStatus(updated.status);
        setContent(updated.content);
        setChapters((prev) =>
          prev
            .map((ch) => (ch.id === updated.id ? updated : ch))
            .sort((a, b) => a.chapterNumber - b.chapterNumber)
        );
        await refreshDbInfo();
        setSavedToast(true);
        window.setTimeout(() => setSavedToast(false), 2000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("chaptersView.saveError")
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      selectedChapter,
      title,
      status,
      chapterNumber,
      draftNotes,
      content,
      refreshDbInfo,
      t,
    ]
  );

  // Ctrl+S / Cmd+S quick save shortcut
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        if (selectedChapter) {
          event.preventDefault();
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedChapter, handleSave]);

  if (!activeProject) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-2xl border border-dashed border-edge-strong bg-surface p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <BookOpen className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-ink">
          {t("worldView.noProjectTitle")}
        </h3>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {t("chaptersView.noProjectSubtitle")}
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

  const handleCreateChapter = async (event: FormEvent) => {
    event.preventDefault();
    const nextNum =
      chapters.length > 0
        ? Math.max(...chapters.map((c) => c.chapterNumber)) + 1
        : 1;
    const chapterTitle =
      newTitle.trim() ||
      t("chaptersView.defaultChapterTitle", { num: nextNum });

    const created = await storageBridge.createChapter(activeProject.id, {
      chapterNumber: nextNum,
      title: chapterTitle,
    });
    setChapters((prev) =>
      [...prev, created].sort((a, b) => a.chapterNumber - b.chapterNumber)
    );
    setSelectedId(created.id);
    setNewTitle("");
    setActiveTab("draft");
    await refreshDbInfo();
  };

  const handleDeleteChapter = async () => {
    if (!selectedChapter) return;
    await storageBridge.deleteChapter(selectedChapter.id);
    const remaining = chapters.filter((ch) => ch.id !== selectedChapter.id);
    setChapters(remaining);
    setConfirmDelete(false);
    setSelectedId(remaining.length > 0 ? remaining[0].id : null);
    await refreshDbInfo();
  };

  const wordCount = countWords(content);
  const charCount = content.length;

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-5 lg:flex-row">
      {/* Left: Chapter Slots Sidebar */}
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-edge bg-surface p-4 shadow-sm lg:w-72">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-ink">
            {t("chaptersView.slotsTitle")} ({chapters.length})
          </h3>
        </div>

        {/* Quick Create Chapter Slot */}
        <form onSubmit={(e) => void handleCreateChapter(e)} className="mt-3 flex gap-1.5">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t("chaptersView.newSlotPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-edge bg-elevated px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            title={t("chaptersView.addSlot")}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* Vertical Chapter List */}
        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
          {chapters.length === 0 ? (
            <p className="rounded-xl border border-dashed border-edge bg-elevated/35 p-4 text-center text-xs text-ink-muted">
              {t("chaptersView.emptySlots")}
            </p>
          ) : (
            chapters.map((ch) => {
              const isSelected = ch.id === selectedId;
              const chWords = countWords(ch.content);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedId(ch.id)}
                  className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-accent bg-accent-soft"
                      : "border-edge bg-elevated/60 hover:border-edge-strong"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-xs font-semibold text-ink">
                      {ch.chapterNumber}. {ch.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        ch.status === "Completed"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-surface text-ink-muted"
                      }`}
                    >
                      {t(`chaptersView.status.${ch.status}`)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span>
                      {t("chaptersView.wordCount", { count: chWords })}
                    </span>
                    {ch.compressedBytes > 0 && (
                      <span className="font-mono text-[10px]">
                        {formatBytes(ch.compressedBytes)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chapter Workspace */}
      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-edge bg-surface p-6 shadow-sm">
        {!selectedChapter ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <BookOpen className="h-10 w-10 text-ink-muted" />
            <h4 className="mt-3 font-display text-base font-semibold text-ink">
              {t("chaptersView.selectOrCreateTitle")}
            </h4>
            <p className="mt-1 max-w-sm text-xs text-ink-secondary">
              {t("chaptersView.selectOrCreateSubtitle")}
            </p>
          </div>
        ) : (
          <>
            {/* Top Chapter Meta Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(Number(e.target.value) || 1)}
                  className="w-16 rounded-lg border border-edge-strong bg-elevated px-2.5 py-1.5 text-center font-mono text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-edge-strong bg-elevated px-3 py-1.5 font-display text-base font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleSave(
                      status === "Completed" ? "Draft" : "Completed"
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    status === "Completed"
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : "border-edge-strong bg-elevated text-ink-secondary hover:text-ink"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t(`chaptersView.status.${status}`)}
                </button>

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-lg border border-edge-strong bg-elevated p-2 text-ink-muted hover:border-red-400 hover:text-red-400"
                    title={t("projects.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleDeleteChapter()}
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                    >
                      {t("projects.confirmDelete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-ink-secondary"
                    >
                      {t("projects.cancel")}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowAiPanel((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    showAiPanel
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-edge-strong bg-elevated text-ink-secondary hover:text-ink"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("aiPanel.toggleBtn")}
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  {savedToast ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
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

            {/* Sub-Tabs & Compression Stats */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("draft")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "draft"
                      ? "bg-accent text-accent-fg"
                      : "bg-elevated text-ink-secondary hover:text-ink"
                  }`}
                >
                  <NotebookPen className="h-3.5 w-3.5" />
                  {t("chaptersView.tabs.draft")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("content")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "content"
                      ? "bg-accent text-accent-fg"
                      : "bg-elevated text-ink-secondary hover:text-ink"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t("chaptersView.tabs.content")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("translations")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "translations"
                      ? "bg-accent text-accent-fg"
                      : "bg-elevated text-ink-secondary hover:text-ink"
                  }`}
                >
                  <Languages className="h-3.5 w-3.5" />
                  {t("chaptersView.tabs.translations")}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
                <span>
                  {t("chaptersView.wordCount", { count: wordCount })} ·{" "}
                  {t("chaptersView.charCount", { count: charCount })}
                </span>
                {selectedChapter.rawBytes > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 font-mono text-[10px] text-highlight">
                    <Archive className="h-3 w-3" />
                    {formatBytes(selectedChapter.rawBytes)} →{" "}
                    {formatBytes(selectedChapter.compressedBytes)}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            {/* Editor Panels */}
            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              {activeTab === "draft" && (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <p className="text-xs text-ink-secondary">
                    {t("chaptersView.draftHint")}
                  </p>
                  <textarea
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder={t("chaptersView.draftPlaceholder")}
                    className="min-h-[340px] flex-1 resize-none rounded-xl border border-edge-strong bg-elevated p-4 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              {activeTab === "content" && (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t("chaptersView.contentPlaceholder")}
                    className="min-h-[380px] flex-1 resize-none rounded-xl border border-edge-strong bg-elevated p-5 font-display text-[15px] leading-8 text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              {activeTab === "translations" &&
                (translations.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-edge-strong bg-elevated/35 p-8 text-center">
                    <Languages className="h-8 w-8 text-ink-muted" />
                    <p className="mt-3 text-sm font-medium text-ink">
                      {t("chaptersView.translationsEmptyTitle")}
                    </p>
                    <p className="mt-1 max-w-md text-xs text-ink-secondary">
                      {t("chaptersView.translationsEmptySubtitle")}
                    </p>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {translations.map((tr) => (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() =>
                              setSelectedTranslationLang(tr.targetLang)
                            }
                            className={`rounded-lg border px-3 py-1 text-xs font-semibold uppercase transition-colors ${
                              selectedTranslationLang === tr.targetLang
                                ? "border-accent bg-accent text-accent-fg"
                                : "border-edge bg-elevated text-ink-secondary hover:text-ink"
                            }`}
                          >
                            {tr.targetLang}
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const activeTr = translations.find(
                          (tr) => tr.targetLang === selectedTranslationLang
                        );
                        if (!activeTr) return null;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 font-mono text-[10px] text-highlight">
                              <Archive className="h-3 w-3" />
                              {formatBytes(activeTr.rawBytes)} →{" "}
                              {formatBytes(activeTr.compressedBytes)}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await storageBridge.deleteChapterTranslation(
                                  activeTr.id
                                );
                                const next = translations.filter(
                                  (tr) => tr.id !== activeTr.id
                                );
                                setTranslations(next);
                                setSelectedTranslationLang(
                                  next[0]?.targetLang ?? null
                                );
                              }}
                              title={t("projects.delete")}
                              className="rounded-md p-1 text-ink-muted hover:bg-elevated hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                    <textarea
                      readOnly
                      value={
                        translations.find(
                          (tr) => tr.targetLang === selectedTranslationLang
                        )?.translatedText ?? ""
                      }
                      className="min-h-[340px] flex-1 resize-none rounded-xl border border-edge bg-elevated p-5 font-display text-[15px] leading-8 text-ink focus:outline-none"
                    />
                  </div>
                ))}
            </div>
          </>
        )}
      </section>

      {/* Right: AI Metrics & 5-Step Writing Engine Side Panel */}
      {selectedChapter && showAiPanel && (
        <AiWritingPanel
          projectId={activeProject.id}
          chapter={selectedChapter}
          currentContent={content}
          onSyncDraftBeforeAi={async () => {
            await handleSave();
          }}
          onApplyProse={async (prose) => {
            setContent(prose);
            setActiveTab("content");
            await handleSave(status, prose);
          }}
          onCompleteChapter={async () => {
            await handleSave("Completed", content);
          }}
        />
      )}
    </div>
  );
}
