"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  BookmarkPlus,
  Columns3,
  Trash2,
} from "lucide-react";
import { command, type Field, type SavedView, type Workspace } from "./api";
import { ErrorBox, type Translate } from "./primitives";
import {
  baseColumns,
  columnLabel,
  defaultView,
  type Filters,
  type ViewConfig,
} from "./view-config";
import { blankFilters } from "./task-views";

type Scope = "my-tasks" | "team" | "project";
const sortKeys = ["due", "priority", "status", "title", "created"];
const groupKeys = [
  "status",
  "priority",
  "assignee",
  "project",
  "section",
  "tag",
  "due",
];
const sameConfig = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const cleanFilters = (f: Filters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v));

export function SavedViewsBar({
  scope,
  projectId,
  data,
  t,
  fields,
  filters,
  onFilters,
  view,
  onView,
}: {
  scope: Scope;
  projectId?: string;
  data: Workspace;
  t: Translate;
  fields: Field[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  view: ViewConfig;
  onView: (v: ViewConfig) => void;
}) {
  const client = useQueryClient();
  const views = data.savedViews.filter(
    (v) =>
      v.scope === scope && (scope !== "project" || v.projectId === projectId),
  );
  const [activeId, setActiveId] = useState<string>();
  const [panel, setPanel] = useState<"" | "customize" | "save">("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = views.find((v) => v.id === activeId);
  const config = {
    filters: cleanFilters(filters),
    sort: view.sort,
    group: view.group,
    columns: view.columns,
  };
  const changed = !!active && !sameConfig(active.config, config);
  const apply = (saved?: SavedView) => {
    setActiveId(saved?.id);
    setPanel("");
    if (!saved) {
      onFilters(blankFilters);
      onView(defaultView);
      return;
    }
    const c = saved.config as typeof config;
    onFilters({ ...blankFilters, ...c.filters });
    onView({ sort: c.sort, group: c.group, columns: c.columns });
  };
  async function save(id?: string) {
    setBusy(true);
    setError("");
    try {
      const row = await command<SavedView>("saveView", {
        id,
        name: id ? active!.name : name,
        scope,
        projectId: scope === "project" ? projectId : null,
        config,
      });
      await client.invalidateQueries({ queryKey: ["workspace"] });
      setActiveId(row.id);
      setPanel("");
      setName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(saved: SavedView) {
    setBusy(true);
    setError("");
    try {
      await command("removeView", undefined, saved.id);
      await client.invalidateQueries({ queryKey: ["workspace"] });
      if (activeId === saved.id) apply(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const columns = [
    ...view.columns,
    ...[...baseColumns, ...fields.map((f) => `field:${f.id}`)].filter(
      (key) => !view.columns.includes(key),
    ),
  ].filter(
    (key) =>
      !key.startsWith("field:") || fields.some((f) => `field:${f.id}` === key),
  );
  const move = (key: string, delta: number) => {
    const list = [...view.columns];
    const i = list.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onView({ ...view, columns: list });
  };
  return (
    <div className="saved-views">
      <div className="saved-views-row">
        <span className="saved-views-label">
          <Bookmark size={14} />
          {t("Views")}
        </span>
        <div className="view-pills" role="group" aria-label={t("Saved views")}>
          <button
            className={`view-pill ${!active ? "active" : ""}`}
            aria-pressed={!active}
            onClick={() => apply(undefined)}
          >
            {t("Default")}
          </button>
          {views.map((v) => (
            <button
              key={v.id}
              className={`view-pill ${active?.id === v.id ? "active" : ""}`}
              aria-pressed={active?.id === v.id}
              onClick={() => apply(v)}
              dir="auto"
            >
              {v.name}
              {active?.id === v.id && changed && (
                <span className="view-dirty" aria-label={t("Unsaved changes")}>
                  •
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="saved-views-actions">
          <button
            className={`text-button ${panel === "customize" ? "is-active" : ""}`}
            aria-expanded={panel === "customize"}
            onClick={() => setPanel(panel === "customize" ? "" : "customize")}
          >
            <Columns3 size={14} />
            {t("Customize")}
          </button>
          {active && changed && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => save(active.id)}
            >
              {t("Update view")}
            </button>
          )}
          <button
            className="text-button"
            aria-expanded={panel === "save"}
            onClick={() => setPanel(panel === "save" ? "" : "save")}
          >
            <BookmarkPlus size={14} />
            {t("Save view")}
          </button>
          {active && (
            <button
              className="icon-button"
              aria-label={`${t("Delete view")}: ${active.name}`}
              disabled={busy}
              onClick={() => remove(active)}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {error && <ErrorBox error={t(error)} />}
      {panel === "save" && (
        <form
          className="saved-views-panel save-view-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="field">
            <span>{t("View name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              autoFocus
              placeholder={t("For example: Overdue, This week, Urgent")}
            />
          </label>
          <p className="helper">
            {t(
              "Saves the current filters, sorting, grouping and columns. Only you can see your views.",
            )}
          </p>
          <div className="form-footer">
            <button
              type="button"
              className="button secondary small-button"
              onClick={() => setPanel("")}
            >
              {t("Cancel")}
            </button>
            <button
              className="button primary small-button"
              disabled={busy || !name.trim()}
            >
              {t(busy ? "Saving" : "Save view")}
            </button>
          </div>
        </form>
      )}
      {panel === "customize" && (
        <div className="saved-views-panel customize-panel">
          <div className="customize-grid">
            <label className="field">
              <span>{t("Sort by")}</span>
              <select
                value={view.sort.key}
                onChange={(e) =>
                  onView({
                    ...view,
                    sort: { ...view.sort, key: e.target.value },
                  })
                }
              >
                <option value="">{t("Default order")}</option>
                {sortKeys.map((key) => (
                  <option key={key} value={key}>
                    {columnLabel(key, fields, t)}
                  </option>
                ))}
                {fields.map((f) => (
                  <option key={f.id} value={`field:${f.id}`}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Direction")}</span>
              <select
                value={view.sort.dir}
                disabled={!view.sort.key}
                onChange={(e) =>
                  onView({
                    ...view,
                    sort: {
                      ...view.sort,
                      dir: e.target.value as "asc" | "desc",
                    },
                  })
                }
              >
                <option value="asc">{t("Ascending")}</option>
                <option value="desc">{t("Descending")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("Group by")}</span>
              <select
                value={view.group}
                onChange={(e) => onView({ ...view, group: e.target.value })}
              >
                <option value="">{t("No grouping")}</option>
                {groupKeys
                  .filter(
                    (key) =>
                      (scope !== "project" || key !== "project") &&
                      (scope === "project" || key !== "section"),
                  )
                  .map((key) => (
                    <option key={key} value={key}>
                      {columnLabel(key === "due" ? "due" : key, fields, t)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <fieldset className="column-picker">
            <legend>{t("Columns")}</legend>
            {columns.map((key) => {
              const shown = view.columns.includes(key);
              const index = view.columns.indexOf(key);
              return (
                <div className="column-row" key={key}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={shown}
                      onChange={(e) =>
                        onView({
                          ...view,
                          columns: e.target.checked
                            ? [...view.columns, key]
                            : view.columns.filter((c) => c !== key),
                        })
                      }
                    />
                    <span>{columnLabel(key, fields, t)}</span>
                  </label>
                  {shown && (
                    <span className="button-group">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${t("Move up")}: ${columnLabel(key, fields, t)}`}
                        disabled={index === 0}
                        onClick={() => move(key, -1)}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${t("Move down")}: ${columnLabel(key, fields, t)}`}
                        disabled={index === view.columns.length - 1}
                        onClick={() => move(key, 1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </fieldset>
          <button
            className="text-button"
            onClick={() => onView(defaultView)}
          >
            {t("Reset layout")}
          </button>
        </div>
      )}
    </div>
  );
}
