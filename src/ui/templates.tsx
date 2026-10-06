"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare2,
  Diamond,
  FolderPlus,
  LayoutTemplate,
  Link2,
  ListChecks,
  Rows3,
} from "lucide-react";
import { command, type Project, type Template, type Workspace } from "./api";
import {
  Avatar,
  Empty,
  ErrorBox,
  Field,
  Modal,
  PriorityBadge,
  type Translate,
} from "./primitives";
import type { Language } from "./i18n";
import { Confirm } from "./forms";

export function templateSummaryText(
  summary: Template["summary"],
  t: Translate,
) {
  return [
    `${summary.sections} ${t("sections")}`,
    `${summary.tasks} ${t("tasks")}`,
    `${summary.subtasks} ${t("subtasks")}`,
    `${summary.milestones} ${t("milestones")}`,
  ].join(" · ");
}

const offsetLabel = (offset: number | null, t: Translate) =>
  offset === null
    ? t("No due date")
    : offset === 0
      ? t("Start day")
      : `${t("Day")} ${offset + 1}`;

export function TemplatesPage({
  data,
  t,
  lang,
  onUse,
}: {
  data: Workspace;
  t: Translate;
  lang: Language;
  onUse: (templateId: string) => void;
}) {
  const [open, setOpen] = useState<string>();
  const [editing, setEditing] = useState<Template>();
  const [removing, setRemoving] = useState<Template>();
  const client = useQueryClient();
  const author = (id: string) =>
    data.employees.find((e) => e.userId === id)?.name || t("Former member");
  if (!data.templates.length)
    return (
      <div className="panel">
        <Empty
          title={t("No templates yet")}
          description={t(
            data.canCreateTemplates
              ? "Open a project you manage and choose “Save as template” to reuse its structure."
              : "Templates created by managers will appear here.",
          )}
        />
      </div>
    );
  return (
    <>
      <div className="template-grid">
        {data.templates.map((template) => {
          const expanded = open === template.id;
          return (
            <article className="panel template-card" key={template.id}>
              <div className="template-card-head">
                <span className="project-icon">
                  <LayoutTemplate size={20} />
                </span>
                <div>
                  <h3 dir="auto">{template.name}</h3>
                  <p className="muted small-text" dir="auto">
                    {template.description || t("No description")}
                  </p>
                </div>
              </div>
              <ul className="template-stats">
                <li>
                  <Rows3 size={14} />
                  {template.summary.sections} {t("sections")}
                </li>
                <li>
                  <CheckSquare2 size={14} />
                  {template.summary.tasks} {t("tasks")} ·{" "}
                  {template.summary.subtasks} {t("subtasks")}
                </li>
                <li>
                  <Diamond size={14} />
                  {template.summary.milestones} {t("milestones")}
                </li>
                <li>
                  <Link2 size={14} />
                  {template.summary.dependencies} {t("dependencies")}
                </li>
                <li>
                  <ListChecks size={14} />
                  {template.summary.checklistItems} {t("checklist items")}
                </li>
              </ul>
              <div className="template-meta">
                <Avatar small name={author(template.createdBy)} />
                <span>{author(template.createdBy)}</span>
                <span className="summary-separator" />
                <time>
                  {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
                    dateStyle: "medium",
                  }).format(new Date(template.updatedAt))}
                </time>
              </div>
              <div className="template-actions">
                <button
                  className="button primary small-button"
                  onClick={() => onUse(template.id)}
                >
                  <FolderPlus size={14} />
                  {t("Use template")}
                </button>
                <button
                  className="text-button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? undefined : template.id)}
                >
                  {t(expanded ? "Hide contents" : "View contents")}
                </button>
                {template.canEdit && (
                  <>
                    <button
                      className="text-button"
                      onClick={() => setEditing(template)}
                    >
                      {t("Rename")}
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() => setRemoving(template)}
                    >
                      {t("Delete")}
                    </button>
                  </>
                )}
              </div>
              {expanded && <TemplateContents template={template} data={data} t={t} />}
            </article>
          );
        })}
      </div>
      {editing && (
        <TemplateModal
          t={t}
          title={t("Rename template")}
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSubmit={async (values) => {
            await command("updateTemplate", values, editing.id);
            await client.invalidateQueries({ queryKey: ["workspace"] });
            setEditing(undefined);
          }}
        />
      )}
      {removing && (
        <Confirm
          t={t}
          onClose={() => setRemoving(undefined)}
          onConfirm={async () => {
            await command("deleteTemplate", undefined, removing.id);
            await client.invalidateQueries({ queryKey: ["workspace"] });
          }}
        />
      )}
    </>
  );
}

