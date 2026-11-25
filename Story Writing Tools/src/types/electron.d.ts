import type { LanguageCode, ThemeId } from "./navigation";

export type AiProviderType = "Gemini" | "OpenAI" | "Anthropic" | "CustomOpenAI";

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  phase: number;
}

export interface DbInfo {
  dbPath: string;
  sizeBytes: number;
  projectCount: number;
}

export interface AppSettingsRecord {
  language: LanguageCode;
  theme: ThemeId;
  activeProjectId: number | null;
}

export interface ProjectRecord {
  id: number;
  title: string;
  genre: string;
  worldSummary: string;
  worldRulesJson: string;
  worldHash: string;
  createdAt: string;
}

export interface CreateProjectInput {
  title: string;
  genre?: string;
  worldSummary?: string;
}

export type WorldRuleCategory = "rule" | "magic_power" | "faction" | "lore";

export interface WorldRuleItem {
  id: string;
  category: WorldRuleCategory;
  title: string;
  description: string;
}

export interface UpdateProjectWorldInput {
  title: string;
  genre?: string;
  worldSummary?: string;
  worldRulesJson?: string;
}

export interface CustomModuleField {
  id: string;
  label: string;
  value: string;
}

export interface CustomModuleEntry {
  id: string;
  title: string;
  fields: CustomModuleField[];
}

export interface CharacterCustomModule {
  id: string;
  name: string;
  fieldSchema: string[];
  entries: CustomModuleEntry[];
}

export interface CharacterRecord {
  id: number;
  projectId: number;
  name: string;
  gender: string;
  age: string;
  family: string;
  abilities: string;
  personality: string;
  appearance: string;
  alignment: number;
  about: string;
  customModulesJson: string;
  contentHash: string;
}

export interface SaveCharacterInput {
  name: string;
  gender?: string;
  age?: string;
  family?: string;
  abilities?: string;
  personality?: string;
  appearance?: string;
  alignment: number;
  about?: string;
  customModulesJson?: string;
}

export interface CharacterHistoryRecord {
  id: number;
  characterId: number;
  chapterNumber: number | null;
  changeSummary: string;
  createdAt: string;
}

export interface AddCharacterHistoryInput {
  chapterNumber?: number | null;
  changeSummary: string;
}

export type ChapterStatus = "Draft" | "Completed";

export interface ChapterRecord {
  id: number;
  projectId: number;
  chapterNumber: number;
  title: string;
  draftNotes: string;
  content: string;
  status: ChapterStatus;
  updatedAt: string;
  rawBytes: number;
  compressedBytes: number;
}

export interface CreateChapterInput {
  chapterNumber?: number;
  title: string;
  draftNotes?: string;
}

export interface UpdateChapterInput {
  chapterNumber?: number;
  title: string;
  draftNotes: string;
  content: string;
  status: ChapterStatus;
}

export interface ArcCanvasRecord {
  projectId: number;
  nodesJson: string;
  edgesJson: string;
}

export type ChapterLengthOption = "shorten" | "approximate" | "extend";

export interface AiWritingMetrics {
  interventionPercent: number;
  lengthOption: ChapterLengthOption;
  writingStyles: string[];
  writingLanguage: string;
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

export interface GlossaryTermRecord {
  id: number;
  projectId: number;
  term: string;
  description: string;
}

export interface ChapterTranslationRecord {
  id: number;
  chapterId: number;
  sourceLang: string;
  targetLang: string;
  translatedText: string;
  updatedAt: string;
  rawBytes: number;
  compressedBytes: number;
}

export interface TranslateChapterResult {
  translation: ChapterTranslationRecord;
  glossaryTermsInjected: number;
  model: string;
}

export interface AiProviderRecord {
  id: number;
  name: string;
  providerType: AiProviderType;
  baseUrl: string;
  modelName: string;
  keyringRef: string;
  hasApiKey: boolean;
  maskedKey: string;
  isDefaultWriter: boolean;
  isDefaultTranslator: boolean;
}

export interface SaveAiProviderInput {
  name: string;
  providerType: AiProviderType;
  baseUrl?: string;
  modelName: string;
  apiKey?: string;
  clearApiKey?: boolean;
  isDefaultWriter?: boolean;
  isDefaultTranslator?: boolean;
}

export interface TestAiProviderPayload {
  providerId?: number;
  providerType?: AiProviderType;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  message: string;
}

export interface StoryStudioApi {
  getAppInfo: () => Promise<AppInfo>;
  getDbInfo: () => Promise<DbInfo>;
  getSettings: () => Promise<AppSettingsRecord>;
  setSetting: (
    key: "Language" | "Theme" | "ActiveProjectId",
    value: string
  ) => Promise<AppSettingsRecord>;
  listProjects: () => Promise<ProjectRecord[]>;
  createProject: (input: CreateProjectInput) => Promise<ProjectRecord>;
  deleteProject: (projectId: number) => Promise<AppSettingsRecord>;
  setActiveProject: (projectId: number | null) => Promise<AppSettingsRecord>;
  updateProjectWorld: (
    projectId: number,
    input: UpdateProjectWorldInput
  ) => Promise<ProjectRecord>;

