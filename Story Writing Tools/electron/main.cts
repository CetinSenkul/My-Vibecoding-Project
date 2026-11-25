import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import {
  testProviderConnection,
  type AiProviderType,
} from "./ai/providerAdapter.cjs";
import { translateChapterWithGlossary } from "./ai/translationEngine.cjs";
import {
  detectCharacterProgression,
  generateChapterOutline,
  runSmartDeltaScan,
  writeChapterProse,
  type AiWritingMetrics,
  type WriteChapterRequest,
} from "./ai/writingEngine.cjs";
import {
  addCharacterHistory,
  closeDatabase,
  createAiProvider,
  createChapter,
  createCharacter,
  createGlossaryTerm,
  createProject,
  deleteAiProvider,
  deleteChapter,
  deleteChapterTranslation,
  deleteCharacter,
  deleteCharacterHistory,
  deleteGlossaryTerm,
  deleteProject,
  getAiProviderConfigWithSecret,
  getAppSettings,
  getArcCanvas,
  getChapter,
  getDbInfo,
  initDatabase,
  listAiProviders,
  listChapters,
  listChapterTranslations,
  listCharacterHistory,
  listCharacters,
  listGlossaryTerms,
  listProjects,
  saveArcCanvas,
  setAppSetting,
  setDefaultAiProvider,
  updateAiProvider,
  updateChapter,
  updateCharacter,
  updateGlossaryTerm,
  updateProjectWorld,
  upsertChapterTranslation,
  type AddCharacterHistoryInput,
  type CreateChapterInput,
  type CreateProjectInput,
  type SaveAiProviderInput,
  type SaveCharacterInput,
  type UpdateChapterInput,
  type UpdateProjectWorldInput,
} from "./db/database.cjs";
import {
  initSecretVault,
  isOsEncryptionAvailable,
} from "./security/secretVault.cjs";

const DEV_SERVER_URL = "http://localhost:5173";
const isDev = process.argv.includes("--dev");

interface TestConnectionPayload {
  providerId?: number;
  providerType?: AiProviderType;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
}

