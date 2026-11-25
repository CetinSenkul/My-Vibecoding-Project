import { useState } from "react";
import {
  Check,
  Database,
  Globe,
  KeyRound,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";
import { THEMES, type LanguageCode } from "../../types/navigation";
import { AiProvidersSection } from "../settings/AiProvidersSection";

type SettingsTab = "general" | "ai";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsView() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage, dbInfo } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-2">
      {/* Header + Sub-tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {t("sections.settings.title")}
          </h3>
          <p className="mt-1 text-sm text-ink-secondary">
            {t("sections.settings.subtitle")}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-edge bg-surface p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === "general"
                ? "bg-accent text-accent-fg shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t("settingsView.tabs.general")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === "ai"
                ? "bg-accent text-accent-fg shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {t("settingsView.tabs.aiProviders")}
          </button>
        </div>
      </div>

      {activeTab === "ai" ? (
        <AiProvidersSection />
      ) : (
        <>
          {/* Language Selector Card */}
          <section className="rounded-2xl border border-edge bg-surface p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-display text-base font-semibold text-ink">
                  {t("settingsView.languageCard.title")}
                </h4>
                <p className="mt-0.5 text-sm text-ink-secondary">
                  {t("settingsView.languageCard.description")}
                </p>

                <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
                  {(["tr", "en"] as LanguageCode[]).map((lng) => {
                    const isSelected = language === lng;
                    return (
                      <button
                        key={lng}
                        type="button"
                        onClick={() => setLanguage(lng)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
                          isSelected
                            ? "border-accent bg-accent-soft text-ink shadow-xs"
                            : "border-edge bg-elevated text-ink-secondary hover:border-edge-strong hover:text-ink"
                        }`}
                      >
                        <div>
                          <span className="block text-sm font-semibold">
                            {t(`languages.${lng}`)}
                          </span>
                          <span className="text-xs uppercase text-ink-muted">
                            {lng}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-fg">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 4-Theme Gallery Card */}
          <section className="rounded-2xl border border-edge bg-surface p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Palette className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-display text-base font-semibold text-ink">
                  {t("settingsView.themeCard.title")}
                </h4>
                <p className="mt-0.5 text-sm text-ink-secondary">
                  {t("settingsView.themeCard.description")}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {THEMES.map((item) => {
                    const isSelected = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-150 ${
                          isSelected
                            ? "border-accent ring-2 ring-accent/35"
                            : "border-edge hover:border-edge-strong"
                        }`}
                      >
                        <div
                          className="flex h-20 w-full items-end justify-between p-3"
                          style={{ backgroundColor: item.previewBg }}
                        >
                          <div
                            className="flex h-12 w-3/4 flex-col justify-center gap-1.5 rounded-lg p-2.5 shadow-sm"
                            style={{ backgroundColor: item.previewSurface }}
                          >
                            <div
                              className="h-2 w-2/3 rounded-full opacity-90"
                              style={{ backgroundColor: item.previewText }}
                            />
                            <div
                              className="h-1.5 w-1/2 rounded-full opacity-45"
                              style={{ backgroundColor: item.previewText }}
                            />
                          </div>
                          <span
                            className="h-6 w-6 rounded-full shadow-sm"
                            style={{ backgroundColor: item.previewAccent }}
                          />
                        </div>

                        <div className="flex flex-1 flex-col justify-between bg-elevated p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display text-sm font-semibold text-ink">
                              {t(`themes.${item.id}.name`)}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-fg">
                                <Check className="h-3 w-3" />
                                {t("settingsView.themeCard.active")}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                            {t(`themes.${item.id}.description`)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Active SQLite Storage & Shortcut to AI Providers */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-edge bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Database className="h-4 w-4 text-highlight" />
                  <h5 className="text-sm font-semibold text-ink">
                    {t("settingsView.storageCard.title")}
                  </h5>
                </div>
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-highlight">
                  {t("settingsView.storageCard.activeBadge")}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                {t("settingsView.storageCard.description")}
              </p>
              {dbInfo && (
                <dl className="mt-3 space-y-1.5 rounded-xl bg-elevated/80 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-ink-muted">
                      {t("settingsView.storageCard.sizeLabel")}
                    </dt>
                    <dd className="font-mono font-medium text-ink">
                      {formatBytes(dbInfo.sizeBytes)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-ink-muted">
                      {t("settingsView.storageCard.projectsLabel")}
                    </dt>
                    <dd className="font-mono font-medium text-ink">
                      {dbInfo.projectCount}
                    </dd>
                  </div>
                  <div className="border-t border-edge pt-1.5">
                    <dt className="text-[11px] text-ink-muted">
                      {t("settingsView.storageCard.pathLabel")}
                    </dt>
                    <dd className="mt-0.5 break-all font-mono text-[11px] text-ink-secondary">
                      {dbInfo.dbPath}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-edge bg-surface p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="h-4 w-4 text-accent" />
                    <h5 className="text-sm font-semibold text-ink">
                      {t("settingsView.aiProvidersCard.title")}
                    </h5>
                  </div>
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-highlight">
                    {t("settingsView.aiProvidersCard.activeBadge")}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  {t("settingsView.aiProvidersCard.description")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-edge-strong bg-elevated px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {t("settingsView.aiProvidersCard.manageButton")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
