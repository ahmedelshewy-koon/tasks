"use client";
import { canAssignTo } from "../modules/tasks/policy";
import { reportIds } from "../modules/hr/hierarchy";
import { useState } from "react";
import type { FormEvent } from "react";
import { command, type Workspace, type Project, type Task } from "./api";
import { Modal, Field, ErrorBox, Avatar, type Translate } from "./primitives";
import { priorityLabels } from "./i18n";
import { recurrenceLabels } from "./task-views";
import { roleLabels } from "./activity-text";
import type { ProjectRole } from "@/modules/shared/types";
export function TaskForm({
  data,
  projectId,
  parent,
  page,
  t,
  onClose,
  onSaved,
}: {
  data: Workspace;
  projectId?: string;
  parent?: Task;
  page?: boolean;
  t: Translate;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [selectedProject, setProject] = useState(
    parent?.projectId || projectId || "",
  );
  const p = data.projects.find((p) => p.id === selectedProject);
  const personalOwner =
    parent && !parent.projectId ? parent.creatorId : data.actor.userId;
  const allowed = data.employees.filter((e) =>
    parent && !p
      ? e.userId === personalOwner
      : canAssignTo(data.actor, e.userId, p || null),
  );
  const [assigned, setAssigned] = useState<string[]>(
    allowed.some((e) => e.userId === personalOwner) ? [personalOwner] : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const task = await command<{ id: string }>("createTask", {
        title: form.get("title"),
        description: form.get("description"),
        projectId: selectedProject || null,
        parentId: parent?.id || null,
        priority: form.get("priority"),
        dueDate: form.get("dueDate") || null,
        recurrence: parent ? null : form.get("recurrence") || null,
        tags: String(form.get("tags") || "")
          .split(/[,،]/)
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean),
        assigneeIds: assigned.filter((id) =>
          allowed.some((e) => e.userId === id),
        ),
      });
      onSaved(task.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t(parent ? "Add subtask" : "New task")}
      page={page}
      t={t}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-body task-form">
        <Field label={t("Task title")}>
          <input
            name="title"
            placeholder={t("What needs to be done?")}
            required
            maxLength={250}
            autoFocus
          />
        </Field>
        <Field label={t("Description")}>
          <textarea
            name="description"
            rows={2}
            placeholder={t("Add a description…")}
          />
        </Field>
        <div className="form-grid task-form-grid">
          <Field label={t("Project")}>
            <select
              value={selectedProject}
              disabled={!!parent}
              onChange={(e) => {
                setProject(e.target.value);
                setAssigned(e.target.value ? [] : [data.actor.userId]);
              }}
            >
              <option value="">{t("No project")}</option>
              {data.projects
                .filter((p) => p.canContribute || p.id === parent?.projectId)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("Priority")}>
            <select name="priority" defaultValue="medium">
              {Object.entries(priorityLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Due date")}>
            <input type="date" name="dueDate" />
          </Field>
          {!parent && (
            <Field label={t("Repeats")}>
              <select name="recurrence" defaultValue="">
                <option value="">{t("Does not repeat")}</option>
                {Object.entries(recurrenceLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label={t("Tags")}>
          <input
            name="tags"
            list="task-form-tags"
            placeholder={t("Separate tags with commas")}
          />
          <datalist id="task-form-tags">
            {data.tags.map((tag) => (
              <option key={tag.id} value={tag.name} />
            ))}
          </datalist>
        </Field>
        <fieldset className="people-field">
          <legend>{t("Choose assignees")}</legend>
          <div className="assignee-chips">
            {allowed.map((e) => (
              <label
                className="assignee-chip"
                key={e.userId}
                title={`${e.jobTitle} · ${e.email}`}
              >
                <input
                  type="checkbox"
                  checked={assigned.includes(e.userId)}
                  onChange={(event) =>
                    setAssigned((ids) =>
                      event.target.checked
                        ? [...ids, e.userId]
                        : ids.filter((id) => id !== e.userId),
                    )
                  }
                />
                <Avatar small name={e.name} />
                <span>{e.name}</span>
              </label>
            ))}
          </div>
          {!allowed.length && (
            <p className="helper">
              {t("Your projects will appear here when a manager adds you.")}
            </p>
          )}
          <p className="helper">
            {t(
              p
                ? data.actor.isAdmin || p.canManage
                  ? "Project managers can assign any project member except viewers."
                  : "You can assign yourself or project members below you in the organization."
                : "Tasks without a project are visible to you, the assignees and admins.",
            )}
          </p>
        </fieldset>
        {error && <ErrorBox error={error} />}
        <div className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              !assigned.some((id) => allowed.some((e) => e.userId === id))
            }
          >
            {t(busy ? "Saving" : "Create task")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ProjectForm({
  data,
  project,
  page,
  t,
  onClose,
  onSaved,
}: {
  data: Workspace;
  project?: Project;
  page?: boolean;
  t: Translate;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [owner, setOwner] = useState(project?.ownerId || data.actor.userId);
  const [members, setMembers] = useState(project?.memberIds || []);
  const [roles, setRoles] = useState<Record<string, ProjectRole>>(
    project?.roles || {},
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = data.actor.isAdmin;
  // Owners appoint project managers; creators are the owner of what they create.
  const canAppoint = !project || project.canOwn;
  const pool = new Set([
    ...reportIds(data.actor),
    ...(project ? (data.memberPools[project.id] ?? []) : []),
  ]);
  const allowed = data.employees.filter(
    (e) =>
      e.userId !== owner &&
      (isAdmin || pool.has(e.userId) || project?.memberIds.includes(e.userId)),
  );
  const owners = isAdmin
    ? data.employees
    : project?.canOwn
      ? data.employees.filter(
          (e) =>
            e.userId === project.ownerId ||
            (project.memberIds.includes(e.userId) &&
              project.roles[e.userId] !== "viewer"),
        )
      : data.employees.filter((e) => e.userId === owner);
  const lockedRole = (id: string) =>
    !canAppoint && project?.roles[id] === "project_manager";
  return (
    <Modal
      title={t(project ? "Edit project" : "New project")}
      page={page}
      t={t}
      onClose={onClose}
    >
      <form
        className="form-body"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(event.currentTarget);
          const memberIds = members.filter((id) =>
            allowed.some((e) => e.userId === id),
          );
          const values = {
            name: form.get("name"),
            description: form.get("description"),
            ...(owner !== project?.ownerId ? { ownerId: owner } : {}),
            memberIds,
            roles: Object.fromEntries(
              memberIds.map((id) => [id, roles[id] ?? "member"]),
            ),
            startDate: form.get("startDate") || null,
            dueDate: form.get("dueDate") || null,
            status: form.get("status"),
          };
          try {
            const p = await command<{ id: string }>(
              project ? "updateProject" : "createProject",
              values,
              project?.id,
            );
            onSaved(p.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={t("Project name")}>
          <input
            name="name"
            required
            maxLength={150}
            defaultValue={project?.name}
            autoFocus
          />
        </Field>
        <Field label={t("Description")}>
          <textarea
            name="description"
            rows={3}
            defaultValue={project?.description}
          />
        </Field>
        <div className="form-grid">
          <Field label={t("Owner")}>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              disabled={owners.length < 2}
            >
              {owners.map((e) => (
                <option key={e.userId} value={e.userId}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Status")}>
            <select name="status" defaultValue={project?.status || "active"}>
              <option value="active">{t("Active")}</option>
              <option value="completed">{t("Completed")}</option>
            </select>
          </Field>
          <Field label={t("Start date")}>
            <input
              type="date"
              name="startDate"
              defaultValue={project?.startDate || ""}
            />
          </Field>
          <Field label={t("Due date")}>
            <input
              type="date"
              name="dueDate"
              defaultValue={project?.dueDate || ""}
            />
          </Field>
        </div>
        {project && owner !== project.ownerId && (
          <p className="helper">
            {t("The previous owner stays on the project as a project manager.")}
          </p>
        )}
        <fieldset className="people-field member-roles">
          <legend>{t("Members and roles")}</legend>
          <p className="helper">
            {t(
              isAdmin
                ? "Admins can add any employee."
                : project && !project.canOwn
                  ? "You can add employees from the owner’s team or your own reports."
                  : "You can add employees below you in the organization.",
            )}
          </p>
          {!allowed.length && (
            <p className="helper">{t("No employees available to add.")}</p>
          )}
          {allowed.map((e) => {
            const checked = members.includes(e.userId);
            return (
              <div className="member-role-row" key={e.userId}>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={lockedRole(e.userId)}
                    onChange={(event) =>
                      setMembers((ids) =>
                        event.target.checked
                          ? [...ids, e.userId]
                          : ids.filter((id) => id !== e.userId),
                      )
                    }
                  />
                  <span>{e.name}</span>
                  <small>
                    {e.jobTitle} · {e.email}
                  </small>
                </label>
                {checked && (
                  <select
                    aria-label={`${t("Role")}: ${e.name}`}
                    value={roles[e.userId] ?? "member"}
                    disabled={lockedRole(e.userId)}
                    onChange={(event) =>
                      setRoles((r) => ({
                        ...r,
                        [e.userId]: event.target.value as ProjectRole,
                      }))
                    }
                  >
                    {(canAppoint || lockedRole(e.userId)) && (
                      <option value="project_manager">
                        {t(roleLabels.project_manager)}
                      </option>
                    )}
                    <option value="member">{t(roleLabels.member)}</option>
                    <option value="viewer">{t(roleLabels.viewer)}</option>
                  </select>
                )}
              </div>
            );
          })}
        </fieldset>
        {error && <ErrorBox error={t(error)} />}
        <div className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="button primary" disabled={busy}>
            {t(busy ? "Saving" : project ? "Save changes" : "Create project")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
const confirmCopy = {
  delete: {
    description: "This action removes this item from the workspace.",
    button: "Delete",
  },
  archive: {
    description:
      "Archived items leave lists, boards, calendars and reports. Managers can restore them from Archive.",
    button: "Archive",
  },
  purge: {
    description:
      "This permanently deletes the item, its subtasks, comments, files and history. It cannot be undone.",
    button: "Delete permanently",
  },
};
export function Confirm({
  t,
  onClose,
  onConfirm,
  action = "delete",
}: {
  t: Translate;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  action?: keyof typeof confirmCopy;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = confirmCopy[action];
  return (
    <Modal
      t={t}
      title={t("Are you sure?")}
      description={t(copy.description)}
      onClose={onClose}
    >
      <div className="form-body">
        {error && <ErrorBox error={t(error)} />}
        <div className="form-footer">
          <button className="button secondary" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            className={`button ${action === "archive" ? "primary" : "danger"}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t(copy.button)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
