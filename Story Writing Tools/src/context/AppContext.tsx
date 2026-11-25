import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { storageBridge } from "../services/bridge";
import type {
  CreateProjectInput,
  DbInfo,
  ProjectRecord,
  UpdateProjectWorldInput,
} from "../types/electron";
import type { LanguageCode, ThemeId } from "../types/navigation";

const THEME_STORAGE_KEY = "storystudio.theme";
const VALID_THEMES: ThemeId[] = ["dark", "light", "space", "fantasy"];

interface AppContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  language: LanguageCode;
  setLanguage: (lng: LanguageCode) => void;
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  activeProjectId: number | null;
  dbInfo: DbInfo | null;
  isHydrated: boolean;
  isProjectModalOpen: boolean;
  openProjectModal: () => void;
  closeProjectModal: () => void;
  createProject: (input: CreateProjectInput) => Promise<ProjectRecord>;
  updateProjectWorld: (
    projectId: number,
    input: UpdateProjectWorldInput
  ) => Promise<ProjectRecord>;
  selectProject: (projectId: number) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;
  refreshDbInfo: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function getInitialTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved && VALID_THEMES.includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return "dark";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();

  const [theme, setThemeState] = useState<ThemeId>(getInitialTheme);
  const [language, setLanguageState] = useState<LanguageCode>(
    i18n.language === "en" ? "en" : "tr"
  );
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const refreshDbInfo = useCallback(async () => {
    const info = await storageBridge.getDbInfo();
    setDbInfo(info);
  }, []);

  // Apply theme attribute to root HTML element whenever theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Hydrate persisted language, theme, active project, and book list from SQLite on launch
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [settings, projectList, info] = await Promise.all([
          storageBridge.getSettings(),
          storageBridge.listProjects(),
          storageBridge.getDbInfo(),
        ]);

        if (cancelled) return;

        setThemeState(settings.theme);
        setLanguageState(settings.language);
        void i18n.changeLanguage(settings.language);
        setProjects(projectList);
        setActiveProjectId(settings.activeProjectId);
        setDbInfo(info);
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [i18n]);

  const setTheme = useCallback((nextTheme: ThemeId) => {
    setThemeState(nextTheme);
    void storageBridge.setSetting("Theme", nextTheme);
  }, []);

  const setLanguage = useCallback(
    (nextLang: LanguageCode) => {
      setLanguageState(nextLang);
      void i18n.changeLanguage(nextLang);
      void storageBridge.setSetting("Language", nextLang);
    },
    [i18n]
  );

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<ProjectRecord> => {
      const created = await storageBridge.createProject(input);
      const updatedList = await storageBridge.listProjects();
      setProjects(updatedList);
      setActiveProjectId(created.id);
      await refreshDbInfo();
      return created;
    },
    [refreshDbInfo]
  );

  const updateProjectWorld = useCallback(
    async (
      projectId: number,
      input: UpdateProjectWorldInput
    ): Promise<ProjectRecord> => {
      const updated = await storageBridge.updateProjectWorld(projectId, input);
      setProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      await refreshDbInfo();
      return updated;
    },
    [refreshDbInfo]
  );

  const selectProject = useCallback(async (projectId: number) => {
    const updated = await storageBridge.setActiveProject(projectId);
    setActiveProjectId(updated.activeProjectId);
  }, []);

  const deleteProject = useCallback(
    async (projectId: number) => {
      const updatedSettings = await storageBridge.deleteProject(projectId);
      const updatedList = await storageBridge.listProjects();
      setProjects(updatedList);
      setActiveProjectId(updatedSettings.activeProjectId);
      await refreshDbInfo();
    },
    [refreshDbInfo]
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const value: AppContextValue = {
    theme,
    setTheme,
    language,
    setLanguage,
    projects,
    activeProject,
    activeProjectId,
    dbInfo,
    isHydrated,
    isProjectModalOpen,
    openProjectModal: () => setIsProjectModalOpen(true),
    closeProjectModal: () => setIsProjectModalOpen(false),
    createProject,
    updateProjectWorld,
    selectProject,
    deleteProject,
    refreshDbInfo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return ctx;
}
