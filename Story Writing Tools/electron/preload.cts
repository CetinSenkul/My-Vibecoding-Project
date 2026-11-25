import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("storyStudio", {
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  getDbInfo: () => ipcRenderer.invoke("db:getInfo"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSetting: (
    key: "Language" | "Theme" | "ActiveProjectId",
    value: string
  ) => ipcRenderer.invoke("settings:set", key, value),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  createProject: (input: {
    title: string;
    genre?: string;
    worldSummary?: string;
  }) => ipcRenderer.invoke("projects:create", input),
  deleteProject: (projectId: number) =>
    ipcRenderer.invoke("projects:delete", projectId),
  setActiveProject: (projectId: number | null) =>
    ipcRenderer.invoke("projects:setActive", projectId),
  updateProjectWorld: (projectId: number, input: Record<string, unknown>) =>
    ipcRenderer.invoke("projects:updateWorld", projectId, input),

  // Characters & Progression Log
  listCharacters: (projectId: number) =>
    ipcRenderer.invoke("characters:list", projectId),
  createCharacter: (projectId: number, input: Record<string, unknown>) =>
    ipcRenderer.invoke("characters:create", projectId, input),
  updateCharacter: (characterId: number, input: Record<string, unknown>) =>
    ipcRenderer.invoke("characters:update", characterId, input),
  deleteCharacter: (characterId: number) =>
    ipcRenderer.invoke("characters:delete", characterId),
  listCharacterHistory: (characterId: number) =>
    ipcRenderer.invoke("characterHistory:list", characterId),
  addCharacterHistory: (characterId: number, input: Record<string, unknown>) =>
    ipcRenderer.invoke("characterHistory:add", characterId, input),
  deleteCharacterHistory: (historyId: number) =>
    ipcRenderer.invoke("characterHistory:delete", historyId),

  // Chapters
  listChapters: (projectId: number) =>
    ipcRenderer.invoke("chapters:list", projectId),
  getChapter: (chapterId: number) =>
    ipcRenderer.invoke("chapters:get", chapterId),
  createChapter: (projectId: number, input: Record<string, unknown>) =>
    ipcRenderer.invoke("chapters:create", projectId, input),
  updateChapter: (chapterId: number, input: Record<string, unknown>) =>
    ipcRenderer.invoke("chapters:update", chapterId, input),
  deleteChapter: (chapterId: number) =>
    ipcRenderer.invoke("chapters:delete", chapterId),

  // Arc Canvas
  getArcCanvas: (projectId: number) =>
    ipcRenderer.invoke("arcCanvas:get", projectId),
  saveArcCanvas: (projectId: number, nodesJson: string, edgesJson: string) =>
    ipcRenderer.invoke("arcCanvas:save", projectId, nodesJson, edgesJson),

  // 5-Step AI Writing Engine
  previewDeltaScan: (projectId: number) =>
    ipcRenderer.invoke("aiWriting:deltaPreview", projectId),
  generateChapterOutline: (params: Record<string, unknown>) =>
    ipcRenderer.invoke("aiWriting:generateOutline", params),
  writeChapterProse: (request: Record<string, unknown>) =>
    ipcRenderer.invoke("aiWriting:writeChapter", request),
  detectCharacterProgression: (params: Record<string, unknown>) =>
    ipcRenderer.invoke("aiWriting:detectProgression", params),

  // Glossary & Multi-Language Translations
  listGlossaryTerms: (projectId: number) =>
    ipcRenderer.invoke("glossary:list", projectId),
  createGlossaryTerm: (projectId: number, term: string, description: string) =>
    ipcRenderer.invoke("glossary:create", projectId, term, description),
  updateGlossaryTerm: (termId: number, term: string, description: string) =>
    ipcRenderer.invoke("glossary:update", termId, term, description),
  deleteGlossaryTerm: (termId: number) =>
    ipcRenderer.invoke("glossary:delete", termId),
  listChapterTranslations: (chapterId: number) =>
    ipcRenderer.invoke("translations:list", chapterId),
  upsertChapterTranslation: (
    chapterId: number,
    sourceLang: string,
    targetLang: string,
    translatedText: string
  ) =>
    ipcRenderer.invoke(
      "translations:upsert",
      chapterId,
      sourceLang,
      targetLang,
      translatedText
    ),
  deleteChapterTranslation: (translationId: number) =>
    ipcRenderer.invoke("translations:delete", translationId),
  translateChapterWithGlossary: (params: Record<string, unknown>) =>
    ipcRenderer.invoke("translations:translateChapter", params),

  // BYOK AI Providers
  getEncryptionStatus: () => ipcRenderer.invoke("aiProviders:encryptionStatus"),
  listAiProviders: () => ipcRenderer.invoke("aiProviders:list"),
  createAiProvider: (input: Record<string, unknown>) =>
    ipcRenderer.invoke("aiProviders:create", input),
  updateAiProvider: (providerId: number, input: Record<string, unknown>) =>
    ipcRenderer.invoke("aiProviders:update", providerId, input),
  deleteAiProvider: (providerId: number) =>
    ipcRenderer.invoke("aiProviders:delete", providerId),
  setDefaultAiProvider: (providerId: number, role: "writer" | "translator") =>
    ipcRenderer.invoke("aiProviders:setDefault", providerId, role),
  testAiProvider: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke("aiProviders:test", payload),
  openExternalUrl: (url: string) =>
    ipcRenderer.invoke("shell:openExternal", url),
});
