import { useState, type FormEvent } from "react";
import { Layers, Plus, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  CharacterCustomModule,
  CustomModuleEntry,
} from "../../types/electron";

interface CustomModulesEditorProps {
  modules: CharacterCustomModule[];
  onChange: (nextModules: CharacterCustomModule[]) => void;
}

export function CustomModulesEditor({
  modules,
  onChange,
}: CustomModulesEditorProps) {
  const { t } = useTranslation();

  const [newModuleName, setNewModuleName] = useState("");
  const [newSchemaInput, setNewSchemaInput] = useState("");
  const [newEntryTitles, setNewEntryTitles] = useState<Record<string, string>>(
    {}
  );
  const [newFieldLabels, setNewFieldLabels] = useState<Record<string, string>>(
    {}
  );

  const templates = [
    {
      name: t("charactersView.modules.templates.pets.name"),
      schema: t("charactersView.modules.templates.pets.fields", {
        returnObjects: true,
      }) as string[],
    },
    {
      name: t("charactersView.modules.templates.items.name"),
      schema: t("charactersView.modules.templates.items.fields", {
        returnObjects: true,
      }) as string[],
    },
    {
      name: t("charactersView.modules.templates.companions.name"),
      schema: t("charactersView.modules.templates.companions.fields", {
        returnObjects: true,
      }) as string[],
    },
  ];

  const addModule = (moduleName: string, fieldSchema: string[]) => {
    const trimmed = moduleName.trim();
    if (!trimmed) return;

    const cleanSchema = fieldSchema
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const created: CharacterCustomModule = {
      id: crypto.randomUUID(),
      name: trimmed,
      fieldSchema:
        cleanSchema.length > 0
          ? cleanSchema
          : [t("charactersView.modules.defaultFieldLabel")],
      entries: [],
    };
    onChange([...modules, created]);
  };

  const handleCreateCustomModule = (event: FormEvent) => {
    event.preventDefault();
    if (!newModuleName.trim()) return;
    const schema = newSchemaInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    addModule(newModuleName, schema);
    setNewModuleName("");
    setNewSchemaInput("");
  };

  const deleteModule = (moduleId: string) => {
    onChange(modules.filter((m) => m.id !== moduleId));
  };

  const addEntryToModule = (module: CharacterCustomModule) => {
    const title = (newEntryTitles[module.id] ?? "").trim();
    if (!title) return;

    const entry: CustomModuleEntry = {
      id: crypto.randomUUID(),
      title,
      fields: module.fieldSchema.map((label) => ({
        id: crypto.randomUUID(),
        label,
        value: "",
      })),
    };

    onChange(
      modules.map((m) =>
        m.id === module.id ? { ...m, entries: [...m.entries, entry] } : m
      )
    );
    setNewEntryTitles((prev) => ({ ...prev, [module.id]: "" }));
  };

  const updateEntryTitle = (
    moduleId: string,
    entryId: string,
    title: string
  ) => {
    onChange(
      modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              entries: m.entries.map((e) =>
                e.id === entryId ? { ...e, title } : e
              ),
            }
          : m
      )
    );
  };

  const updateFieldValue = (
    moduleId: string,
    entryId: string,
    fieldId: string,
    value: string
  ) => {
    onChange(
      modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              entries: m.entries.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      fields: e.fields.map((f) =>
                        f.id === fieldId ? { ...f, value } : f
                      ),
                    }
                  : e
              ),
            }
          : m
      )
    );
  };

  const addFieldToEntry = (moduleId: string, entryId: string) => {
    const key = `${moduleId}:${entryId}`;
    const label = (newFieldLabels[key] ?? "").trim();
    if (!label) return;

    onChange(
      modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              entries: m.entries.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      fields: [
                        ...e.fields,
                        { id: crypto.randomUUID(), label, value: "" },
                      ],
                    }
                  : e
              ),
            }
          : m
      )
    );
    setNewFieldLabels((prev) => ({ ...prev, [key]: "" }));
  };

  const deleteFieldFromEntry = (
    moduleId: string,
    entryId: string,
    fieldId: string
  ) => {
    onChange(
      modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              entries: m.entries.map((e) =>
                e.id === entryId
                  ? { ...e, fields: e.fields.filter((f) => f.id !== fieldId) }
                  : e
              ),
            }
          : m
      )
    );
  };

  const deleteEntry = (moduleId: string, entryId: string) => {
    onChange(
      modules.map((m) =>
        m.id === moduleId
          ? { ...m, entries: m.entries.filter((e) => e.id !== entryId) }
          : m
      )
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Add to Character Builder Card */}
      <div className="rounded-xl border border-edge bg-elevated/60 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h5 className="text-xs font-semibold uppercase tracking-wider text-ink">
            {t("charactersView.modules.addTitle")}
          </h5>
        </div>
        <p className="mt-1 text-xs text-ink-secondary">
          {t("charactersView.modules.addSubtitle")}
        </p>

        {/* Quick Templates */}
        <div className="mt-3 flex flex-wrap gap-2">
          {templates.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => addModule(tpl.name, tpl.schema)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-edge-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              {tpl.name}
            </button>
          ))}
        </div>

        {/* Custom Schema Form */}
        <form
          onSubmit={handleCreateCustomModule}
          className="mt-4 grid grid-cols-1 gap-2.5 border-t border-edge pt-3 sm:grid-cols-12"
        >
          <input
            type="text"
            value={newModuleName}
            onChange={(e) => setNewModuleName(e.target.value)}
            placeholder={t("charactersView.modules.moduleNamePlaceholder")}
            className="rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:col-span-4"
          />
          <input
            type="text"
            value={newSchemaInput}
            onChange={(e) => setNewSchemaInput(e.target.value)}
            placeholder={t("charactersView.modules.schemaPlaceholder")}
            className="rounded-lg border border-edge-strong bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:col-span-6"
          />
          <button
            type="submit"
            disabled={!newModuleName.trim()}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-50 sm:col-span-2"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("charactersView.modules.createList")}
          </button>
        </form>
      </div>

      {/* Existing Custom Modules */}
      {modules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge-strong bg-elevated/30 p-6 text-center text-xs text-ink-secondary">
          {t("charactersView.modules.empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className="rounded-xl border border-edge bg-elevated/55 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-accent" />
                  <h5 className="font-display text-sm font-semibold text-ink">
                    {mod.name}
                  </h5>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-muted">
                    {mod.entries.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteModule(mod.id)}
                  title={t("projects.delete")}
                  className="rounded-md p-1 text-ink-muted hover:bg-surface hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Entries List */}
              <div className="mt-3 space-y-3">
                {mod.entries.map((entry) => {
                  const fieldInputKey = `${mod.id}:${entry.id}`;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-edge bg-surface p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={entry.title}
                          onChange={(e) =>
                            updateEntryTitle(mod.id, entry.id, e.target.value)
                          }
                          className="flex-1 rounded-md bg-transparent font-display text-sm font-semibold text-ink focus:bg-elevated focus:px-2 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => deleteEntry(mod.id, entry.id)}
                          className="rounded-md p-1 text-ink-muted hover:bg-elevated hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {entry.fields.map((field) => (
                          <div key={field.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium text-ink-muted">
                                {field.label}
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteFieldFromEntry(
                                    mod.id,
                                    entry.id,
                                    field.id
                                  )
                                }
                                className="text-[10px] text-ink-muted hover:text-red-400"
                              >
                                ×
                              </button>
                            </div>
                            <textarea
                              rows={2}
                              value={field.value}
                              onChange={(e) =>
                                updateFieldValue(
                                  mod.id,
                                  entry.id,
                                  field.id,
                                  e.target.value
                                )
                              }
                              className="w-full resize-none rounded-lg border border-edge bg-elevated px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Add Extra Field to This Entry */}
                      <div className="mt-2.5 flex items-center gap-2 border-t border-edge pt-2.5">
                        <input
                          type="text"
                          value={newFieldLabels[fieldInputKey] ?? ""}
                          onChange={(e) =>
                            setNewFieldLabels((prev) => ({
                              ...prev,
                              [fieldInputKey]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addFieldToEntry(mod.id, entry.id);
                            }
                          }}
                          placeholder={t(
                            "charactersView.modules.extraFieldPlaceholder"
                          )}
                          className="flex-1 rounded-lg border border-edge bg-elevated px-2.5 py-1 text-[11px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => addFieldToEntry(mod.id, entry.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-edge-strong bg-elevated px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:border-accent hover:text-accent"
                        >
                          <Plus className="h-3 w-3" />
                          {t("charactersView.modules.addField")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Entry Bar */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newEntryTitles[mod.id] ?? ""}
                  onChange={(e) =>
                    setNewEntryTitles((prev) => ({
                      ...prev,
                      [mod.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEntryToModule(mod);
                    }
                  }}
                  placeholder={t("charactersView.modules.newEntryPlaceholder", {
                    moduleName: mod.name,
                  })}
                  className="flex-1 rounded-lg border border-edge-strong bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addEntryToModule(mod)}
                  disabled={!(newEntryTitles[mod.id] ?? "").trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("charactersView.modules.addEntry")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
