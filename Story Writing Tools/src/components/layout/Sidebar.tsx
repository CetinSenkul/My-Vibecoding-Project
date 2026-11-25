import {
  BookMarked,
  BookOpen,
  ChevronsUpDown,
  Feather,
  Globe2,
  Languages,
  Network,
  Settings,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";
import type { NavSection } from "../../types/navigation";

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

const WORKSPACE_ITEMS: { id: NavSection; icon: typeof Globe2 }[] = [
  { id: "world", icon: Globe2 },
  { id: "characters", icon: Users },
  { id: "arc-board", icon: Network },
  { id: "chapters", icon: BookOpen },
  { id: "translation", icon: Languages },
];

export function Sidebar({ activeSection, onSelectSection }: SidebarProps) {
  const { t } = useTranslation();
  const { activeProject, openProjectModal } = useApp();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-edge bg-sidebar select-none transition-colors duration-200">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-edge px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-sm">
          <Feather className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold tracking-tight text-ink">
            {t("app.name")}
          </h1>
          <p className="truncate text-xs text-ink-muted">{t("app.tagline")}</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-ink-muted">
            {t("nav.workspaceGroup")}
          </p>
          <ul className="space-y-1">
            {WORKSPACE_ITEMS.map(({ id, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelectSection(id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-accent-soft text-accent shadow-xs ring-1 ring-inset ring-edge-strong"
                        : "text-ink-secondary hover:bg-elevated hover:text-ink"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-accent" : "text-ink-muted"
                      }`}
                    />
                    <span className="truncate">{t(`nav.${id}`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-ink-muted">
            {t("nav.systemGroup")}
          </p>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => onSelectSection("settings")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
                  activeSection === "settings"
                    ? "bg-accent-soft text-accent shadow-xs ring-1 ring-inset ring-edge-strong"
                    : "text-ink-secondary hover:bg-elevated hover:text-ink"
                }`}
              >
                <Settings
                  className={`h-4 w-4 shrink-0 ${
                    activeSection === "settings" ? "text-accent" : "text-ink-muted"
                  }`}
                />
                <span className="truncate">{t("nav.settings")}</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Active Book Project Switcher */}
      <div className="border-t border-edge p-3">
        <button
          type="button"
          onClick={openProjectModal}
          className="group flex w-full items-center justify-between gap-2.5 rounded-xl border border-edge bg-surface px-3 py-2.5 text-left transition-all hover:border-edge-strong hover:bg-elevated"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <BookMarked className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-ink">
                {activeProject ? activeProject.title : t("app.noProjectSelected")}
              </span>
              <span className="block truncate text-[11px] text-ink-muted">
                {activeProject
                  ? activeProject.genre || t("projects.switchButton")
                  : t("app.createOrSelectProject")}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
        </button>
      </div>
    </aside>
  );
}
