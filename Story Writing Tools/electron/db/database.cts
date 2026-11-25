import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AiProviderType } from "../ai/providerAdapter.cjs";
import {
  deleteSecret,
  getMaskedSecret,
  getSecret,
  hasSecret,
  setSecret,
} from "../security/secretVault.cjs";
import { compressText, decompressText } from "../utils/compression.cjs";
import { computeCharacterHash, computeWorldHash } from "../utils/hash.cjs";

// Minimal typed interface for Node.js 22+ built-in `node:sqlite` (zero native compilation)
interface SqliteRunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

interface SqliteStatement {
  run(...params: unknown[]): SqliteRunResult;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (location: string) => SqliteDatabase;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite") as NodeSqliteModule;

export type LanguageCode = "tr" | "en";
export type ThemeId = "dark" | "light" | "space" | "fantasy";

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

export interface UpdateProjectWorldInput {
  title: string;
  genre?: string;
  worldSummary?: string;
  worldRulesJson?: string;
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

export interface AiSyncCacheEntry {
  projectId: number;
  entityType: "World" | "Character";
  entityId: number;
  lastSyncedHash: string;
  cachedSummary: string;
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

export interface DbInfo {
  dbPath: string;
  sizeBytes: number;
  projectCount: number;
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

const VALID_PROVIDER_TYPES: AiProviderType[] = [
  "Gemini",
  "OpenAI",
  "Anthropic",
  "CustomOpenAI",
];

const VALID_LANGUAGES: LanguageCode[] = ["tr", "en"];
const VALID_THEMES: ThemeId[] = ["dark", "light", "space", "fantasy"];

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS AppSettings (
    Key TEXT PRIMARY KEY,
    Value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Projects (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Genre TEXT,
    WorldSummary TEXT,
    WorldRulesJson TEXT DEFAULT '[]',
    WorldHash TEXT,
    CreatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Characters (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectId INTEGER NOT NULL,
    Name TEXT NOT NULL,
    Gender TEXT,
    Age TEXT,
    Family TEXT,
    Abilities TEXT,
    Personality TEXT,
    Appearance TEXT,
    Alignment INTEGER NOT NULL DEFAULT 50 CHECK (Alignment BETWEEN 0 AND 100),
    About TEXT,
    CustomModulesJson TEXT DEFAULT '[]',
    ContentHash TEXT,
    FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CharacterHistory (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    CharacterId INTEGER NOT NULL,
    ChapterNumber INTEGER,
    ChangeSummary TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (CharacterId) REFERENCES Characters(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Chapters (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectId INTEGER NOT NULL,
    ChapterNumber INTEGER NOT NULL,
    Title TEXT NOT NULL,
    DraftNotes TEXT DEFAULT '',
    ContentCompressed BLOB,
    Status TEXT NOT NULL DEFAULT 'Draft' CHECK (Status IN ('Draft', 'Completed')),
    UpdatedAt TEXT NOT NULL,
    FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ChapterTranslations (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ChapterId INTEGER NOT NULL,
    SourceLang TEXT NOT NULL,
    TargetLang TEXT NOT NULL,
    TranslatedCompressed BLOB,
    UpdatedAt TEXT NOT NULL,
    UNIQUE (ChapterId, TargetLang),
    FOREIGN KEY (ChapterId) REFERENCES Chapters(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS GlossaryTerms (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectId INTEGER NOT NULL,
    Term TEXT NOT NULL,
    Description TEXT NOT NULL,
    FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ArcCanvas (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectId INTEGER NOT NULL UNIQUE,
    NodesJson TEXT NOT NULL DEFAULT '[]',
    EdgesJson TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS AiSyncCache (
    ProjectId INTEGER NOT NULL,
    EntityType TEXT NOT NULL CHECK (EntityType IN ('World', 'Character')),
    EntityId INTEGER NOT NULL,
    LastSyncedHash TEXT NOT NULL,
    CachedSummary TEXT,
    PRIMARY KEY (ProjectId, EntityType, EntityId)
);

CREATE TABLE IF NOT EXISTS AiProviders (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    ProviderType TEXT NOT NULL,
    BaseUrl TEXT,
    ModelName TEXT NOT NULL,
    KeyringRef TEXT NOT NULL,
    IsDefaultWriter INTEGER NOT NULL DEFAULT 0,
    IsDefaultTranslator INTEGER NOT NULL DEFAULT 0
);
`;

let db: SqliteDatabase | null = null;
let currentDbPath = "";

export function initDatabase(dbFilePath: string): void {
  if (db) {
    closeDatabase();
  }

  const dir = path.dirname(dbFilePath);
  fs.mkdirSync(dir, { recursive: true });

  db = new DatabaseSync(dbFilePath);
  currentDbPath = dbFilePath;

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function getDb(): SqliteDatabase {
  if (!db) {
    throw new Error("Database has not been initialized.");
  }
  return db;
}

function mapProjectRow(row: Record<string, unknown>): ProjectRecord {
  return {
    id: Number(row.Id),
    title: String(row.Title ?? ""),
    genre: String(row.Genre ?? ""),
    worldSummary: String(row.WorldSummary ?? ""),
    worldRulesJson: String(row.WorldRulesJson ?? "[]"),
    worldHash: String(row.WorldHash ?? ""),
    createdAt: String(row.CreatedAt ?? ""),
  };
}

export function getDbInfo(): DbInfo {
  const database = getDb();
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(currentDbPath).size;
  } catch {
    sizeBytes = 0;
  }

  const countRow = database
    .prepare("SELECT COUNT(*) AS Total FROM Projects")
    .get();
  const projectCount = Number(countRow?.Total ?? 0);

  return {
    dbPath: currentDbPath,
    sizeBytes,
    projectCount,
  };
}

export function getAppSettings(): AppSettingsRecord {
  const database = getDb();
  const rows = database.prepare("SELECT Key, Value FROM AppSettings").all();
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(String(row.Key), String(row.Value));
  }

  const rawLang = map.get("Language") as LanguageCode | undefined;
  const language: LanguageCode =
    rawLang && VALID_LANGUAGES.includes(rawLang) ? rawLang : "tr";

  const rawTheme = map.get("Theme")?.toLowerCase() as ThemeId | undefined;
  const theme: ThemeId =
    rawTheme && VALID_THEMES.includes(rawTheme) ? rawTheme : "dark";

  const rawActiveId = map.get("ActiveProjectId");
  let activeProjectId: number | null = null;
  if (rawActiveId && rawActiveId !== "") {
    const parsed = Number(rawActiveId);
    if (Number.isInteger(parsed) && parsed > 0) {
      const exists = database
        .prepare("SELECT Id FROM Projects WHERE Id = ?")
        .get(parsed);
      if (exists) {
        activeProjectId = parsed;
      }
    }
  }

  // If no valid active project is recorded, pick the most recent project if one exists
  if (activeProjectId === null) {
    const latest = database
      .prepare("SELECT Id FROM Projects ORDER BY Id DESC LIMIT 1")
      .get();
    if (latest) {
      activeProjectId = Number(latest.Id);
    }
  }

  return { language, theme, activeProjectId };
}

export function setAppSetting(
  key: "Language" | "Theme" | "ActiveProjectId",
  value: string
): AppSettingsRecord {
  const database = getDb();

  if (key === "Language" && !VALID_LANGUAGES.includes(value as LanguageCode)) {
    throw new Error(`Unsupported language: ${value}`);
  }
  if (key === "Theme" && !VALID_THEMES.includes(value.toLowerCase() as ThemeId)) {
    throw new Error(`Unsupported theme: ${value}`);
  }

  const normalizedValue = key === "Theme" ? value.toLowerCase() : value;

  database
    .prepare(
      "INSERT INTO AppSettings (Key, Value) VALUES (?, ?) ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value"
    )
    .run(key, normalizedValue);

  return getAppSettings();
}

export function listProjects(): ProjectRecord[] {
  const database = getDb();
  const rows = database
    .prepare(
      "SELECT Id, Title, Genre, WorldSummary, WorldRulesJson, WorldHash, CreatedAt FROM Projects ORDER BY Id DESC"
    )
    .all();

  return rows.map(mapProjectRow);
}

export function createProject(input: CreateProjectInput): ProjectRecord {
  const database = getDb();
  const title = input.title.trim();
  if (!title) {
    throw new Error("Project title cannot be empty.");
  }

  const genre = (input.genre ?? "").trim();
  const worldSummary = (input.worldSummary ?? "").trim();
  const worldRulesJson = "[]";
  const worldHash = computeWorldHash({
    title,
    genre,
    worldSummary,
    worldRulesJson,
  });
  const createdAt = new Date().toISOString();

  const result = database
    .prepare(
      "INSERT INTO Projects (Title, Genre, WorldSummary, WorldRulesJson, WorldHash, CreatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(title, genre, worldSummary, worldRulesJson, worldHash, createdAt);

  const newId = Number(result.lastInsertRowid);

  // Set newly created project as active in AppSettings
  setAppSetting("ActiveProjectId", String(newId));

  const createdRow = database
    .prepare(
      "SELECT Id, Title, Genre, WorldSummary, WorldRulesJson, WorldHash, CreatedAt FROM Projects WHERE Id = ?"
    )
    .get(newId);

  if (!createdRow) {
    throw new Error("Failed to read back created project.");
  }

  return mapProjectRow(createdRow);
}

export function deleteProject(projectId: number): AppSettingsRecord {
  const database = getDb();
  database.prepare("DELETE FROM Projects WHERE Id = ?").run(projectId);

  const currentSettings = getAppSettings();
  if (currentSettings.activeProjectId === null) {
    setAppSetting("ActiveProjectId", "");
  } else {
    setAppSetting("ActiveProjectId", String(currentSettings.activeProjectId));
  }

  return getAppSettings();
}

function mapAiProviderRow(row: Record<string, unknown>): AiProviderRecord {
  const keyringRef = String(row.KeyringRef ?? "");
  return {
    id: Number(row.Id),
    name: String(row.Name ?? ""),
    providerType: String(row.ProviderType ?? "Gemini") as AiProviderType,
    baseUrl: String(row.BaseUrl ?? ""),
    modelName: String(row.ModelName ?? ""),
    keyringRef,
    hasApiKey: hasSecret(keyringRef),
    maskedKey: getMaskedSecret(keyringRef),
    isDefaultWriter: Number(row.IsDefaultWriter) === 1,
    isDefaultTranslator: Number(row.IsDefaultTranslator) === 1,
  };
}

export function listAiProviders(): AiProviderRecord[] {
  const database = getDb();
  const rows = database
    .prepare(
      "SELECT Id, Name, ProviderType, BaseUrl, ModelName, KeyringRef, IsDefaultWriter, IsDefaultTranslator FROM AiProviders ORDER BY Id DESC"
    )
    .all();

  return rows.map(mapAiProviderRow);
}

export function getAiProviderConfigWithSecret(providerId: number): {
  record: AiProviderRecord;
  apiKey: string | null;
} {
  const database = getDb();
  const row = database
    .prepare(
      "SELECT Id, Name, ProviderType, BaseUrl, ModelName, KeyringRef, IsDefaultWriter, IsDefaultTranslator FROM AiProviders WHERE Id = ?"
    )
    .get(providerId);

  if (!row) {
    throw new Error(`AI provider not found (id=${providerId}).`);
  }

  const record = mapAiProviderRow(row);
  return {
    record,
    apiKey: getSecret(record.keyringRef),
  };
}

export function createAiProvider(input: SaveAiProviderInput): AiProviderRecord {
  const database = getDb();
  const name = input.name.trim();
  const modelName = input.modelName.trim();
  const baseUrl = (input.baseUrl ?? "").trim();

  if (!name) throw new Error("Provider name is required.");
  if (!modelName) throw new Error("Model name is required.");
  if (!VALID_PROVIDER_TYPES.includes(input.providerType)) {
    throw new Error(`Unsupported provider type: ${input.providerType}`);
  }
  if (input.providerType === "CustomOpenAI" && !baseUrl) {
    throw new Error("Base URL is required for Custom OpenAI-Compatible providers.");
  }

  const keyringRef = `storystudio:provider:${randomUUID()}`;
  const existingCountRow = database
    .prepare("SELECT COUNT(*) AS Total FROM AiProviders")
    .get();
  const isFirst = Number(existingCountRow?.Total ?? 0) === 0;

  const isDefaultWriter = input.isDefaultWriter ?? isFirst;
  const isDefaultTranslator = input.isDefaultTranslator ?? isFirst;

  // Store secret strictly in OS encrypted vault (NEVER in story_studio.db)
  if (input.apiKey && input.apiKey.trim()) {
    setSecret(keyringRef, input.apiKey.trim());
  }

  if (isDefaultWriter) {
    database.prepare("UPDATE AiProviders SET IsDefaultWriter = 0").run();
  }
  if (isDefaultTranslator) {
    database.prepare("UPDATE AiProviders SET IsDefaultTranslator = 0").run();
  }

  const result = database
    .prepare(
      "INSERT INTO AiProviders (Name, ProviderType, BaseUrl, ModelName, KeyringRef, IsDefaultWriter, IsDefaultTranslator) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      name,
      input.providerType,
      baseUrl,
      modelName,
      keyringRef,
      isDefaultWriter ? 1 : 0,
      isDefaultTranslator ? 1 : 0
    );

  const newId = Number(result.lastInsertRowid);
  const row = database
    .prepare(
      "SELECT Id, Name, ProviderType, BaseUrl, ModelName, KeyringRef, IsDefaultWriter, IsDefaultTranslator FROM AiProviders WHERE Id = ?"
    )
    .get(newId);

  if (!row) {
    throw new Error("Failed to read back created AI provider.");
  }
  return mapAiProviderRow(row);
}

export function updateAiProvider(
  providerId: number,
  input: SaveAiProviderInput
): AiProviderRecord {
  const database = getDb();
  const existing = database
    .prepare("SELECT Id, KeyringRef FROM AiProviders WHERE Id = ?")
    .get(providerId);
  if (!existing) {
    throw new Error(`AI provider not found (id=${providerId}).`);
  }

  const name = input.name.trim();
  const modelName = input.modelName.trim();
  const baseUrl = (input.baseUrl ?? "").trim();
  const keyringRef = String(existing.KeyringRef);

  if (!name) throw new Error("Provider name is required.");
  if (!modelName) throw new Error("Model name is required.");
  if (!VALID_PROVIDER_TYPES.includes(input.providerType)) {
    throw new Error(`Unsupported provider type: ${input.providerType}`);
  }
  if (input.providerType === "CustomOpenAI" && !baseUrl) {
    throw new Error("Base URL is required for Custom OpenAI-Compatible providers.");
  }

  if (input.clearApiKey) {
    deleteSecret(keyringRef);
  } else if (input.apiKey && input.apiKey.trim()) {
    setSecret(keyringRef, input.apiKey.trim());
  }

  if (input.isDefaultWriter) {
    database.prepare("UPDATE AiProviders SET IsDefaultWriter = 0").run();
  }
  if (input.isDefaultTranslator) {
    database.prepare("UPDATE AiProviders SET IsDefaultTranslator = 0").run();
  }

  database
    .prepare(
      `UPDATE AiProviders
       SET Name = ?, ProviderType = ?, BaseUrl = ?, ModelName = ?,
           IsDefaultWriter = COALESCE(?, IsDefaultWriter),
           IsDefaultTranslator = COALESCE(?, IsDefaultTranslator)
       WHERE Id = ?`
    )
    .run(
      name,
      input.providerType,
      baseUrl,
      modelName,
      input.isDefaultWriter === undefined ? null : input.isDefaultWriter ? 1 : 0,
      input.isDefaultTranslator === undefined
        ? null
        : input.isDefaultTranslator
          ? 1
          : 0,
      providerId
    );

  const row = database
    .prepare(
      "SELECT Id, Name, ProviderType, BaseUrl, ModelName, KeyringRef, IsDefaultWriter, IsDefaultTranslator FROM AiProviders WHERE Id = ?"
    )
    .get(providerId);

  if (!row) {
    throw new Error("Failed to read back updated AI provider.");
  }
  return mapAiProviderRow(row);
}

export function deleteAiProvider(providerId: number): AiProviderRecord[] {
  const database = getDb();
  const existing = database
    .prepare("SELECT KeyringRef FROM AiProviders WHERE Id = ?")
    .get(providerId);

  if (existing) {
    deleteSecret(String(existing.KeyringRef));
  }

  database.prepare("DELETE FROM AiProviders WHERE Id = ?").run(providerId);
  return listAiProviders();
}

export function setDefaultAiProvider(
  providerId: number,
  role: "writer" | "translator"
): AiProviderRecord[] {
  const database = getDb();
  const column = role === "writer" ? "IsDefaultWriter" : "IsDefaultTranslator";
  database.prepare(`UPDATE AiProviders SET ${column} = 0`).run();
  database
    .prepare(`UPDATE AiProviders SET ${column} = 1 WHERE Id = ?`)
    .run(providerId);
  return listAiProviders();
}

export function updateProjectWorld(
  projectId: number,
  input: UpdateProjectWorldInput
): ProjectRecord {
  const database = getDb();
  const title = input.title.trim();
  if (!title) {
    throw new Error("Project title cannot be empty.");
  }

  const genre = (input.genre ?? "").trim();
  const worldSummary = (input.worldSummary ?? "").trim();
  const worldRulesJson = input.worldRulesJson ?? "[]";
  const worldHash = computeWorldHash({
    title,
    genre,
    worldSummary,
    worldRulesJson,
  });

  database
    .prepare(
      `UPDATE Projects
       SET Title = ?, Genre = ?, WorldSummary = ?, WorldRulesJson = ?, WorldHash = ?
       WHERE Id = ?`
    )
    .run(title, genre, worldSummary, worldRulesJson, worldHash, projectId);

  const row = database
    .prepare(
      "SELECT Id, Title, Genre, WorldSummary, WorldRulesJson, WorldHash, CreatedAt FROM Projects WHERE Id = ?"
    )
    .get(projectId);

  if (!row) {
    throw new Error(`Project not found (id=${projectId}).`);
  }
  return mapProjectRow(row);
}

function clampAlignment(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mapCharacterRow(row: Record<string, unknown>): CharacterRecord {
  return {
    id: Number(row.Id),
    projectId: Number(row.ProjectId),
    name: String(row.Name ?? ""),
    gender: String(row.Gender ?? ""),
    age: String(row.Age ?? ""),
    family: String(row.Family ?? ""),
    abilities: String(row.Abilities ?? ""),
    personality: String(row.Personality ?? ""),
    appearance: String(row.Appearance ?? ""),
    alignment: Number(row.Alignment ?? 50),
    about: String(row.About ?? ""),
    customModulesJson: String(row.CustomModulesJson ?? "[]"),
    contentHash: String(row.ContentHash ?? ""),
  };
}

function mapCharacterHistoryRow(
  row: Record<string, unknown>
): CharacterHistoryRecord {
  return {
    id: Number(row.Id),
    characterId: Number(row.CharacterId),
    chapterNumber:
      row.ChapterNumber === null || row.ChapterNumber === undefined
        ? null
        : Number(row.ChapterNumber),
    changeSummary: String(row.ChangeSummary ?? ""),
    createdAt: String(row.CreatedAt ?? ""),
  };
}

export function listCharacters(projectId: number): CharacterRecord[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT Id, ProjectId, Name, Gender, Age, Family, Abilities, Personality, Appearance, Alignment, About, CustomModulesJson, ContentHash
       FROM Characters
       WHERE ProjectId = ?
       ORDER BY Id ASC`
    )
    .all(projectId);

  return rows.map(mapCharacterRow);
}

export function createCharacter(
  projectId: number,
  input: SaveCharacterInput
): CharacterRecord {
  const database = getDb();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Character name is required.");
  }

  const gender = (input.gender ?? "").trim();
  const age = (input.age ?? "").trim();
  const family = (input.family ?? "").trim();
  const abilities = (input.abilities ?? "").trim();
  const personality = (input.personality ?? "").trim();
  const appearance = (input.appearance ?? "").trim();
  const alignment = clampAlignment(input.alignment);
  const about = (input.about ?? "").trim();
  const customModulesJson = input.customModulesJson ?? "[]";
  const contentHash = computeCharacterHash({
    name,
    gender,
    age,
    family,
    abilities,
    personality,
    appearance,
    alignment,
    about,
    customModulesJson,
  });

  const result = database
    .prepare(
      `INSERT INTO Characters
       (ProjectId, Name, Gender, Age, Family, Abilities, Personality, Appearance, Alignment, About, CustomModulesJson, ContentHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      projectId,
      name,
      gender,
      age,
      family,
      abilities,
      personality,
      appearance,
      alignment,
      about,
      customModulesJson,
      contentHash
    );

  const newId = Number(result.lastInsertRowid);
  const row = database
    .prepare(
      `SELECT Id, ProjectId, Name, Gender, Age, Family, Abilities, Personality, Appearance, Alignment, About, CustomModulesJson, ContentHash
       FROM Characters WHERE Id = ?`
    )
    .get(newId);

  if (!row) {
    throw new Error("Failed to read back created character.");
  }
  return mapCharacterRow(row);
}

export function updateCharacter(
  characterId: number,
  input: SaveCharacterInput
): CharacterRecord {
  const database = getDb();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Character name is required.");
  }

  const gender = (input.gender ?? "").trim();
  const age = (input.age ?? "").trim();
  const family = (input.family ?? "").trim();
  const abilities = (input.abilities ?? "").trim();
  const personality = (input.personality ?? "").trim();
  const appearance = (input.appearance ?? "").trim();
  const alignment = clampAlignment(input.alignment);
  const about = (input.about ?? "").trim();
  const customModulesJson = input.customModulesJson ?? "[]";
  const contentHash = computeCharacterHash({
    name,
    gender,
    age,
    family,
    abilities,
    personality,
    appearance,
    alignment,
    about,
    customModulesJson,
  });

  database
    .prepare(
      `UPDATE Characters
       SET Name = ?, Gender = ?, Age = ?, Family = ?, Abilities = ?, Personality = ?,
           Appearance = ?, Alignment = ?, About = ?, CustomModulesJson = ?, ContentHash = ?
       WHERE Id = ?`
    )
    .run(
      name,
      gender,
      age,
      family,
      abilities,
      personality,
      appearance,
      alignment,
      about,
      customModulesJson,
      contentHash,
      characterId
    );

  const row = database
    .prepare(
      `SELECT Id, ProjectId, Name, Gender, Age, Family, Abilities, Personality, Appearance, Alignment, About, CustomModulesJson, ContentHash
       FROM Characters WHERE Id = ?`
    )
    .get(characterId);

  if (!row) {
    throw new Error(`Character not found (id=${characterId}).`);
  }
  return mapCharacterRow(row);
}

export function deleteCharacter(characterId: number): void {
  const database = getDb();
  database.prepare("DELETE FROM Characters WHERE Id = ?").run(characterId);
}

export function listCharacterHistory(
  characterId: number
): CharacterHistoryRecord[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT Id, CharacterId, ChapterNumber, ChangeSummary, CreatedAt
       FROM CharacterHistory
       WHERE CharacterId = ?
       ORDER BY COALESCE(ChapterNumber, 0) ASC, Id ASC`
    )
    .all(characterId);

  return rows.map(mapCharacterHistoryRow);
}

export function addCharacterHistory(
  characterId: number,
  input: AddCharacterHistoryInput
): CharacterHistoryRecord {
  const database = getDb();
  const summary = input.changeSummary.trim();
  if (!summary) {
    throw new Error("Change summary cannot be empty.");
  }

  const chapterNumber =
    input.chapterNumber === undefined ||
    input.chapterNumber === null ||
    Number.isNaN(Number(input.chapterNumber))
      ? null
      : Number(input.chapterNumber);

  const createdAt = new Date().toISOString();

  const result = database
    .prepare(
      `INSERT INTO CharacterHistory (CharacterId, ChapterNumber, ChangeSummary, CreatedAt)
       VALUES (?, ?, ?, ?)`
    )
    .run(characterId, chapterNumber, summary, createdAt);

  const newId = Number(result.lastInsertRowid);
  const row = database
    .prepare(
      "SELECT Id, CharacterId, ChapterNumber, ChangeSummary, CreatedAt FROM CharacterHistory WHERE Id = ?"
    )
    .get(newId);

  if (!row) {
    throw new Error("Failed to read back character history entry.");
  }
  return mapCharacterHistoryRow(row);
}

export function deleteCharacterHistory(historyId: number): void {
  const database = getDb();
  database.prepare("DELETE FROM CharacterHistory WHERE Id = ?").run(historyId);
}

function mapChapterRow(row: Record<string, unknown>): ChapterRecord {
  const blob = row.ContentCompressed as Uint8Array | Buffer | null | undefined;
  const content = decompressText(blob);
  const rawBytes = Buffer.byteLength(content, "utf8");
  const compressedBytes = blob ? blob.length : 0;

  return {
    id: Number(row.Id),
    projectId: Number(row.ProjectId),
    chapterNumber: Number(row.ChapterNumber),
    title: String(row.Title ?? ""),
    draftNotes: String(row.DraftNotes ?? ""),
    content,
    status:
      row.Status === "Completed" ? ("Completed" as const) : ("Draft" as const),
    updatedAt: String(row.UpdatedAt ?? ""),
    rawBytes,
    compressedBytes,
  };
}

export function listChapters(projectId: number): ChapterRecord[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT Id, ProjectId, ChapterNumber, Title, DraftNotes, ContentCompressed, Status, UpdatedAt
       FROM Chapters
       WHERE ProjectId = ?
       ORDER BY ChapterNumber ASC, Id ASC`
    )
    .all(projectId);

  return rows.map(mapChapterRow);
}

export function getChapter(chapterId: number): ChapterRecord {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT Id, ProjectId, ChapterNumber, Title, DraftNotes, ContentCompressed, Status, UpdatedAt
       FROM Chapters
       WHERE Id = ?`
    )
    .get(chapterId);

  if (!row) {
    throw new Error(`Chapter not found (id=${chapterId}).`);
  }
  return mapChapterRow(row);
}

export function createChapter(
  projectId: number,
  input: CreateChapterInput
): ChapterRecord {
  const database = getDb();
  const title = input.title.trim();
  if (!title) {
    throw new Error("Chapter title is required.");
  }

  let chapterNumber = input.chapterNumber;
  if (!chapterNumber || !Number.isInteger(chapterNumber) || chapterNumber < 1) {
    const maxRow = database
      .prepare(
        "SELECT COALESCE(MAX(ChapterNumber), 0) AS MaxNum FROM Chapters WHERE ProjectId = ?"
      )
      .get(projectId);
    chapterNumber = Number(maxRow?.MaxNum ?? 0) + 1;
  }

  const draftNotes = input.draftNotes ?? "";
  const emptyBlob = compressText("");
  const updatedAt = new Date().toISOString();

  const result = database
    .prepare(
      `INSERT INTO Chapters (ProjectId, ChapterNumber, Title, DraftNotes, ContentCompressed, Status, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, 'Draft', ?)`
    )
    .run(projectId, chapterNumber, title, draftNotes, emptyBlob, updatedAt);

  return getChapter(Number(result.lastInsertRowid));
}

export function updateChapter(
  chapterId: number,
  input: UpdateChapterInput
): ChapterRecord {
  const database = getDb();
  const existing = getChapter(chapterId);
  const title = input.title.trim();
  if (!title) {
    throw new Error("Chapter title is required.");
  }

  const chapterNumber =
    input.chapterNumber && Number.isInteger(input.chapterNumber) && input.chapterNumber >= 1
      ? input.chapterNumber
      : existing.chapterNumber;
  const status: ChapterStatus =
    input.status === "Completed" ? "Completed" : "Draft";
  const compressed = compressText(input.content ?? "");
  const updatedAt = new Date().toISOString();

  database
    .prepare(
      `UPDATE Chapters
       SET ChapterNumber = ?, Title = ?, DraftNotes = ?, ContentCompressed = ?, Status = ?, UpdatedAt = ?
       WHERE Id = ?`
    )
    .run(
      chapterNumber,
      title,
      input.draftNotes ?? "",
      compressed,
      status,
      updatedAt,
      chapterId
    );

  return getChapter(chapterId);
}

export function deleteChapter(chapterId: number): void {
  const database = getDb();
  database.prepare("DELETE FROM Chapters WHERE Id = ?").run(chapterId);
}

export function getArcCanvas(projectId: number): ArcCanvasRecord {
  const database = getDb();
  const row = database
    .prepare(
      "SELECT ProjectId, NodesJson, EdgesJson FROM ArcCanvas WHERE ProjectId = ?"
    )
    .get(projectId);

  if (!row) {
    return {
      projectId,
      nodesJson: "[]",
      edgesJson: "[]",
    };
  }

  return {
    projectId: Number(row.ProjectId),
    nodesJson: String(row.NodesJson ?? "[]"),
    edgesJson: String(row.EdgesJson ?? "[]"),
  };
}

export function saveArcCanvas(
  projectId: number,
  nodesJson: string,
  edgesJson: string
): ArcCanvasRecord {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO ArcCanvas (ProjectId, NodesJson, EdgesJson)
       VALUES (?, ?, ?)
       ON CONFLICT(ProjectId) DO UPDATE SET
         NodesJson = excluded.NodesJson,
         EdgesJson = excluded.EdgesJson`
    )
    .run(projectId, nodesJson, edgesJson);

  return getArcCanvas(projectId);
}

export function getProjectById(projectId: number): ProjectRecord {
  const database = getDb();
  const row = database
    .prepare(
      "SELECT Id, Title, Genre, WorldSummary, WorldRulesJson, WorldHash, CreatedAt FROM Projects WHERE Id = ?"
    )
    .get(projectId);
  if (!row) {
    throw new Error(`Project not found (id=${projectId}).`);
  }
  return mapProjectRow(row);
}

export function getDefaultAiProviderWithSecret(
  role: "writer" | "translator"
): { record: AiProviderRecord; apiKey: string | null } | null {
  const database = getDb();
  const primaryCol =
    role === "writer" ? "IsDefaultWriter" : "IsDefaultTranslator";
  const fallbackCol =
    role === "writer" ? "IsDefaultTranslator" : "IsDefaultWriter";

  const row =
    database
      .prepare(
        `SELECT Id, Name, ProviderType, BaseUrl, ModelName, KeyringRef, IsDefaultWriter, IsDefaultTranslator
         FROM AiProviders WHERE ${primaryCol} = 1 LIMIT 1`
      )
      .get() ??
    database
      .prepare(
        `SELECT Id, Name, ProviderType, BaseUrl, ModelName, KeyringRef, IsDefaultWriter, IsDefaultTranslator
         FROM AiProviders WHERE ${fallbackCol} = 1 LIMIT 1`
      )
      .get() ??
    database
      .prepare(
        `SELECT Id, Name, ProviderType, BaseUrl, ModelName, KeyringRef, IsDefaultWriter, IsDefaultTranslator
         FROM AiProviders ORDER BY Id DESC LIMIT 1`
      )
      .get();

  if (!row) return null;
  const record = mapAiProviderRow(row);
  return {
    record,
    apiKey: getSecret(record.keyringRef),
  };
}

export function listAiSyncCache(projectId: number): AiSyncCacheEntry[] {
  const database = getDb();
  const rows = database
    .prepare(
      "SELECT ProjectId, EntityType, EntityId, LastSyncedHash, CachedSummary FROM AiSyncCache WHERE ProjectId = ?"
    )
    .all(projectId);

  return rows.map((row) => ({
    projectId: Number(row.ProjectId),
    entityType:
      row.EntityType === "World" ? ("World" as const) : ("Character" as const),
    entityId: Number(row.EntityId),
    lastSyncedHash: String(row.LastSyncedHash ?? ""),
    cachedSummary: String(row.CachedSummary ?? ""),
  }));
}

export function upsertAiSyncCache(entry: AiSyncCacheEntry): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO AiSyncCache (ProjectId, EntityType, EntityId, LastSyncedHash, CachedSummary)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(ProjectId, EntityType, EntityId) DO UPDATE SET
         LastSyncedHash = excluded.LastSyncedHash,
         CachedSummary = excluded.CachedSummary`
    )
    .run(
      entry.projectId,
      entry.entityType,
      entry.entityId,
      entry.lastSyncedHash,
      entry.cachedSummary
    );
}

export function deleteAiSyncCacheEntity(
  projectId: number,
  entityType: "World" | "Character",
  entityId: number
): void {
  const database = getDb();
  database
    .prepare(
      "DELETE FROM AiSyncCache WHERE ProjectId = ? AND EntityType = ? AND EntityId = ?"
    )
    .run(projectId, entityType, entityId);
}

// Glossary Terms CRUD
function mapGlossaryRow(row: Record<string, unknown>): GlossaryTermRecord {
  return {
    id: Number(row.Id),
    projectId: Number(row.ProjectId),
    term: String(row.Term ?? ""),
    description: String(row.Description ?? ""),
  };
}

export function listGlossaryTerms(projectId: number): GlossaryTermRecord[] {
  const database = getDb();
  const rows = database
    .prepare(
      "SELECT Id, ProjectId, Term, Description FROM GlossaryTerms WHERE ProjectId = ? ORDER BY Term COLLATE NOCASE ASC"
    )
    .all(projectId);
  return rows.map(mapGlossaryRow);
}

export function createGlossaryTerm(
  projectId: number,
  term: string,
  description: string
): GlossaryTermRecord {
  const database = getDb();
  const cleanTerm = term.trim();
  const cleanDesc = description.trim();
  if (!cleanTerm) throw new Error("Glossary term is required.");
  if (!cleanDesc) throw new Error("Glossary description is required.");

  const result = database
    .prepare(
      "INSERT INTO GlossaryTerms (ProjectId, Term, Description) VALUES (?, ?, ?)"
    )
    .run(projectId, cleanTerm, cleanDesc);

  const row = database
    .prepare(
      "SELECT Id, ProjectId, Term, Description FROM GlossaryTerms WHERE Id = ?"
    )
    .get(Number(result.lastInsertRowid));
  if (!row) throw new Error("Failed to read back glossary term.");
  return mapGlossaryRow(row);
}

export function updateGlossaryTerm(
  termId: number,
  term: string,
  description: string
): GlossaryTermRecord {
  const database = getDb();
  const cleanTerm = term.trim();
  const cleanDesc = description.trim();
  if (!cleanTerm) throw new Error("Glossary term is required.");
  if (!cleanDesc) throw new Error("Glossary description is required.");

  database
    .prepare(
      "UPDATE GlossaryTerms SET Term = ?, Description = ? WHERE Id = ?"
    )
    .run(cleanTerm, cleanDesc, termId);

  const row = database
    .prepare(
      "SELECT Id, ProjectId, Term, Description FROM GlossaryTerms WHERE Id = ?"
    )
    .get(termId);
  if (!row) throw new Error(`Glossary term not found (id=${termId}).`);
  return mapGlossaryRow(row);
}

export function deleteGlossaryTerm(termId: number): void {
  const database = getDb();
  database.prepare("DELETE FROM GlossaryTerms WHERE Id = ?").run(termId);
}

// Chapter Translations (Compressed BLOB) CRUD
function mapTranslationRow(
  row: Record<string, unknown>
): ChapterTranslationRecord {
  const blob = row.TranslatedCompressed as
    | Uint8Array
    | Buffer
    | null
    | undefined;
  const translatedText = decompressText(blob);
  const rawBytes = Buffer.byteLength(translatedText, "utf8");
  const compressedBytes = blob ? blob.length : 0;

  return {
    id: Number(row.Id),
    chapterId: Number(row.ChapterId),
    sourceLang: String(row.SourceLang ?? ""),
    targetLang: String(row.TargetLang ?? ""),
    translatedText,
    updatedAt: String(row.UpdatedAt ?? ""),
    rawBytes,
    compressedBytes,
  };
}

export function listChapterTranslations(
  chapterId: number
): ChapterTranslationRecord[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT Id, ChapterId, SourceLang, TargetLang, TranslatedCompressed, UpdatedAt
       FROM ChapterTranslations
       WHERE ChapterId = ?
       ORDER BY TargetLang ASC`
    )
    .all(chapterId);
  return rows.map(mapTranslationRow);
}

export function upsertChapterTranslation(
  chapterId: number,
  sourceLang: string,
  targetLang: string,
  translatedText: string
): ChapterTranslationRecord {
  const database = getDb();
  const cleanSource = sourceLang.trim();
  const cleanTarget = targetLang.trim();
  if (!cleanSource || !cleanTarget) {
    throw new Error("Source and target languages are required.");
  }

  const compressed = compressText(translatedText);
  const updatedAt = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO ChapterTranslations (ChapterId, SourceLang, TargetLang, TranslatedCompressed, UpdatedAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(ChapterId, TargetLang) DO UPDATE SET
         SourceLang = excluded.SourceLang,
         TranslatedCompressed = excluded.TranslatedCompressed,
         UpdatedAt = excluded.UpdatedAt`
    )
    .run(chapterId, cleanSource, cleanTarget, compressed, updatedAt);

  const row = database
    .prepare(
      `SELECT Id, ChapterId, SourceLang, TargetLang, TranslatedCompressed, UpdatedAt
       FROM ChapterTranslations
       WHERE ChapterId = ? AND TargetLang = ?`
    )
    .get(chapterId, cleanTarget);
  if (!row) {
    throw new Error("Failed to read back chapter translation.");
  }
  return mapTranslationRow(row);
}

export function deleteChapterTranslation(translationId: number): void {
  const database = getDb();
  database
    .prepare("DELETE FROM ChapterTranslations WHERE Id = ?")
    .run(translationId);
}
