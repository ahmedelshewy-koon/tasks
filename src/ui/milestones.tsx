"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { command, type Project, type Workspace } from "./api";
import { ErrorBox, Field, Modal, type Translate } from "./primitives";
import { formatDate } from "./task-views";
import type { Language } from "./i18n";
type Milestone = Workspace["milestones"][number];
export function Milestones({
  project,
  data,
  t,
  lang,
  onOpen,
  readOnly = false,
}: {
  project: Project;
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState<Milestone | "new" | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const client = useQueryClient();
  const items = data.milestones
    .filter((m) => m.projectId === project.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <section className="panel milestone-panel">
      <div className="section-heading">
        <h3>◇ {t("Milestones")}</h3>
        {project.canManage && !readOnly && (
          <button
            className="button secondary small-button"
            onClick={() => {
              setError("");
              setEditing("new");
            }}
          >
            {t("Add milestone")}
          </button>
        )}
      </div>
      {!items.length && <p className="helper">{t("No milestones yet")}</p>}
      {!project.canManage && !readOnly && (
        <p className="helper">
          {t(
            "Only project managers and admins can change dependencies and milestones.",
          )}
        </p>
      )}
      <div className="milestone-grid">
        {items.map((m) => (
          <article className="milestone-card" key={m.id}>
            <div className="feature-row">
              <strong>◇ {m.name}</strong>
              <span className="badge">
                {t(m.status === "completed" ? "Completed" : "Upcoming")}
              </span>
            </div>
            <p>{m.description}</p>
            <time>{formatDate(m.dueDate, t, lang)}</time>
            <div className="feature-stack">
              {data.tasks
                .filter((task) => task.milestoneId === m.id)
                .map((task) => (
                  <button
                    className="text-button"
                    key={task.id}
                    onClick={() => onOpen(task.id)}
                  >
                    {task.title} ·{" "}
                    {t(task.status === "done" ? "Done" : "Open tasks")}
                  </button>
                ))}
            </div>
            {!data.tasks.some((task) => task.milestoneId === m.id) && (
              <p className="helper">{t("No related tasks")}</p>
            )}
            {project.canManage && !readOnly && (
              <button
                className="text-button"
                onClick={() => {
                  setError("");
                  setEditing(m);
                }}
              >
                {t("Edit milestone")}
              </button>
            )}
          </article>
        ))}
      </div>
      {!readOnly &&
        data.projectActivity.filter((l) => l.projectId === project.id).length >
          0 && (
          <details>
            <summary>{t("Activity")}</summary>
            {data.projectActivity
              .filter((l) => l.projectId === project.id)
              .map((l) => (
                <p className="small-text" key={l.id}>
                  {data.employees.find((e) => e.userId === l.userId)?.name} ·{" "}
                  {t(l.action)} · {String(l.after ?? "")} ·{" "}
                  {new Date(l.createdAt).toLocaleString(
                    lang === "ar" ? "ar-EG" : "en-GB",
                  )}
                </p>
              ))}
          </details>
        )}
      {editing && (
        <Modal
          title={t(editing === "new" ? "Add milestone" : "Edit milestone")}
          t={t}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            className="feature-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                await command(
                  "saveMilestone",
                  {
                    id: editing === "new" ? undefined : editing.id,
                    name: form.get("name"),
                    description: form.get("description"),
                    dueDate: form.get("dueDate"),
                    status: form.get("status"),
                  },
                  project.id,
                );
                await client.invalidateQueries({ queryKey: ["workspace"] });
                setEditing(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {error && <ErrorBox error={error} />}
            <fieldset disabled={busy} className="feature-stack">
              <Field label={t("Name")}>
                <input
                  name="name"
                  required
                  maxLength={150}
                  defaultValue={editing === "new" ? "" : editing.name}
                />
              </Field>
              <Field label={t("Description")}>
                <textarea
                  name="description"
                  maxLength={10000}
                  defaultValue={editing === "new" ? "" : editing.description}
                />
              </Field>
              <Field label={t("Due date")}>
                <input
                  type="date"
                  name="dueDate"
                  required
                  defaultValue={editing === "new" ? "" : editing.dueDate}
                />
              </Field>
              <Field label={t("Status")}>
                <select
                  name="status"
                  defaultValue={editing === "new" ? "upcoming" : editing.status}
                >
                  <option value="upcoming">{t("Upcoming")}</option>
                  <option value="completed">{t("Completed")}</option>
                </select>
              </Field>
              <button className="button primary">
                {t(busy ? "Saving…" : "Save")}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </section>
  );
}
