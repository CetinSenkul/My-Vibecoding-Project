import type {
  AddCharacterHistoryInput,
  AiProviderRecord,
  AiWritingMetrics,
  AppSettingsRecord,
  ArcCanvasRecord,
  ChapterRecord,
  ChapterTranslationRecord,
  CharacterHistoryRecord,
  CharacterProgressionCandidate,
  CharacterRecord,
  ConnectionTestResult,
  CreateChapterInput,
  CreateProjectInput,
  DbInfo,
  DeltaScanReport,
  GlossaryTermRecord,
  OutlineGenerationResult,
  ProjectRecord,
  SaveAiProviderInput,
  SaveCharacterInput,
  TestAiProviderPayload,
  TranslateChapterResult,
  UpdateChapterInput,
  UpdateProjectWorldInput,
  WriteChapterRequest,
  WriteChapterResult,
} from "../types/electron";
import type { LanguageCode, ThemeId } from "../types/navigation";

const FALLBACK_PROJECTS_KEY = "storystudio.fallback.projects";
const FALLBACK_SETTINGS_KEY = "storystudio.fallback.settings";
const FALLBACK_CHARACTERS_KEY = "storystudio.fallback.characters";
const FALLBACK_HISTORY_KEY = "storystudio.fallback.history";
const FALLBACK_CHAPTERS_KEY = "storystudio.fallback.chapters";
const FALLBACK_ARC_KEY = "storystudio.fallback.arc";

function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.storyStudio);
}

function readFallbackSettings(): AppSettingsRecord {
  try {
    const raw = localStorage.getItem(FALLBACK_SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw) as AppSettingsRecord;
    }
  } catch {
    // Ignore parse failures
  }
  return {
    language:
      (localStorage.getItem("storystudio.language") as LanguageCode) || "tr",
    theme: (localStorage.getItem("storystudio.theme") as ThemeId) || "dark",
    activeProjectId: null,
  };
}

function writeFallbackSettings(next: AppSettingsRecord): void {
  localStorage.setItem(FALLBACK_SETTINGS_KEY, JSON.stringify(next));
}

function readFallbackProjects(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(FALLBACK_PROJECTS_KEY);
    if (raw) {
      return JSON.parse(raw) as ProjectRecord[];
    }
  } catch {
    // Ignore
  }
  return [];
}

function writeFallbackProjects(projects: ProjectRecord[]): void {
  localStorage.setItem(FALLBACK_PROJECTS_KEY, JSON.stringify(projects));
}

