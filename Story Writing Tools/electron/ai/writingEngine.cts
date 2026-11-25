import {
  deleteAiSyncCacheEntity,
  getChapter,
  getDefaultAiProviderWithSecret,
  getProjectById,
  listAiSyncCache,
  listCharacterHistory,
  listCharacters,
  upsertAiSyncCache,
  type CharacterRecord,
  type ProjectRecord,
} from "../db/database.cjs";
import { generateText } from "./providerAdapter.cjs";

export type ChapterLengthOption = "shorten" | "approximate" | "extend";

export interface AiWritingMetrics {
  interventionPercent: number; // 0 - 100
  lengthOption: ChapterLengthOption;
  writingStyles: string[]; // Selected from the 20 options
  writingLanguage: string; // Selected from the 10 options
  outputLanguage: "tr" | "en";
}

export interface DeltaScanReport {
  worldChanged: boolean;
  changedCharactersCount: number;
  unchangedCharactersCount: number;
  removedCharactersCount: number;
  changedCharacterNames: string[];
  unchangedCharacterNames: string[];
  promptContext: string;
}

export interface OutlineGenerationResult {
  outline: string;
  deltaReport: DeltaScanReport;
  model: string;
}

export interface WriteChapterRequest {
  projectId: number;
  chapterId: number;
  approvedOutline: string;
  outlineApproved: boolean;
  metrics: AiWritingMetrics;
  previousProse?: string;
  userFeedback?: string;
}

export interface WriteChapterResult {
  prose: string;
  model: string;
}

export interface CharacterProgressionCandidate {
  characterId: number;
  characterName: string;
  changeSummary: string;
  reason: string;
}

function buildCompactWorldSummary(project: ProjectRecord): string {
  return `[Cached World] "${project.title}" (${project.genre || "Fiction"}) — unchanged since last sync.`;
}

