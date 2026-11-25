import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  Sliders,
  Sparkles,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { WRITING_LANGUAGES, WRITING_STYLES } from "../../constants/aiMetrics";
import { useApp } from "../../context/AppContext";
import { storageBridge } from "../../services/bridge";
import type {
  AiWritingMetrics,
  ChapterLengthOption,
  ChapterRecord,
  CharacterProgressionCandidate,
  DeltaScanReport,
} from "../../types/electron";

interface AiWritingPanelProps {
  projectId: number;
  chapter: ChapterRecord;
  currentContent: string;
  onSyncDraftBeforeAi: () => Promise<void>;
  onApplyProse: (prose: string) => Promise<void>;
  onCompleteChapter: () => Promise<void>;
}

type WorkflowStage =
  | "idle"
  | "outline_review"
  | "prose_review"
  | "refining_feedback"
  | "progression_review";

export function AiWritingPanel({
  projectId,
  chapter,
  currentContent,
  onSyncDraftBeforeAi,
  onApplyProse,
  onCompleteChapter,
}: AiWritingPanelProps) {
  const { t } = useTranslation();
  const { language } = useApp();

  // AI Metrics state
  const [interventionPercent, setInterventionPercent] = useState(35);
  const [lengthOption, setLengthOption] =
    useState<ChapterLengthOption>("approximate");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([
    "cinematic",
    "emotional",
  ]);
  const [writingLanguage, setWritingLanguage] = useState("literary");
  const [metricsExpanded, setMetricsExpanded] = useState(true);

  // 5-Step Workflow state
  const [stage, setStage] = useState<WorkflowStage>("idle");
  const [deltaReport, setDeltaReport] = useState<DeltaScanReport | null>(null);
  const [outline, setOutline] = useState("");
  const [outlineFeedback, setOutlineFeedback] = useState("");
  const [proseFeedback, setProseFeedback] = useState("");
  const [lastModel, setLastModel] = useState("");
  const [progressionCandidates, setProgressionCandidates] = useState<
    CharacterProgressionCandidate[]
  >([]);
  const [approvedIndices, setApprovedIndices] = useState<Set<number>>(
    new Set()
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset workflow cleanly when switching chapters
  useEffect(() => {
    setStage("idle");
    setOutline("");
    setOutlineFeedback("");
    setProseFeedback("");
    setProgressionCandidates([]);
    setApprovedIndices(new Set());
    setError(null);
    void storageBridge.previewDeltaScan(projectId).then(setDeltaReport);
  }, [projectId, chapter.id]);

  const toggleStyle = (styleId: string) => {
    setSelectedStyles((prev) =>
      prev.includes(styleId)
        ? prev.filter((id) => id !== styleId)
        : [...prev, styleId]
    );
  };

  const buildMetrics = (): AiWritingMetrics => {
    const langKey = language === "en" ? "en" : "tr";
    const styleLabels = WRITING_STYLES.filter((s) =>
      selectedStyles.includes(s.id)
    ).map((s) => s[langKey]);
    const languageLabel =
      WRITING_LANGUAGES.find((l) => l.id === writingLanguage)?.[langKey] ??
      WRITING_LANGUAGES[0][langKey];

    return {
      interventionPercent,
      lengthOption,
      writingStyles: styleLabels,
      writingLanguage: languageLabel,
      outputLanguage: langKey,
    };
  };

  // Steps 1 + 2 + 3: Smart Delta Scan -> Draft Scan -> Generate Outline (Approval Locked)
  const handleGenerateOutline = async (withFeedback = false) => {
    setIsLoading(true);
    setError(null);
    try {
      await onSyncDraftBeforeAi();
      const result = await storageBridge.generateChapterOutline({
        projectId,
        chapterId: chapter.id,
        metrics: buildMetrics(),
        previousOutline: withFeedback ? outline : undefined,
        outlineFeedback: withFeedback ? outlineFeedback.trim() : undefined,
      });
      setOutline(result.outline);
      setDeltaReport(result.deltaReport);
      setLastModel(result.model);
      setOutlineFeedback("");
      setStage("outline_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("aiPanel.genericError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Explicitly unlock & write prose (initial or feedback iteration)
  const handleWriteProse = async (isIteration: boolean) => {
    if (!outline.trim()) return;
    if (isIteration && !proseFeedback.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      await onSyncDraftBeforeAi();
      const result = await storageBridge.writeChapterProse({
        projectId,
        chapterId: chapter.id,
        approvedOutline: outline,
        outlineApproved: true,
        metrics: buildMetrics(),
        previousProse: isIteration ? currentContent : undefined,
        userFeedback: isIteration ? proseFeedback.trim() : undefined,
      });
      await onApplyProse(result.prose);
      setLastModel(result.model);
      setProseFeedback("");
      setStage("prose_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("aiPanel.genericError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4 -> Step 5: Complete Chapter & Detect Character Progression
  const handleCompleteAndDetect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onCompleteChapter();
      const candidates = await storageBridge.detectCharacterProgression({
        projectId,
        chapterId: chapter.id,
        outputLanguage: language === "en" ? "en" : "tr",
      });
      setProgressionCandidates(candidates);
      setApprovedIndices(new Set());
      setStage("progression_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("aiPanel.genericError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveProgression = async (
    index: number,
    candidate: CharacterProgressionCandidate
  ) => {
    await storageBridge.addCharacterHistory(candidate.characterId, {
      chapterNumber: chapter.chapterNumber,
      changeSummary: candidate.changeSummary,
    });
    setApprovedIndices((prev) => new Set(prev).add(index));
  };

  const handleDismissProgression = (index: number) => {
    setProgressionCandidates((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm xl:w-96">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2 border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-display text-sm font-semibold text-ink">
              {t("aiPanel.title")}
            </h4>
            {lastModel && (
              <p className="font-mono text-[10px] text-ink-muted">{lastModel}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMetricsExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-edge bg-elevated px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink"
        >
          <Sliders className="h-3 w-3" />
          {t("aiPanel.metricsToggle")}
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Step 1 Delta Scan Status Pill */}
        {deltaReport && (
          <div className="rounded-xl border border-edge bg-elevated/60 px-3 py-2 text-[11px] text-ink-secondary">
            <span className="font-semibold text-ink">
              {t("aiPanel.deltaTitle")}:{" "}
            </span>
            {t("aiPanel.deltaSummary", {
              changed:
                deltaReport.changedCharactersCount +
                (deltaReport.worldChanged ? 1 : 0),
              cached:
                deltaReport.unchangedCharactersCount +
                (deltaReport.worldChanged ? 0 : 1),
            })}
          </div>
        )}

        {/* AI Metrics Controls */}
        {metricsExpanded && (
          <div className="space-y-4 rounded-xl border border-edge bg-elevated/45 p-3.5">
            {/* Intervention Slider 0-100 */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-ink">
                  {t("aiPanel.interventionLabel")}
                </label>
                <span className="font-mono font-semibold text-accent">
                  {interventionPercent}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={interventionPercent}
                onChange={(e) => setInterventionPercent(Number(e.target.value))}
                className="mt-2 w-full accent-accent"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-ink-muted">
                <span>{t("aiPanel.interventionLow")}</span>
                <span>{t("aiPanel.interventionHigh")}</span>
              </div>
            </div>

            {/* Chapter Length (3 Options) */}
            <div>
              <label className="block text-xs font-medium text-ink">
                {t("aiPanel.lengthLabel")}
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(
                  ["shorten", "approximate", "extend"] as ChapterLengthOption[]
                ).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLengthOption(opt)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      lengthOption === opt
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-edge bg-surface text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {t(`aiPanel.lengths.${opt}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Writing Language (10 Options) */}
            <div>
              <label className="block text-xs font-medium text-ink">
                {t("aiPanel.writingLanguageLabel")}
              </label>
              <select
                value={writingLanguage}
                onChange={(e) => setWritingLanguage(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-edge-strong bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                {WRITING_LANGUAGES.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {language === "en" ? opt.en : opt.tr}
                  </option>
                ))}
              </select>
            </div>

            {/* Writing Styles (20 Multi-Select Options) */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-ink">
                  {t("aiPanel.writingStylesLabel")}
                </label>
                <span className="text-[11px] text-ink-muted">
                  {selectedStyles.length}/20
                </span>
              </div>
              <div className="mt-1.5 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {WRITING_STYLES.map((style) => {
                  const active = selectedStyles.includes(style.id);
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => toggleStyle(style.id)}
                      className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                        active
                          ? "border-accent bg-accent-soft font-medium text-accent"
                          : "border-edge bg-surface text-ink-secondary hover:text-ink"
                      }`}
                    >
                      {language === "en" ? style.en : style.tr}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/15 p-3 text-xs text-red-400">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 5-Step Workflow Controls */}
        <div className="space-y-3 rounded-xl border border-edge bg-elevated/45 p-3.5">
          {/* Step 1-3 Action */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleGenerateOutline(false)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {isLoading && stage === "idle" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {t("aiPanel.generateOutlineBtn")}
          </button>

          {/* Step 3 Outline Review + Approval Lock */}
          {outline && (
            <div className="space-y-2.5 border-t border-edge pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">
                  {t("aiPanel.step3Title")}
                </span>
                {stage === "outline_review" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    <Lock className="h-2.5 w-2.5" />
                    {t("aiPanel.approvalLockBadge")}
                  </span>
                )}
              </div>

              <textarea
                rows={7}
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                className="w-full resize-y rounded-lg border border-edge-strong bg-surface p-2.5 text-xs leading-relaxed text-ink focus:border-accent focus:outline-none"
              />

              {stage === "outline_review" && (
                <>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={outlineFeedback}
                      onChange={(e) => setOutlineFeedback(e.target.value)}
                      placeholder={t("aiPanel.outlineFeedbackPlaceholder")}
                      className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isLoading || !outlineFeedback.trim()}
                      onClick={() => void handleGenerateOutline(true)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-edge-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t("aiPanel.reviseOutline")}
                    </button>
                  </div>

                  {/* Mandatory Approval Gate Button */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleWriteProse(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {t("aiPanel.startWritingBtn")}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 4 Post-Write Two Mandatory Action Buttons */}
          {(stage === "prose_review" || stage === "refining_feedback") && (
            <div className="space-y-2.5 border-t border-edge pt-3">
              <p className="text-xs font-semibold text-ink">
                {t("aiPanel.step4Title")}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setStage("refining_feedback")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("aiPanel.continueImprovingBtn")}
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void handleCompleteAndDetect()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {t("aiPanel.completeChapterBtn")}
                </button>
              </div>

              {/* Feedback Box + Explicit "Yazdır" Trigger */}
              {stage === "refining_feedback" && (
                <div className="space-y-2 rounded-lg border border-edge bg-surface p-2.5">
                  <textarea
                    rows={3}
                    value={proseFeedback}
                    onChange={(e) => setProseFeedback(e.target.value)}
                    placeholder={t("aiPanel.proseFeedbackPlaceholder")}
                    className="w-full resize-none rounded-md border border-edge bg-elevated p-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isLoading || !proseFeedback.trim()}
                    onClick={() => void handleWriteProse(true)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {t("aiPanel.printRewriteBtn")}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 5 Character Progression Approval Cards */}
          {stage === "progression_review" && (
            <div className="space-y-2.5 border-t border-edge pt-3">
              <h5 className="text-xs font-semibold text-ink">
                {t("aiPanel.step5Title")}
              </h5>

              {progressionCandidates.length === 0 ? (
                <p className="rounded-lg bg-surface p-3 text-xs text-ink-secondary">
                  {t("aiPanel.noProgressionsDetected")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {progressionCandidates.map((cand, idx) => {
                    const approved = approvedIndices.has(idx);
                    return (
                      <li
                        key={`${cand.characterId}-${idx}`}
                        className="rounded-lg border border-edge bg-surface p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink">
                            {cand.characterName}
                          </span>
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                            {t("charactersView.history.inChapter", {
                              num: chapter.chapterNumber,
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-ink">
                          {cand.changeSummary}
                        </p>
                        {cand.reason && (
                          <p className="mt-0.5 text-[11px] text-ink-muted">
                            {cand.reason}
                          </p>
                        )}
                        <div className="mt-2.5 flex items-center gap-2">
                          {approved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              <Check className="h-3.5 w-3.5" />
                              {t("aiPanel.approvedAdded")}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleApproveProgression(idx, cand)
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                              >
                                <Check className="h-3 w-3" />
                                {t("aiPanel.approveHistoryBtn")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismissProgression(idx)}
                                className="inline-flex items-center gap-1 rounded-md bg-elevated px-2.5 py-1 text-[11px] text-ink-secondary hover:text-ink"
                              >
                                <X className="h-3 w-3" />
                                {t("aiPanel.rejectBtn")}
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
