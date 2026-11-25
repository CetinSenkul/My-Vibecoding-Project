import {
  BookMarked,
  Globe,
  Moon,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";
import type { LanguageCode, NavSection, ThemeId } from "../../types/navigation";

interface TopBarProps {
  activeSection: NavSection;
}

const THEME_ICONS: Record<ThemeId, typeof Moon> = {
  dark: Moon,
  light: Sun,
  space: Sparkles,
  fantasy: Wand2,
};

const THEME_ORDER: ThemeId[] = ["dark", "light", "space", "fantasy"];

export function TopBar({ activeSection }: TopBarProps) {
  const { t } = useTranslation();
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    activeProject,
    openProjectModal,
  } = useApp();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-edge bg-surface/85 px-6 backdrop-blur-sm transition-colors duration-200">
      {/* Left: Active Section Title & Active Book Pill */}
      <div className="flex min-w-0 items-center gap-3">
        <h2 className="truncate font-display text-base font-semibold text-ink">
          {t(`sections.${activeSection}.title`)}
        </h2>
        <button
          type="button"
          onClick={openProjectModal}
          className="hidden items-center gap-1.5 rounded-full border border-edge bg-elevated px-3 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-edge-strong hover:text-ink sm:inline-flex"
        >
          <BookMarked className="h-3.5 w-3.5 text-accent" />
          <span className="max-w-44 truncate">
            {activeProject ? activeProject.title : t("topbar.selectBook")}
          </span>
        </button>
      </div>

      {/* Right: Quick Theme & Language Controls */}
      <div className="flex shrink-0 items-center gap-3">
        {/* 4-Theme Quick Switcher */}
        <div
          className="flex items-center gap-1 rounded-lg border border-edge bg-elevated p-1"
          role="group"
          aria-label={t("topbar.theme")}
        >
          {THEME_ORDER.map((id) => {
            const Icon = THEME_ICONS[id];
            const isSelected = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                title={t(`themes.${id}.name`)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all duration-150 ${
                  isSelected
                    ? "bg-accent text-accent-fg shadow-xs"
                    : "text-ink-secondary hover:bg-surface hover:text-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{t(`themes.${id}.name`)}</span>
              </button>
            );
          })}
        </div>

        {/* Instant TR / EN Switcher */}
        <div
          className="flex items-center gap-1 rounded-lg border border-edge bg-elevated p-1"
          role="group"
          aria-label={t("topbar.language")}
        >
          <Globe className="ml-1.5 h-3.5 w-3.5 text-ink-muted" />
          {(["tr", "en"] as LanguageCode[]).map((lng) => {
            const isSelected = language === lng;
            return (
              <button
                key={lng}
                type="button"
                onClick={() => setLanguage(lng)}
                className={`rounded-md px-2 py-1 text-xs font-semibold uppercase transition-all duration-150 ${
                  isSelected
                    ? "bg-accent text-accent-fg shadow-xs"
                    : "text-ink-secondary hover:bg-surface hover:text-ink"
                }`}
              >
                {lng}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