function buildFullWorldContext(project: ProjectRecord): string {
  return [
    `[UPDATED WORLD]`,
    `Title: ${project.title}`,
    project.genre ? `Genre: ${project.genre}` : "",
    project.worldSummary ? `Summary: ${project.worldSummary}` : "",
    project.worldRulesJson && project.worldRulesJson !== "[]"
      ? `World Rules / Systems / Factions JSON: ${project.worldRulesJson}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCompactCharacterSummary(char: CharacterRecord): string {
  const alignLabel =
    char.alignment <= 33 ? "Evil" : char.alignment <= 66 ? "Gray" : "Good";
  return `[Cached Character #${char.id}] ${char.name} (${alignLabel}, alignment ${char.alignment}/100) — unchanged since last sync.`;
}

function buildFullCharacterContext(char: CharacterRecord): string {
  const history = listCharacterHistory(char.id);
  const historyText =
    history.length > 0
      ? history
          .map((h) =>
            h.chapterNumber
              ? `- ${h.changeSummary} (Chapter ${h.chapterNumber})`
              : `- ${h.changeSummary}`
          )
          .join("\n")
      : "";

  return [
    `[UPDATED CHARACTER #${char.id}: ${char.name}]`,
    [
      char.gender && `Gender: ${char.gender}`,
      char.age && `Age: ${char.age}`,
      `Alignment: ${char.alignment}/100`,
    ]
      .filter(Boolean)
      .join(" | "),
    char.family ? `Family: ${char.family}` : "",
    char.abilities ? `Abilities: ${char.abilities}` : "",
    char.personality ? `Personality: ${char.personality}` : "",
    char.appearance ? `Appearance: ${char.appearance}` : "",
    char.about ? `About: ${char.about}` : "",
    char.customModulesJson && char.customModulesJson !== "[]"
      ? `Custom Modules JSON: ${char.customModulesJson}`
      : "",
    historyText ? `Progression History:\n${historyText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Step 1 — Smart Delta Scan:
 * Compares SHA-256 content hashes of World and Characters against AiSyncCache.
 * Unchanged entities are NOT resent in full (token savings); only added/modified/removed deltas are transmitted.
 */
export function runSmartDeltaScan(
  projectId: number,
  commitCache = true
): DeltaScanReport {
  const project = getProjectById(projectId);
  const characters = listCharacters(projectId);
  const cacheEntries = listAiSyncCache(projectId);

  const worldCache = cacheEntries.find(
    (e) => e.entityType === "World" && e.entityId === project.id
  );
  const worldChanged =
    !worldCache || worldCache.lastSyncedHash !== project.worldHash;

  const charCacheMap = new Map<number, (typeof cacheEntries)[number]>();
  for (const entry of cacheEntries) {
    if (entry.entityType === "Character") {
      charCacheMap.set(entry.entityId, entry);
    }
  }

  const activeCharIds = new Set(characters.map((c) => c.id));
  const removedIds: number[] = [];
  for (const cachedId of charCacheMap.keys()) {
    if (!activeCharIds.has(cachedId)) {
      removedIds.push(cachedId);
    }
  }

  const changedCharacters: CharacterRecord[] = [];
  const unchangedCharacters: CharacterRecord[] = [];

  for (const char of characters) {
    const cached = charCacheMap.get(char.id);
    if (!cached || cached.lastSyncedHash !== char.contentHash) {
      changedCharacters.push(char);
    } else {
      unchangedCharacters.push(char);
    }
  }

  const contextParts: string[] = [];

  if (worldChanged) {
    contextParts.push(buildFullWorldContext(project));
  } else {
    contextParts.push(worldCache.cachedSummary || buildCompactWorldSummary(project));
  }

  for (const char of changedCharacters) {
    contextParts.push(buildFullCharacterContext(char));
  }

  for (const char of unchangedCharacters) {
    const cached = charCacheMap.get(char.id);
    contextParts.push(
      cached?.cachedSummary || buildCompactCharacterSummary(char)
    );
  }

  if (removedIds.length > 0) {
    contextParts.push(
      `[REMOVED CHARACTER IDS SINCE LAST SYNC]: ${removedIds.join(", ")}`
    );
  }

  if (commitCache) {
    if (worldChanged) {
      upsertAiSyncCache({
        projectId,
        entityType: "World",
        entityId: project.id,
        lastSyncedHash: project.worldHash,
        cachedSummary: buildCompactWorldSummary(project),
      });
    }

    for (const char of changedCharacters) {
      upsertAiSyncCache({
        projectId,
        entityType: "Character",
        entityId: char.id,
        lastSyncedHash: char.contentHash,
        cachedSummary: buildCompactCharacterSummary(char),
      });
    }

    for (const removedId of removedIds) {
      deleteAiSyncCacheEntity(projectId, "Character", removedId);
    }
  }

  return {
    worldChanged,
    changedCharactersCount: changedCharacters.length,
    unchangedCharactersCount: unchangedCharacters.length,
    removedCharactersCount: removedIds.length,
    changedCharacterNames: changedCharacters.map((c) => c.name),
    unchangedCharacterNames: unchangedCharacters.map((c) => c.name),
    promptContext: contextParts.join("\n\n"),
  };
}

function buildMetricsInstructions(metrics: AiWritingMetrics): string {
  const intervention = Math.max(
    0,
    Math.min(100, Math.round(metrics.interventionPercent))
  );
  const lengthMap: Record<ChapterLengthOption, string> = {
    shorten: "Keep the chapter concise and tightly paced (shorter than usual).",
    approximate: "Match the natural expected length of the draft outline.",
    extend:
      "Expand scenes with rich sensory atmosphere, pacing, and depth (longer chapter).",
  };

  const langDirective =
    metrics.outputLanguage === "tr"
      ? "Write ALL output in natural, literary Turkish."
      : "Write ALL output in natural, literary English.";

  return [
    `[AI WRITING METRICS]`,
    `- Output Language: ${langDirective}`,
    `- Creative Intervention Level: ${intervention}/100 (0 = strictly polish grammar & flow of draft beats; 100 = high creative scene expansion and artistic additions).`,
    `- Target Chapter Length: ${lengthMap[metrics.lengthOption]}`,
    metrics.writingStyles.length > 0
      ? `- Writing Styles: ${metrics.writingStyles.join(", ")}`
      : "- Writing Styles: Balanced narrative",
    `- Writing Tone / Register: ${metrics.writingLanguage || "Literary / Artistic"}`,
  ].join("\n");
}

function requireWriterProvider() {
  const provider = getDefaultAiProviderWithSecret("writer");
  if (!provider) {
    throw new Error(
      "No AI provider is configured. Please add an AI provider in Settings → AI Providers first."
    );
  }
  return provider;
}

/**
 * Steps 1 + 2 + 3 — Smart Delta Scan + Draft Scan + Chapter Outline (Approval Gate).
 * Strictly generates ONLY an outline and waits for user approval before prose generation.
 */
export async function generateChapterOutline(params: {
  projectId: number;
  chapterId: number;
  metrics: AiWritingMetrics;
  outlineFeedback?: string;
  previousOutline?: string;
}): Promise<OutlineGenerationResult> {
  const { record, apiKey } = requireWriterProvider();
  const chapter = getChapter(params.chapterId);
  const deltaReport = runSmartDeltaScan(params.projectId, true);

  const systemPrompt = [
    "You are StoryStudio's senior developmental editor and narrative architect.",
    "STRICT RULE: You are in STEP 3 (Chapter Flow / Outline Gate). DO NOT write the full chapter prose yet.",
    "Produce a clear, numbered scene-by-scene chapter flow (outline) with beat summaries, emotional shifts, and ending hook so the author can review and approve it first.",
  ].join(" ");

  const userPromptParts = [
    deltaReport.promptContext,
    buildMetricsInstructions(params.metrics),
    `[CHAPTER SLOT — STEP 2 DRAFT SCAN]`,
    `Chapter ${chapter.chapterNumber}: ${chapter.title}`,
    `Author Draft / Notes:\n${chapter.draftNotes || "(No draft notes provided yet — infer a logical chapter flow from the title and world.)"}`,
  ];

  if (params.previousOutline && params.outlineFeedback) {
    userPromptParts.push(
      `[PREVIOUS OUTLINE]\n${params.previousOutline}\n\n[AUTHOR FEEDBACK ON OUTLINE]\n${params.outlineFeedback}\nRevise the outline according to this feedback. Still DO NOT write full chapter prose.`
    );
  }

  const response = await generateText(
    {
      providerType: record.providerType,
      baseUrl: record.baseUrl,
      modelName: record.modelName,
      apiKey,
    },
    {
      systemPrompt,
      userPrompt: userPromptParts.join("\n\n"),
      temperature: 0.65,
    }
  );

  return {
    outline: response.text.trim(),
    deltaReport,
    model: response.model,
  };
}

/**
 * Step 4 — Writing & Iteration Loop.
 * Enforces the Step 3 approval lock (`outlineApproved === true`) so prose is NEVER written without explicit approval.
 */
export async function writeChapterProse(
  request: WriteChapterRequest
): Promise<WriteChapterResult> {
  if (!request.outlineApproved || !request.approvedOutline.trim()) {
    throw new Error(
      "Approval lock active: Chapter prose cannot be generated before the outline is approved."
    );
  }

  const { record, apiKey } = requireWriterProvider();
  const chapter = getChapter(request.chapterId);
  const deltaReport = runSmartDeltaScan(request.projectId, true);

  const systemPrompt = [
    "You are StoryStudio's master fiction ghostwriter.",
    "Write immersive, publication-grade chapter prose strictly faithful to the author's approved outline, worldbuilding, characters, and AI metrics.",
    "Return ONLY the chapter prose without meta commentary.",
  ].join(" ");

  const userPromptParts = [
    deltaReport.promptContext,
    buildMetricsInstructions(request.metrics),
    `[CHAPTER ${chapter.chapterNumber}: ${chapter.title}]`,
    `[AUTHOR DRAFT NOTES]\n${chapter.draftNotes || "(None)"}`,
    `[APPROVED CHAPTER FLOW / OUTLINE]\n${request.approvedOutline}`,
  ];

  if (request.previousProse && request.userFeedback) {
    userPromptParts.push(
      `[CURRENT CHAPTER DRAFT]\n${request.previousProse}\n\n[AUTHOR REVISION FEEDBACK]\n${request.userFeedback}\nRewrite and improve the chapter incorporating all feedback faithfully.`
    );
  }

  const response = await generateText(
    {
      providerType: record.providerType,
      baseUrl: record.baseUrl,
      modelName: record.modelName,
      apiKey,
    },
    {
      systemPrompt,
      userPrompt: userPromptParts.join("\n\n"),
      temperature: 0.7 + (request.metrics.interventionPercent / 100) * 0.25,
    }
  );

  return {
    prose: response.text.trim(),
    model: response.model,
  };
}

/**
 * Step 5 — Post-Chapter Character Progression Detection.
 * Analyzes a completed chapter and returns candidate chronological progression entries for human approval.
 */
export async function detectCharacterProgression(params: {
  projectId: number;
  chapterId: number;
  outputLanguage: "tr" | "en";
}): Promise<CharacterProgressionCandidate[]> {
  const { record, apiKey } = requireWriterProvider();
  const chapter = getChapter(params.chapterId);
  const characters = listCharacters(params.projectId);

  if (characters.length === 0 || !chapter.content.trim()) {
    return [];
  }

  const rosterText = characters
    .map((c) => `- id=${c.id} | name="${c.name}" | abilities="${c.abilities}"`)
    .join("\n");

  const langHint =
    params.outputLanguage === "tr"
      ? 'Write "changeSummary" and "reason" in Turkish (e.g., "1. Lvl → 2. Lvl" or "Yeni Yetenek: Gölge Adımı").'
      : 'Write "changeSummary" and "reason" in English (e.g., "Lvl 1 → Lvl 2" or "New Skill: Shadow Step").';

  const systemPrompt = [
    "You extract notable, permanent character developments from a completed book chapter.",
    langHint,
    'Return ONLY a valid JSON array with objects matching: {"characterId": number, "characterName": string, "changeSummary": string, "reason": string}.',
    "If no notable permanent character progression happened, return []. Do not wrap in markdown fences.",
  ].join(" ");

  const userPrompt = [
    `[CHARACTER ROSTER]\n${rosterText}`,
    `[COMPLETED CHAPTER ${chapter.chapterNumber}: ${chapter.title}]\n${chapter.content}`,
  ].join("\n\n");

  const response = await generateText(
    {
      providerType: record.providerType,
      baseUrl: record.baseUrl,
      modelName: record.modelName,
      apiKey,
    },
    {
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    }
  );

  const raw = response.text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];

  const validIds = new Set(characters.map((c) => c.id));
  const results: CharacterProgressionCandidate[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const characterId = Number(obj.characterId);
    const changeSummary = String(obj.changeSummary ?? "").trim();
    if (!validIds.has(characterId) || !changeSummary) continue;
    const matched = characters.find((c) => c.id === characterId)!;
    results.push({
      characterId,
      characterName: matched.name,
      changeSummary,
      reason: String(obj.reason ?? "").trim(),
    });
  }

  return results;
}