  listCharacters: (projectId: number) => Promise<CharacterRecord[]>;
  createCharacter: (
    projectId: number,
    input: SaveCharacterInput
  ) => Promise<CharacterRecord>;
  updateCharacter: (
    characterId: number,
    input: SaveCharacterInput
  ) => Promise<CharacterRecord>;
  deleteCharacter: (characterId: number) => Promise<void>;
  listCharacterHistory: (characterId: number) => Promise<CharacterHistoryRecord[]>;
  addCharacterHistory: (
    characterId: number,
    input: AddCharacterHistoryInput
  ) => Promise<CharacterHistoryRecord>;
  deleteCharacterHistory: (historyId: number) => Promise<void>;

  listChapters: (projectId: number) => Promise<ChapterRecord[]>;
  getChapter: (chapterId: number) => Promise<ChapterRecord>;
  createChapter: (
    projectId: number,
    input: CreateChapterInput
  ) => Promise<ChapterRecord>;
  updateChapter: (
    chapterId: number,
    input: UpdateChapterInput
  ) => Promise<ChapterRecord>;
  deleteChapter: (chapterId: number) => Promise<void>;

  getArcCanvas: (projectId: number) => Promise<ArcCanvasRecord>;
  saveArcCanvas: (
    projectId: number,
    nodesJson: string,
    edgesJson: string
  ) => Promise<ArcCanvasRecord>;

  previewDeltaScan: (projectId: number) => Promise<DeltaScanReport>;
  generateChapterOutline: (params: {
    projectId: number;
    chapterId: number;
    metrics: AiWritingMetrics;
    outlineFeedback?: string;
    previousOutline?: string;
  }) => Promise<OutlineGenerationResult>;
  writeChapterProse: (
    request: WriteChapterRequest
  ) => Promise<WriteChapterResult>;
  detectCharacterProgression: (params: {
    projectId: number;
    chapterId: number;
    outputLanguage: "tr" | "en";
  }) => Promise<CharacterProgressionCandidate[]>;

  listGlossaryTerms: (projectId: number) => Promise<GlossaryTermRecord[]>;
  createGlossaryTerm: (
    projectId: number,
    term: string,
    description: string
  ) => Promise<GlossaryTermRecord>;
  updateGlossaryTerm: (
    termId: number,
    term: string,
    description: string
  ) => Promise<GlossaryTermRecord>;
  deleteGlossaryTerm: (termId: number) => Promise<void>;
  listChapterTranslations: (
    chapterId: number
  ) => Promise<ChapterTranslationRecord[]>;
  upsertChapterTranslation: (
    chapterId: number,
    sourceLang: string,
    targetLang: string,
    translatedText: string
  ) => Promise<ChapterTranslationRecord>;
  deleteChapterTranslation: (translationId: number) => Promise<void>;
  translateChapterWithGlossary: (params: {
    projectId: number;
    chapterId: number;
    sourceLang: string;
    targetLang: string;
  }) => Promise<TranslateChapterResult>;

  getEncryptionStatus: () => Promise<{ available: boolean }>;
  listAiProviders: () => Promise<AiProviderRecord[]>;
  createAiProvider: (input: SaveAiProviderInput) => Promise<AiProviderRecord>;
  updateAiProvider: (
    providerId: number,
    input: SaveAiProviderInput
  ) => Promise<AiProviderRecord>;
  deleteAiProvider: (providerId: number) => Promise<AiProviderRecord[]>;
  setDefaultAiProvider: (
    providerId: number,
    role: "writer" | "translator"
  ) => Promise<AiProviderRecord[]>;
  testAiProvider: (
    payload: TestAiProviderPayload
  ) => Promise<ConnectionTestResult>;
  openExternalUrl: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    storyStudio?: StoryStudioApi;
  }
}