function TemplateContents({
  template,
  data,
  t,
}: {
  template: Template;
  data: Workspace;
  t: Translate;
}) {
  const { content } = template;
  const sections = [
    ...content.sections.map((name, index) => ({ name, index })),
    { name: t("No section"), index: null as number | null },
  ];
  const person = (id: string) =>
    data.employees.find((e) => e.userId === id)?.name;
  const titleOf = (key: string) =>
    content.tasks.find((x) => x.key === key)?.title ??
    content.tasks.flatMap((x) => x.subtasks).find((x) => x.key === key)?.title;
  return (
    <div className="template-contents">
      {content.milestones.length > 0 && (
        <div>
          <h4>{t("Milestones")}</h4>
          <ul>
            {content.milestones.map((m) => (
              <li key={m.key}>
                ◇ <span dir="auto">{m.name}</span>{" "}
                <span className="muted">· {offsetLabel(m.offset, t)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sections.map((section) => {
        const items = content.tasks.filter((x) => x.section === section.index);
        if (!items.length) return null;
        return (
          <div key={section.name + section.index}>
            <h4 dir="auto">{section.name}</h4>
            <ul>
              {items.map((item) => {
                const names = item.assigneeIds
                  .map(person)
                  .filter(Boolean)
                  .join("، ");
                const blockers = content.dependencies
                  .filter((d) => d.task === item.key)
                  .map((d) => titleOf(d.blocker))
                  .filter(Boolean);
                return (
                  <li key={item.key}>
                    <span className="template-task">
                      <span dir="auto">{item.title}</span>
                      <PriorityBadge priority={item.priority} t={t} />
                      <span className="muted small-text">
                        {offsetLabel(item.offset, t)}
                      </span>
                    </span>
                    {(item.checklist.length > 0 ||
                      item.subtasks.length > 0 ||
                      blockers.length > 0 ||
                      names) && (
                      <span className="muted small-text template-task-meta">
                        {item.subtasks.length > 0 &&
                          `${item.subtasks.length} ${t("subtasks")}`}
                        {item.checklist.length > 0 &&
                          ` · ${item.checklist.length} ${t("checklist items")}`}
                        {blockers.length > 0 &&
                          ` · ${t("Blocked by")}: ${blockers.join("، ")}`}
                        {names && ` · ${names}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function TemplateModal({
  t,
  title,
  initial,
  children,
  submitLabel = "Save",
  onClose,
  onSubmit,
}: {
  t: Translate;
  title: string;
  initial?: { name: string; description: string };
  children?: React.ReactNode;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    description: string;
    includeAssignees: boolean;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title={title} t={t} onClose={onClose}>
      <form
        className="form-body"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await onSubmit({
              name: String(form.get("name")),
              description: String(form.get("description") || ""),
              includeAssignees: form.get("includeAssignees") === "on",
            });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={t("Template name")}>
          <input
            name="name"
            required
            maxLength={150}
            autoFocus
            defaultValue={initial?.name}
          />
        </Field>
        <Field label={t("Description")}>
          <textarea
            name="description"
            rows={2}
            maxLength={2000}
            defaultValue={initial?.description}
          />
        </Field>
        {children}
        {error && <ErrorBox error={t(error)} />}
        <div className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="button primary" disabled={busy}>
            {t(busy ? "Saving" : submitLabel)}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SaveTemplateModal({
  project,
  t,
  onClose,
  onSaved,
}: {
  project: Project;
  t: Translate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const client = useQueryClient();
  return (
    <TemplateModal
      t={t}
      title={t("Save as template")}
      initial={{ name: project.name, description: project.description }}
      submitLabel="Save template"
      onClose={onClose}
      onSubmit={async (values) => {
        await command("saveTemplate", { ...values, projectId: project.id });
        await client.invalidateQueries({ queryKey: ["workspace"] });
        onSaved();
      }}
    >
      <p className="helper">
        {t(
          "Saves sections, tasks, subtasks, milestones, priorities, dependencies and checklists. Due dates are kept relative to the project start. Archived tasks, comments and files are not included.",
        )}
      </p>
      <label className="check-label">
        <input type="checkbox" name="includeAssignees" />
        <span>{t("Include assignees")}</span>
        <small>
          {t("Used only when those people are members of the new project.")}
        </small>
      </label>
    </TemplateModal>
  );
}
