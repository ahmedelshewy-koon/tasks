"use client";
import { TaskFeatures } from "./task-features";
import {
  CommentBody,
  FieldValues,
  MentionTextarea,
  TagEditor,
} from "./task-extras";
import { recurrenceLabels } from "./task-views";
import { canAssignTo, canReassignTask } from "../modules/tasks/policy";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronRight,
  Download,
  MessageSquare,
  Paperclip,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import {
  command,
  request,
  type Workspace,
  type TaskDetail,
  type Task,
} from "./api";
import {
  Avatar,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PriorityBadge,
  StatusBadge,
  type Translate,
} from "./primitives";
import { priorityLabels, statusLabels, type Language } from "./i18n";
import { Confirm, TaskForm } from "./forms";
import { activityText } from "./activity-text";
export function TaskDrawer({
  id,
  data,
  t,
  lang,
  onClose,
  onOpen,
  page,
}: {
  page?: boolean;
  id: string;
  data: Workspace;
  t: Translate;
  lang: Language;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["task", id],
    queryFn: () => request<TaskDetail>(`/api/work?task=${id}`),
  });
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [archiving, setArchiving] = useState<"archive" | "purge" | null>(null);
  const [subtask, setSubtask] = useState(false);
  const detail = query.data;
  const task = detail?.task;
  const project = data.projects.find((p) => p.id === task?.projectId);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["workspace"] }),
      client.invalidateQueries({ queryKey: ["task"] }),
    ]);
  };
  async function mutate(action: string, values?: unknown, target = id) {
    setBusy(true);
    setError("");
    try {
      await command(action, values, target);
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const person = (userId: string) =>
    data.employees.find((e) => e.userId === userId)?.name || userId;
  const timestamp = (value: Date) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <>
      <Modal
        title={t("Task details")}
        t={t}
        onClose={onClose}
        drawer
        page={page}
      >
        <div className={page ? "detail-body" : "drawer-scroll"}>
          {query.isPending ? (
            <Loading t={t} />
          ) : query.error ? (
            <ErrorBox error={query.error.message} />
          ) : (
            task &&
            detail && (
              <>
                <div className="detail-head">
                  <div className="task-context">
                    {project?.name || t("Personal")}
                    <ChevronRight size={13} />
                    {t(task.parentId ? "Subtasks" : "Task")}
                  </div>
                  <div className="drawer-title">
                    <h2>{task.title}</h2>
                    {!task.canEdit && (
                      <span className="badge">{t("Read only")}</span>
                    )}
                  </div>
                  {task.archived && (
                    <div className="archived-banner" role="status">
                      <Archive size={16} />
                      <span>
                        {t(
                          task.archivedAt
                            ? "This task is archived. It is hidden from lists, boards and reports."
                            : "This task is archived with its parent task or project.",
                        )}
                      </span>
                      {task.archivedAt && task.canArchive && (
                        <button
                          className="button secondary small-button"
                          disabled={busy}
                          onClick={async () => {
                            if (await mutate("restoreTask")) onClose();
                          }}
                        >
                          <ArchiveRestore size={14} />
                          {t("Restore")}
                        </button>
                      )}
                      {task.archivedAt && data.actor.isAdmin && (
                        <button
                          className="text-button danger-text"
                          disabled={busy}
                          onClick={() => setArchiving("purge")}
                        >
                          {t("Delete permanently")}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="drawer-badges">
                    <StatusBadge status={task.status} t={t} />
                    <PriorityBadge priority={task.priority} t={t} />
                    {task.recurrence && (
                      <span className="badge recurrence-badge">
                        <Repeat size={11} />
                        {t(recurrenceLabels[task.recurrence])}
                      </span>
                    )}
                    {task.subtaskCount > 0 && (
                      <span className="muted small-text">
                        {task.progress}% {t("Progress")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="detail-tabs-card">
                  <div className="tabs drawer-tabs">
                    <button
                      className={tab === "overview" ? "active" : ""}
                      onClick={() => setTab("overview")}
                    >
                      {t("Overview")}
                    </button>
                    <button
                      className={tab === "activity" ? "active" : ""}
                      onClick={() => setTab("activity")}
                    >
                      {t("Activity")}
                      <span>{detail.activity.length}</span>
                    </button>
                  </div>
                </div>
                {error && <ErrorBox error={t(error)} />}
                {tab === "overview" ? (
                  <div className="detail-grid">
                    <div className="detail-col">
                      <form
                        key={`${task.id}-${task.updatedAt}`}
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          await mutate("updateTask", {
                            title: form.get("title"),
                            description: form.get("description"),
                            priority: form.get("priority"),
                            status: form.get("status"),
                            dueDate: form.get("dueDate") || null,
                            sectionId: form.get("section") || null,
                            ...(!task.parentId
                              ? { recurrence: form.get("recurrence") || null }
                              : {}),
                            ...(task.projectId &&
                            canReassignTask(data.actor, task, project || null)
                              ? { assigneeIds: form.getAll("assigned") }
                              : {}),
                          });
                        }}
                      >
                        <fieldset
                          className="detail-fields"
                          disabled={!task.canEdit || busy}
                        >
                          <Field label={t("Title")}>
                            <input
                              name="title"
                              defaultValue={task.title}
                              required
                              maxLength={250}
                            />
                          </Field>
                          <div className="form-grid">
                            <Field label={t("Status")}>
                              <select name="status" defaultValue={task.status}>
                                {Object.entries(statusLabels).map(
                                  ([key, label]) => (
                                    <option
                                      key={key}
                                      value={key}
                                      disabled={
                                        key === "done" &&
                                        task.status !== "done" &&
                                        !task.assigneeIds.includes(
                                          data.actor.userId,
                                        )
                                      }
                                    >
                                      {t(label)}
                                    </option>
                                  ),
                                )}
                              </select>
                            </Field>
                            <Field label={t("Priority")}>
                              <select
                                name="priority"
                                defaultValue={task.priority}
                              >
                                {Object.entries(priorityLabels).map(
                                  ([key, label]) => (
                                    <option key={key} value={key}>
                                      {t(label)}
                                    </option>
                                  ),
                                )}
                              </select>
                            </Field>
                            <Field label={t("Due date")}>
                              <input
                                type="date"
                                name="dueDate"
                                defaultValue={task.dueDate || ""}
                              />
                            </Field>
                            {!task.parentId && (
                              <Field label={t("Repeats")}>
                                <select
                                  name="recurrence"
                                  defaultValue={task.recurrence || ""}
                                >
                                  <option value="">
                                    {t("Does not repeat")}
                                  </option>
                                  {Object.entries(recurrenceLabels).map(
                                    ([key, label]) => (
                                      <option key={key} value={key}>
                                        {t(label)}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </Field>
                            )}
                            <Field label={t("Section")}>
                              <select
                                name="section"
                                defaultValue={task.sectionId || ""}
                              >
                                <option value="">{t("No section")}</option>
                                {project?.sections.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <Field label={t("Description")}>
                            <textarea
                              name="description"
                              rows={3}
                              defaultValue={task.description}
                              placeholder={t("Add a description…")}
                            />
                          </Field>
                          {task.recurrence && (
                            <p className="helper">
                              {t(
                                "When this task is done, the next one is created with the same details and a new due date.",
                              )}
                            </p>
                          )}
                          {canReassignTask(
                            data.actor,
                            task,
                            project || null,
                          ) && (
                            <fieldset className="people-field">
                              <legend>{t("Assignees")}</legend>
                              {data.employees
                                .filter((e) =>
                                  canAssignTo(
                                    data.actor,
                                    e.userId,
                                    project || null,
                                  ),
                                )
                                .map((e) => (
                                  <label className="check-label" key={e.userId}>
                                    <input
                                      type="checkbox"
                                      name="assigned"
                                      value={e.userId}
                                      defaultChecked={task.assigneeIds.includes(
                                        e.userId,
                                      )}
                                    />
                                    <span>{e.name}</span>
                                  </label>
                                ))}
                            </fieldset>
                          )}
                          {task.canEdit && (
                            <button
                              className="button secondary small-button"
                              disabled={busy}
                            >
                              {t(busy ? "Saving" : "Save changes")}
                            </button>
                          )}
                        </fieldset>
                      </form>
                      <TagEditor
                        task={task}
                        data={data}
                        t={t}
                        busy={busy}
                        mutate={mutate}
                      />
                      {project && (
                        <FieldValues
                          task={task}
                          fields={project.fields}
                          t={t}
                          busy={busy}
                          mutate={mutate}
                        />
                      )}
                      <TaskFeatures
                        key={task.id}
                        task={task}
                        data={data}
                        t={t}
                        busy={busy}
                        mutate={mutate}
                        onOpen={onOpen}
                      />
                    </div>
                    <div className="detail-col">
                      <section className="detail-section">
                        <div className="section-heading">
                          <h3>{t("Individual completion")}</h3>
                          <span className="small-text muted">
                            {task.assignments.filter((a) => a.completed).length}
                            /{task.assignments.length}
                          </span>
                        </div>
                        <p className="helper">
                          {t("Everyone completes their own part.")}
                        </p>
                        {task.assignments.map((a) => (
                          <div className="assignee-row" key={a.userId}>
                            <Avatar name={person(a.userId)} small />
                            <span>{person(a.userId)}</span>
                            <label className="completion-control">
                              <span>
                                {t(
                                  a.completed
                                    ? "Completed their part"
                                    : "Not completed",
                                )}
                              </span>
                              <input
                                type="checkbox"
                                checked={a.completed}
                                aria-label={`${t("Completed their part")}: ${person(a.userId)}`}
                                disabled={
                                  busy ||
                                  !task.canEdit ||
                                  (!data.actor.isAdmin &&
                                    a.userId !== data.actor.userId)
                                }
                                onChange={(e) =>
                                  mutate("completePart", {
                                    userId: a.userId,
                                    completed: e.target.checked,
                                  })
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </section>
                      {!task.parentId && (
                        <section className="detail-section">
                          <div className="section-heading">
                            <h3>
                              {t("Subtasks")}{" "}
                              <span className="count">
                                {detail.subtasks.length}
                              </span>
                            </h3>
                            {task.canEdit && (
                              <button
                                className="text-button"
                                onClick={() => setSubtask(true)}
                              >
                                <Plus size={14} />
                                {t("Add subtask")}
                              </button>
                            )}
                          </div>
                          {!detail.subtasks.length && (
                            <p className="helper">{t("No subtasks yet")}</p>
                          )}
                          {detail.subtasks.map((child) => (
                            <button
                              className="subtask-row"
                              key={child.id}
                              onClick={() => onOpen(child.id)}
                            >
                              <span
                                className={`task-check ${child.status === "done" ? "checked" : ""}`}
                              >
                                {child.status === "done" && <Check size={12} />}
                              </span>
                              <span>{child.title}</span>
                              <StatusBadge status={child.status} t={t} />
                              <ChevronRight size={14} />
                            </button>
                          ))}
                        </section>
                      )}
                      <section className="detail-section">
                        <div className="section-heading">
                          <h3>{t("Attachments")}</h3>
                          {task.canEdit && (
                            <label
                              className={`text-button upload-button ${busy ? "disabled" : ""}`}
                            >
                              <Paperclip size={14} />
                              {t("Add file")}
                              <input
                                type="file"
                                aria-label={t("Add file")}
                                disabled={busy}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setBusy(true);
                                  setError("");
                                  try {
                                    const form = new FormData();
                                    form.append("taskId", id);
                                    form.append("file", file);
                                    await request("/api/attachments", {
                                      method: "POST",
                                      body: form,
                                    });
                                    await refresh();
                                  } catch (error) {
                                    setError((error as Error).message);
                                  } finally {
                                    setBusy(false);
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                        <p className="helper">{t("Up to 10 MB per file")}</p>
                        {!detail.attachments.length && (
                          <p className="helper">{t("No attachments")}</p>
                        )}
                        {detail.attachments.map((file) => (
                          <div className="file-row" key={file.id}>
                            <Paperclip size={16} />
                            <a href={`/api/attachments?id=${file.id}`} download>
                              {file.name}
                            </a>
                            <small>
                              {Math.max(1, Math.round(file.size / 1024))} KB
                            </small>
                            <a
                              className="icon-button"
                              href={`/api/attachments?id=${file.id}`}
                              aria-label={file.name}
                            >
                              <Download size={14} />
                            </a>
                            {task.canEdit && (
                              <button
                                className="icon-button"
                                aria-label={t("Delete attachment")}
                                disabled={busy}
                                onClick={() =>
                                  mutate("deleteAttachment", undefined, file.id)
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </section>
                      <section className="detail-section">
                        <div className="section-heading">
                          <h3>
                            <MessageSquare size={15} />
                            {t("Comments")}
                            <span className="count">
                              {detail.comments.length}
                            </span>
                          </h3>
                        </div>
                        {!detail.comments.length && (
                          <p className="helper">
                            {t("No comments yet. Start the conversation.")}
                          </p>
                        )}
                        {detail.comments.map((c) => (
                          <div className="comment" key={c.id}>
                            <Avatar small name={person(c.userId)} />
                            <div>
                              <div className="comment-header">
                                <strong>{person(c.userId)}</strong>
                                <time>{timestamp(c.createdAt)}</time>
                              </div>
                              <CommentBody body={c.body} data={data} />
                            </div>
                          </div>
                        ))}
                        {task.canComment ? (
                          <MentionTextarea
                            people={detail.mentionable
                              .filter((userId) => userId !== data.actor.userId)
                              .map((userId) => ({
                                userId,
                                name: person(userId),
                              }))}
                            t={t}
                            disabled={busy}
                            onSubmit={(body) => mutate("addComment", { body })}
                          />
                        ) : (
                          <p className="helper">
                            {t(
                              task.archived
                                ? "Restore this task to continue the conversation."
                                : "Viewers can read comments but cannot post.",
                            )}
                          </p>
                        )}
                      </section>
                    </div>
                    {task.canArchive && !task.archived && (
                      <button
                        className="text-button danger-text delete-task"
                        onClick={() => setArchiving("archive")}
                      >
                        <Archive size={14} />
                        {t("Archive task")}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="activity-list detail-section">
                    {detail.activity.map((event) => (
                      <div className="activity-row" key={event.id}>
                        <span className="activity-dot" />
                        <div>
                          <strong>{person(event.userId)}</strong>
                          <p>{t(event.action)}</p>
                          {activityText(event, data, t, lang) && (
                            <small className="activity-values">
                              {activityText(event, data, t, lang)}
                            </small>
                          )}
                          <time>{timestamp(event.createdAt)}</time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </div>
      </Modal>
      {archiving && (
        <Confirm
          t={t}
          action={archiving}
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            await command(
              archiving === "purge" ? "purgeTask" : "archiveTask",
              undefined,
              id,
            );
            await refresh();
            onClose();
          }}
        />
      )}
      {subtask && task && (
        <TaskForm
          data={data}
          parent={task as Task}
          t={t}
          onClose={() => setSubtask(false)}
          onSaved={async () => {
            setSubtask(false);
            await refresh();
          }}
        />
      )}
    </>
  );
}
