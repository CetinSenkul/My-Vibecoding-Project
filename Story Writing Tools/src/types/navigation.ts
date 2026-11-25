export type NavSection =
  | "world"
  | "characters"
  | "arc-board"
  | "chapters"
  | "translation"
  | "settings";

export type ThemeId = "dark" | "light" | "space" | "fantasy";

export type LanguageCode = "tr" | "en";

export interface ThemeMeta {
  id: ThemeId;
  previewBg: string;
  previewSurface: string;
  previewAccent: string;
  previewText: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: "dark",
    previewBg: "#111318",
    previewSurface: "#1a1d26",
    previewAccent: "#818cf8",
    previewText: "#ebedf5",
  },
  {
    id: "light",
    previewBg: "#f6f5f0",
    previewSurface: "#ffffff",
    previewAccent: "#4f46e5",
    previewText: "#1b1d24",
  },
  {
    id: "space",
    previewBg: "#070b1a",
    previewSurface: "#101730",
    previewAccent: "#38bdf8",
    previewText: "#e6f0ff",
  },
  {
    id: "fantasy",
    previewBg: "#f2e8cf",
    previewSurface: "#fbf6e9",
    previewAccent: "#8c1d2e",
    previewText: "#2c1e16",
  },
];