function createMainWindow(): void {
  const win = new BrowserWindow({
    title: "StoryStudio",
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: "#111318",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle("app:getInfo", () => ({
    name: "StoryStudio",
    version: app.getVersion(),
    platform: process.platform,
    phase: 8,
  }));

  ipcMain.handle("db:getInfo", () => getDbInfo());

  ipcMain.handle("settings:get", () => getAppSettings());

  ipcMain.handle(
    "settings:set",
    (_event, key: "Language" | "Theme" | "ActiveProjectId", value: string) =>
      setAppSetting(key, value)
  );

  ipcMain.handle("projects:list", () => listProjects());

  ipcMain.handle("projects:create", (_event, input: CreateProjectInput) =>
    createProject(input)
  );

  ipcMain.handle("projects:delete", (_event, projectId: number) =>
    deleteProject(projectId)
  );

  ipcMain.handle("projects:setActive", (_event, projectId: number | null) =>
    setAppSetting("ActiveProjectId", projectId ? String(projectId) : "")
  );

  ipcMain.handle(
    "projects:updateWorld",
    (_event, projectId: number, input: UpdateProjectWorldInput) =>
      updateProjectWorld(projectId, input)
  );

  // Characters & Progression History IPC
  ipcMain.handle("characters:list", (_event, projectId: number) =>
    listCharacters(projectId)
  );

  ipcMain.handle(
    "characters:create",
    (_event, projectId: number, input: SaveCharacterInput) =>
      createCharacter(projectId, input)
  );

  ipcMain.handle(
    "characters:update",
    (_event, characterId: number, input: SaveCharacterInput) =>
      updateCharacter(characterId, input)
  );

  ipcMain.handle("characters:delete", (_event, characterId: number) =>
    deleteCharacter(characterId)
  );

  ipcMain.handle("characterHistory:list", (_event, characterId: number) =>
    listCharacterHistory(characterId)
  );

  ipcMain.handle(
    "characterHistory:add",
    (_event, characterId: number, input: AddCharacterHistoryInput) =>
      addCharacterHistory(characterId, input)
  );

  ipcMain.handle("characterHistory:delete", (_event, historyId: number) =>
    deleteCharacterHistory(historyId)
  );

  // Chapters & Compressed BLOB Storage IPC
  ipcMain.handle("chapters:list", (_event, projectId: number) =>
    listChapters(projectId)
  );

  ipcMain.handle("chapters:get", (_event, chapterId: number) =>
    getChapter(chapterId)
  );

  ipcMain.handle(
    "chapters:create",
    (_event, projectId: number, input: CreateChapterInput) =>
      createChapter(projectId, input)
  );

  ipcMain.handle(
    "chapters:update",
    (_event, chapterId: number, input: UpdateChapterInput) =>
      updateChapter(chapterId, input)
  );

  ipcMain.handle("chapters:delete", (_event, chapterId: number) =>
    deleteChapter(chapterId)
  );

  // Arc Canvas IPC
  ipcMain.handle("arcCanvas:get", (_event, projectId: number) =>
    getArcCanvas(projectId)
  );

  ipcMain.handle(
    "arcCanvas:save",
    (_event, projectId: number, nodesJson: string, edgesJson: string) =>
      saveArcCanvas(projectId, nodesJson, edgesJson)
  );

  // 5-Step AI Writing Engine IPC
  ipcMain.handle("aiWriting:deltaPreview", (_event, projectId: number) =>
    runSmartDeltaScan(projectId, false)
  );

  ipcMain.handle(
    "aiWriting:generateOutline",
    (
      _event,
      params: {
        projectId: number;
        chapterId: number;
        metrics: AiWritingMetrics;
        outlineFeedback?: string;
        previousOutline?: string;
      }
    ) => generateChapterOutline(params)
  );

  ipcMain.handle(
    "aiWriting:writeChapter",
    (_event, request: WriteChapterRequest) => writeChapterProse(request)
  );

  ipcMain.handle(
    "aiWriting:detectProgression",
    (
      _event,
      params: { projectId: number; chapterId: number; outputLanguage: "tr" | "en" }
    ) => detectCharacterProgression(params)
  );

  // Glossary & Multi-Language Translation IPC
  ipcMain.handle("glossary:list", (_event, projectId: number) =>
    listGlossaryTerms(projectId)
  );

  ipcMain.handle(
    "glossary:create",
    (_event, projectId: number, term: string, description: string) =>
      createGlossaryTerm(projectId, term, description)
  );

  ipcMain.handle(
    "glossary:update",
    (_event, termId: number, term: string, description: string) =>
      updateGlossaryTerm(termId, term, description)
  );

  ipcMain.handle("glossary:delete", (_event, termId: number) =>
    deleteGlossaryTerm(termId)
  );

  ipcMain.handle("translations:list", (_event, chapterId: number) =>
    listChapterTranslations(chapterId)
  );

  ipcMain.handle(
    "translations:upsert",
    (
      _event,
      chapterId: number,
      sourceLang: string,
      targetLang: string,
      translatedText: string
    ) => upsertChapterTranslation(chapterId, sourceLang, targetLang, translatedText)
  );

  ipcMain.handle("translations:delete", (_event, translationId: number) =>
    deleteChapterTranslation(translationId)
  );

  ipcMain.handle(
    "translations:translateChapter",
    (
      _event,
      params: {
        projectId: number;
        chapterId: number;
        sourceLang: string;
        targetLang: string;
      }
    ) => translateChapterWithGlossary(params)
  );

  // BYOK AI Providers & OS Encrypted Vault IPC
  ipcMain.handle("aiProviders:encryptionStatus", () => ({
    available: isOsEncryptionAvailable(),
  }));

  ipcMain.handle("aiProviders:list", () => listAiProviders());

  ipcMain.handle("aiProviders:create", (_event, input: SaveAiProviderInput) =>
    createAiProvider(input)
  );

  ipcMain.handle(
    "aiProviders:update",
    (_event, providerId: number, input: SaveAiProviderInput) =>
      updateAiProvider(providerId, input)
  );

  ipcMain.handle("aiProviders:delete", (_event, providerId: number) =>
    deleteAiProvider(providerId)
  );

  ipcMain.handle(
    "aiProviders:setDefault",
    (_event, providerId: number, role: "writer" | "translator") =>
      setDefaultAiProvider(providerId, role)
  );

  ipcMain.handle(
    "aiProviders:test",
    async (_event, payload: TestConnectionPayload) => {
      if (payload.providerId !== undefined && !payload.providerType) {
        const { record, apiKey } = getAiProviderConfigWithSecret(
          payload.providerId
        );
        return testProviderConnection({
          providerType: record.providerType,
          baseUrl: record.baseUrl,
          modelName: record.modelName,
          apiKey,
        });
      }

      let resolvedKey = payload.apiKey?.trim() || "";
      if (!resolvedKey && payload.providerId !== undefined) {
        const saved = getAiProviderConfigWithSecret(payload.providerId);
        resolvedKey = saved.apiKey ?? "";
      }

      if (!payload.providerType || !payload.modelName) {
        return {
          ok: false,
          latencyMs: 0,
          message: "Provider type and model name are required.",
        };
      }

      return testProviderConnection({
        providerType: payload.providerType,
        baseUrl: payload.baseUrl,
        modelName: payload.modelName,
        apiKey: resolvedKey,
      });
    }
  );

  ipcMain.handle("shell:openExternal", async (_event, rawUrl: string) => {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") {
      throw new Error("Only https:// URLs can be opened externally.");
    }
    await shell.openExternal(parsed.toString());
  });
}

app.whenReady().then(() => {
  const userDataDir = app.getPath("userData");
  initSecretVault(userDataDir);
  initDatabase(path.join(userDataDir, "story_studio.db"));
  registerIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  closeDatabase();
});
