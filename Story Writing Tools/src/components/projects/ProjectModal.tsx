import { useEffect, useState, type FormEvent } from "react";
import { BookMarked, Check, FolderPlus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";

export function ProjectModal() {
  const { t } = useTranslation();
  const {
    isProjectModalOpen,
    closeProjectModal,
    projects,
    activeProjectId,
    createProject,
    selectProject,
    deleteProject,
  } = useApp();

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [worldSummary, setWorldSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (!isProjectModalOpen) {
      setConfirmDeleteId(null);
      setError(null);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeProjectModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isProjectModalOpen, closeProjectModal]);

  if (!isProjectModalOpen) {
    return null;
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t("projects.titleRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createProject({
        title: trimmed,
        genre: genre.trim(),
        worldSummary: worldSummary.trim(),
      });
      setTitle("");
      setGenre("");
      setWorldSummary("");
      closeProjectModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("projects.createError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelect = async (id: number) => {
    await selectProject(id);
    closeProjectModal();
  };

  const handleDelete = async (id: number) => {
    await deleteProject(id);
    setConfirmDeleteId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={closeProjectModal}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-edge-strong bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-edge px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <BookMarked className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">
                {t("projects.modalTitle")}
              </h3>
              <p className="text-xs text-ink-secondary">
                {t("projects.modalSubtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeProjectModal}
            aria-label={t("projects.close")}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-2">
          {/* Left Column: Existing Projects */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t("projects.yourBooks")} ({projects.length})
            </h4>

            {projects.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-edge-strong bg-elevated/40 p-6 text-center">
                <BookMarked className="h-8 w-8 text-ink-muted" />
                <p className="mt-3 text-sm font-medium text-ink">
                  {t("projects.emptyTitle")}
                </p>
                <p className="mt-1 text-xs text-ink-secondary">
                  {t("projects.emptySubtitle")}
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {projects.map((project) => {
                  const isActive = project.id === activeProjectId;
                  const isConfirming = confirmDeleteId === project.id;
                  return (
                    <li
                      key={project.id}
                      className={`rounded-xl border transition-all ${
                        isActive
                          ? "border-accent bg-accent-soft"
                          : "border-edge bg-elevated hover:border-edge-strong"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 p-3.5">
                        <button
                          type="button"
                          onClick={() => void handleSelect(project.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate font-display text-sm font-semibold text-ink">
                              {project.title}
                            </span>
                            {isActive && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-fg">
                                <Check className="h-2.5 w-2.5" />
                                {t("projects.activeBadge")}
                              </span>
                            )}
                          </div>
                          {project.genre && (
                            <span className="mt-1 inline-block rounded-md bg-surface px-2 py-0.5 text-[11px] text-ink-secondary">
                              {project.genre}
                            </span>
                          )}
                          {project.worldSummary && (
                            <p className="mt-1.5 line-clamp-2 text-xs text-ink-secondary">
                              {project.worldSummary}
                            </p>
                          )}
                        </button>

                        {!isConfirming ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(project.id)}
                            title={t("projects.delete")}
                            className="shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleDelete(project.id)}
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
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right Column: Create New Book Form */}
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="flex flex-col gap-4 rounded-xl border border-edge bg-elevated/60 p-4"
          >
            <div className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-accent" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                {t("projects.createHeading")}
              </h4>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="book-title"
                className="block text-xs font-medium text-ink-secondary"
              >
                {t("projects.titleLabel")} *
              </label>
              <input
                id="book-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("projects.titlePlaceholder")}
                className="w-full rounded-lg border border-edge-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="book-genre"
                className="block text-xs font-medium text-ink-secondary"
              >
                {t("projects.genreLabel")}
              </label>
              <input
                id="book-genre"
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder={t("projects.genrePlaceholder")}
                className="w-full rounded-lg border border-edge-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="book-summary"
                className="block text-xs font-medium text-ink-secondary"
              >
                {t("projects.summaryLabel")}
              </label>
              <textarea
                id="book-summary"
                rows={4}
                value={worldSummary}
                onChange={(e) => setWorldSummary(e.target.value)}
                placeholder={t("projects.summaryPlaceholder")}
                className="w-full resize-none rounded-lg border border-edge-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              <FolderPlus className="h-4 w-4" />
              {t("projects.createButton")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