export const storageBridge = {
  isDesktop(): boolean {
    return isElectron();
  },

  async getDbInfo(): Promise<DbInfo> {
    if (isElectron()) {
      return window.storyStudio!.getDbInfo();
    }
    const projects = readFallbackProjects();
    return {
      dbPath: "Browser Preview (localStorage)",
      sizeBytes: 0,
      projectCount: projects.length,
    };
  },

  async getSettings(): Promise<AppSettingsRecord> {
    if (isElectron()) {
      return window.storyStudio!.getSettings();
    }
    return readFallbackSettings();
  },

  async setSetting(
    key: "Language" | "Theme" | "ActiveProjectId",
    value: string
  ): Promise<AppSettingsRecord> {
    if (isElectron()) {
      return window.storyStudio!.setSetting(key, value);
    }
    const current = readFallbackSettings();
    const updated: AppSettingsRecord = {
      ...current,
      language: key === "Language" ? (value as LanguageCode) : current.language,
      theme: key === "Theme" ? (value as ThemeId) : current.theme,
      activeProjectId:
        key === "ActiveProjectId"
          ? value
            ? Number(value)
            : null
          : current.activeProjectId,
    };
    writeFallbackSettings(updated);
    return updated;
  },

  async listProjects(): Promise<ProjectRecord[]> {
    if (isElectron()) {
      return window.storyStudio!.listProjects();
    }
    return readFallbackProjects();
  },

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    if (isElectron()) {
      return window.storyStudio!.createProject(input);
    }
    const existing = readFallbackProjects();
    const nextId =
      existing.length > 0 ? Math.max(...existing.map((p) => p.id)) + 1 : 1;
    const created: ProjectRecord = {
      id: nextId,
      title: input.title.trim(),
      genre: (input.genre ?? "").trim(),
      worldSummary: (input.worldSummary ?? "").trim(),
      worldRulesJson: "[]",
      worldHash: "browser-preview",
      createdAt: new Date().toISOString(),
    };
    writeFallbackProjects([created, ...existing]);
    const current = readFallbackSettings();
    writeFallbackSettings({ ...current, activeProjectId: created.id });
    return created;
  },

  async deleteProject(projectId: number): Promise<AppSettingsRecord> {
    if (isElectron()) {
      return window.storyStudio!.deleteProject(projectId);
    }
    const remaining = readFallbackProjects().filter((p) => p.id !== projectId);
    writeFallbackProjects(remaining);
    const current = readFallbackSettings();
    const nextActive =
      current.activeProjectId === projectId
        ? remaining[0]?.id ?? null
        : current.activeProjectId;
    const updated = { ...current, activeProjectId: nextActive };
    writeFallbackSettings(updated);
    return updated;
  },

  async setActiveProject(projectId: number | null): Promise<AppSettingsRecord> {
    if (isElectron()) {
      return window.storyStudio!.setActiveProject(projectId);
    }
    const current = readFallbackSettings();
    const updated = { ...current, activeProjectId: projectId };
    writeFallbackSettings(updated);
    return updated;
  },

  async updateProjectWorld(
    projectId: number,
    input: UpdateProjectWorldInput
  ): Promise<ProjectRecord> {
    if (isElectron()) {
      return window.storyStudio!.updateProjectWorld(projectId, input);
    }
    const all = readFallbackProjects();
    let updatedRecord: ProjectRecord | null = null;
    const next = all.map((p) => {
      if (p.id !== projectId) return p;
      updatedRecord = {
        ...p,
        title: input.title.trim(),
        genre: (input.genre ?? "").trim(),
        worldSummary: (input.worldSummary ?? "").trim(),
        worldRulesJson: input.worldRulesJson ?? p.worldRulesJson,
        worldHash: `preview-${Date.now().toString(16)}`,
      };
      return updatedRecord;
    });
    writeFallbackProjects(next);
    if (!updatedRecord) throw new Error("Project not found.");
    return updatedRecord;
  },

  async listCharacters(projectId: number): Promise<CharacterRecord[]> {
    if (isElectron()) {
      return window.storyStudio!.listCharacters(projectId);
    }
    try {
      const all = JSON.parse(
        localStorage.getItem(FALLBACK_CHARACTERS_KEY) || "[]"
      ) as CharacterRecord[];
      return all.filter((c) => c.projectId === projectId);
    } catch {
      return [];
    }
  },

  async createCharacter(
    projectId: number,
    input: SaveCharacterInput
  ): Promise<CharacterRecord> {
    if (isElectron()) {
      return window.storyStudio!.createCharacter(projectId, input);
    }
    const all = JSON.parse(
      localStorage.getItem(FALLBACK_CHARACTERS_KEY) || "[]"
    ) as CharacterRecord[];
    const nextId = all.length > 0 ? Math.max(...all.map((c) => c.id)) + 1 : 1;
    const created: CharacterRecord = {
      id: nextId,
      projectId,
      name: input.name.trim(),
      gender: (input.gender ?? "").trim(),
      age: (input.age ?? "").trim(),
      family: (input.family ?? "").trim(),
      abilities: (input.abilities ?? "").trim(),
      personality: (input.personality ?? "").trim(),
      appearance: (input.appearance ?? "").trim(),
      alignment: input.alignment,
      about: (input.about ?? "").trim(),
      customModulesJson: input.customModulesJson ?? "[]",
      contentHash: `preview-${Date.now().toString(16)}`,
    };
    localStorage.setItem(
      FALLBACK_CHARACTERS_KEY,
      JSON.stringify([...all, created])
    );
    return created;
  },

  async updateCharacter(
    characterId: number,
    input: SaveCharacterInput
  ): Promise<CharacterRecord> {
    if (isElectron()) {
      return window.storyStudio!.updateCharacter(characterId, input);
    }
    const all = JSON.parse(
      localStorage.getItem(FALLBACK_CHARACTERS_KEY) || "[]"
    ) as CharacterRecord[];
    let updated: CharacterRecord | null = null;
    const next = all.map((c) => {
      if (c.id !== characterId) return c;
      updated = {
        ...c,
        name: input.name.trim(),
        gender: (input.gender ?? "").trim(),
        age: (input.age ?? "").trim(),
        family: (input.family ?? "").trim(),
        abilities: (input.abilities ?? "").trim(),
        personality: (input.personality ?? "").trim(),
        appearance: (input.appearance ?? "").trim(),
        alignment: input.alignment,
        about: (input.about ?? "").trim(),
        customModulesJson: input.customModulesJson ?? c.customModulesJson,
        contentHash: `preview-${Date.now().toString(16)}`,
      };
      return updated;
    });
    localStorage.setItem(FALLBACK_CHARACTERS_KEY, JSON.stringify(next));
    if (!updated) throw new Error("Character not found.");
    return updated;
  },

  async deleteCharacter(characterId: number): Promise<void> {
    if (isElectron()) {
      return window.storyStudio!.deleteCharacter(characterId);
    }
    const all = JSON.parse(
      localStorage.getItem(FALLBACK_CHARACTERS_KEY) || "[]"
    ) as CharacterRecord[];
    localStorage.setItem(
      FALLBACK_CHARACTERS_KEY,
      JSON.stringify(all.filter((c) => c.id !== characterId))
    );
  },

  async listCharacterHistory(
    characterId: number
  ): Promise<CharacterHistoryRecord[]> {
    if (isElectron()) {
      return window.storyStudio!.listCharacterHistory(characterId);
    }
    try {
      const all = JSON.parse(
        localStorage.getItem(FALLBACK_HISTORY_KEY) || "[]"
      ) as CharacterHistoryRecord[];
      return all.filter((h) => h.characterId === characterId);
    } catch {
      return [];
    }
  },

  async addCharacterHistory(
    characterId: number,
    input: AddCharacterHistoryInput
  ): Promise<CharacterHistoryRecord> {
    if (isElectron()) {
      return window.storyStudio!.addCharacterHistory(characterId, input);
    }
    const all = JSON.parse(
      localStorage.getItem(FALLBACK_HISTORY_KEY) || "[]"
    ) as CharacterHistoryRecord[];
    const nextId = all.length > 0 ? Math.max(...all.map((h) => h.id)) + 1 : 1;
    const created: CharacterHistoryRecord = {
      id: nextId,
      characterId,
      chapterNumber: input.chapterNumber ?? null,
      changeSummary: input.changeSummary.trim(),
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(
      FALLBACK_HISTORY_KEY,
      JSON.stringify([...all, created])
    );
    return created;
  },

  async deleteCharacterHistory(historyId: number): Promise<void> {
    if (isElectron()) {
      return window.storyStudio!.deleteCharacterHistory(historyId);
    }
    const all = JSON.parse(
      localStorage.getItem(FALLBACK_HISTORY_KEY) || "[]"
    ) as CharacterHistoryRecord[];
    localStorage.setItem(
      FALLBACK_HISTORY_KEY,
      JSON.stringify(all.filter((h) => h.id !== historyId))
    );
  },

  async listChapters(projectId: number): Promise<ChapterRecord[]> {
    if (isElectron()) {
      return window.storyStudio!.listChapters(projectId);
    }
    try {
      const all = JSON.parse(
        localStorage.getItem(FALLBACK_CHAPTERS_KEY) || "[]"
      ) as ChapterRecord[];
      return all
        .filter((ch) => ch.projectId === projectId)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
    } catch {
      return [];
    }
  },

  async createChapter(
    projectId: number,
    input: CreateChapterInput
  ): Promise<ChapterRecord> {
    if (isElectron()) {
      return window.storyStudio!.createChapter(projectId, input);
    }
    const all = JSON.parse(
      localStorage.getItem(FALLBACK_CHAPTERS_KEY) || "[]"
    ) as ChapterRecord[];
    const projectChapters = all.filter((c) => c.projectId === projectId);
    const nextId = all.length > 0 ? Math.max(...all.map((c) => c.id)) + 1 : 1;
    const nextNum =
      input.chapterNumber ??
      (projectChapters.length > 0
        ? Math.max(...projectChapters.map((c) => c.chapterNumber)) + 1
        : 1);
    const created: ChapterRecord = {
      id: nextId,
      projectId,
      chapterNumber: nextNum,
      title: input.title.trim(),
      draftNotes: input.draftNotes ?? "",
      content: "",
      status: "Draft",
      updatedAt: new Date().toISOString(),
      rawBytes: 0,
      compressedBytes: 0,
    };
    localStorage.setItem(FALLBACK_CHAPTERS_KEY, JSON.stringify([...all, created]));
    return created;
  },

  async updateChapter(
    chapterId: number,
    input: UpdateChapterInput
  ): Promise<ChapterRecord> {
    if (isElectron()) {
      return window.storyStudio!.updateChapter(chapterId, input);
    }
    const all = JSON.parse(
      localStorage.getItem(FALLBACK_CHAPTERS_KEY) || "[]"
    ) as ChapterRecord[];
    let updated: ChapterRecord | null = null;
    const next = all.map((c) => {
      if (c.id !== chapterId) return c;
      const bytes = new TextEncoder().encode(input.content).length;
      updated = {
        ...c,
        chapterNumber: input.chapterNumber ?? c.chapterNumber,
        title: input.title.trim(),
        draftNotes: input.draftNotes,
        content: input.content,
        status: input.status,
        updatedAt: new Date().toISOString(),
        rawBytes: bytes,
        compressedBytes: bytes,
      };
      return updated;
    });
    localStorage.setItem(FALLBACK_CHAPTERS_KEY, JSON.stringify(next));
    if (!updated) throw new Error("Chapter not found.");
    return updated;
  },

  async deleteChapter(chapterId: number): Promise<void> {
    if (isElectron()) {
      return window.storyStudio!.deleteChapter(chapterId);
    }
    const all = JSON.parse(
      localStorage.getItem(FALLBACK_CHAPTERS_KEY) || "[]"
    ) as ChapterRecord[];
    localStorage.setItem(
      FALLBACK_CHAPTERS_KEY,
      JSON.stringify(all.filter((c) => c.id !== chapterId))
    );
  },

  async getArcCanvas(projectId: number): Promise<ArcCanvasRecord> {
    if (isElectron()) {
      return window.storyStudio!.getArcCanvas(projectId);
    }
    try {
      const map = JSON.parse(
        localStorage.getItem(FALLBACK_ARC_KEY) || "{}"
      ) as Record<string, ArcCanvasRecord>;
      return map[String(projectId)] ?? { projectId, nodesJson: "[]", edgesJson: "[]" };
    } catch {
      return { projectId, nodesJson: "[]", edgesJson: "[]" };
    }
  },

  async saveArcCanvas(
    projectId: number,
    nodesJson: string,
    edgesJson: string
  ): Promise<ArcCanvasRecord> {
    if (isElectron()) {
      return window.storyStudio!.saveArcCanvas(projectId, nodesJson, edgesJson);
    }
    const map = JSON.parse(
      localStorage.getItem(FALLBACK_ARC_KEY) || "{}"
    ) as Record<string, ArcCanvasRecord>;
    const record: ArcCanvasRecord = { projectId, nodesJson, edgesJson };
    map[String(projectId)] = record;
    localStorage.setItem(FALLBACK_ARC_KEY, JSON.stringify(map));
    return record;
  },

  // BYOK AI Providers — strictly requires Electron OS encryption for real key storage
  async getEncryptionStatus(): Promise<{ available: boolean }> {
    if (isElectron()) {
      return window.storyStudio!.getEncryptionStatus();
    }
    return { available: false };
  },

  async listAiProviders(): Promise<AiProviderRecord[]> {
    if (isElectron()) {
      return window.storyStudio!.listAiProviders();
    }
    return [];
  },

  async createAiProvider(
    input: SaveAiProviderInput
  ): Promise<AiProviderRecord> {
    if (!isElectron()) {
      throw new Error(
        "OS encrypted key storage requires running StoryStudio as a desktop app."
      );
    }
    return window.storyStudio!.createAiProvider(input);
  },

  async updateAiProvider(
    providerId: number,
    input: SaveAiProviderInput
  ): Promise<AiProviderRecord> {
    if (!isElectron()) {
      throw new Error(
        "OS encrypted key storage requires running StoryStudio as a desktop app."
      );
    }
    return window.storyStudio!.updateAiProvider(providerId, input);
  },

  async deleteAiProvider(providerId: number): Promise<AiProviderRecord[]> {
    if (!isElectron()) {
      return [];
    }
    return window.storyStudio!.deleteAiProvider(providerId);
  },

  async setDefaultAiProvider(
    providerId: number,
    role: "writer" | "translator"
  ): Promise<AiProviderRecord[]> {
    if (!isElectron()) {
      return [];
    }
    return window.storyStudio!.setDefaultAiProvider(providerId, role);
  },

  async testAiProvider(
    payload: TestAiProviderPayload
  ): Promise<ConnectionTestResult> {
    if (!isElectron()) {
      return {
        ok: false,
        latencyMs: 0,
        message: "Connection tests require running StoryStudio as a desktop app.",
      };
    }
    return window.storyStudio!.testAiProvider(payload);
  },

  async openExternalUrl(url: string): Promise<void> {
    if (isElectron()) {
      await window.storyStudio!.openExternalUrl(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  },

  async previewDeltaScan(projectId: number): Promise<DeltaScanReport> {
    if (!isElectron()) {
      return {
        worldChanged: false,
        changedCharactersCount: 0,
        unchangedCharactersCount: 0,
        removedCharactersCount: 0,
        changedCharacterNames: [],
        unchangedCharacterNames: [],
        promptContext: "",
      };
    }
    return window.storyStudio!.previewDeltaScan(projectId);
  },

  async generateChapterOutline(params: {
    projectId: number;
    chapterId: number;
    metrics: AiWritingMetrics;
    outlineFeedback?: string;
    previousOutline?: string;
  }): Promise<OutlineGenerationResult> {
    if (!isElectron()) {
      throw new Error("AI writing engine requires running the desktop app.");
    }
    return window.storyStudio!.generateChapterOutline(params);
  },

  async writeChapterProse(
    request: WriteChapterRequest
  ): Promise<WriteChapterResult> {
    if (!isElectron()) {
      throw new Error("AI writing engine requires running the desktop app.");
    }
    return window.storyStudio!.writeChapterProse(request);
  },

  async detectCharacterProgression(params: {
    projectId: number;
    chapterId: number;
    outputLanguage: "tr" | "en";
  }): Promise<CharacterProgressionCandidate[]> {
    if (!isElectron()) {
      return [];
    }
    return window.storyStudio!.detectCharacterProgression(params);
  },

  async listGlossaryTerms(projectId: number): Promise<GlossaryTermRecord[]> {
    if (isElectron()) {
      return window.storyStudio!.listGlossaryTerms(projectId);
    }
    return [];
  },

  async createGlossaryTerm(
    projectId: number,
    term: string,
    description: string
  ): Promise<GlossaryTermRecord> {
    if (!isElectron()) {
      throw new Error("Glossary persistence requires the desktop app.");
    }
    return window.storyStudio!.createGlossaryTerm(projectId, term, description);
  },

  async updateGlossaryTerm(
    termId: number,
    term: string,
    description: string
  ): Promise<GlossaryTermRecord> {
    if (!isElectron()) {
      throw new Error("Glossary persistence requires the desktop app.");
    }
    return window.storyStudio!.updateGlossaryTerm(termId, term, description);
  },

  async deleteGlossaryTerm(termId: number): Promise<void> {
    if (isElectron()) {
      return window.storyStudio!.deleteGlossaryTerm(termId);
    }
  },

  async listChapterTranslations(
    chapterId: number
  ): Promise<ChapterTranslationRecord[]> {
    if (isElectron()) {
      return window.storyStudio!.listChapterTranslations(chapterId);
    }
    return [];
  },

  async upsertChapterTranslation(
    chapterId: number,
    sourceLang: string,
    targetLang: string,
    translatedText: string
  ): Promise<ChapterTranslationRecord> {
    if (!isElectron()) {
      throw new Error("Translation persistence requires the desktop app.");
    }
    return window.storyStudio!.upsertChapterTranslation(
      chapterId,
      sourceLang,
      targetLang,
      translatedText
    );
  },

  async deleteChapterTranslation(translationId: number): Promise<void> {
    if (isElectron()) {
      return window.storyStudio!.deleteChapterTranslation(translationId);
    }
  },

  async translateChapterWithGlossary(params: {
    projectId: number;
    chapterId: number;
    sourceLang: string;
    targetLang: string;
  }): Promise<TranslateChapterResult> {
    if (!isElectron()) {
      throw new Error("AI translation requires the desktop app.");
    }
    return window.storyStudio!.translateChapterWithGlossary(params);
  },
};
