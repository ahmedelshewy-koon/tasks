"use client";
import { useState } from "react";
import type { Task, Workspace } from "./api";
import type { Translate } from "./primitives";

export function TaskFeatures({
  task,
  data,
  t,
  busy,
  mutate,
  onOpen,
}: {
  task: Task;
  data: Workspace;
  t: Translate;
  busy: boolean;
  mutate: (
    action: string,
    values?: unknown,
    target?: string,
  ) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const project = data.projects.find((p) => p.id === task.projectId);
  const manage = data.actor.isAdmin || !!project?.canManage;
  const relation = (ids: string[], removable: boolean) =>
    ids.map((id) => {
      const related = data.tasks.find((t) => t.id === id);
      return (
        <div className="feature-row" key={id}>
          <button className="text-button" onClick={() => onOpen(id)}>
            {related?.title}
          </button>
          <span>{t(related?.status === "done" ? "Done" : "Open tasks")}</span>
          {removable && manage && (
            <button
              disabled={busy}
              className="text-button"
              onClick={() =>
                mutate("setDependency", { blockerId: id, enabled: false })
              }
            >
              {t("Remove")}
            </button>
          )}
        </div>
      );
    });
  return (
    <>
      <section className="detail-section feature-stack" aria-busy={busy}>
        <h3>
          {t("Dependencies")}{" "}
          {task.blocked && (
            <span className="badge blocked-badge">{t("Blocked")}</span>
          )}
        </h3>
        <h4>{t("Blocked by")}</h4>
        {task.blockedBy.length ? (
          relation(task.blockedBy, true)
        ) : (
          <p className="helper">{t("No dependencies")}</p>
        )}
        {manage && project && (
          <select
            aria-label={t("Add dependency")}
            disabled={busy}
            value=""
            onChange={(e) => {
              if (e.target.value)
                void mutate("setDependency", {
                  blockerId: e.target.value,
                  enabled: true,
                });
            }}
          >
            <option value="">{t("Add dependency")}</option>
            {data.tasks
              .filter(
                (other) =>
                  other.projectId === task.projectId &&
                  other.id !== task.id &&
                  !task.blockedBy.includes(other.id),
              )
              .map((other) => (
                <option key={other.id} value={other.id}>
                  {other.title}
                </option>
              ))}
          </select>
        )}
        <h4>{t("Blocks")}</h4>
        {task.blocks.length ? (
          relation(task.blocks, false)
        ) : (
          <p className="helper">{t("No dependencies")}</p>
        )}
        {!manage && (
          <p className="helper">
            {t(
              "Only project managers and admins can change dependencies and milestones.",
            )}
          </p>
        )}
        {project && (
          <label>
            {t("Milestone")}
            <select
              aria-label={t("Milestone")}
              disabled={busy || !manage}
              value={task.milestoneId || ""}
              onChange={(e) =>
                mutate("linkMilestone", { milestoneId: e.target.value || null })
              }
            >
              <option value="">{t("No milestone")}</option>
              {data.milestones
                .filter((m) => m.projectId === task.projectId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </section>
      <section className="detail-section feature-stack" aria-busy={busy}>
        <h3>
          {t("Checklist")}{" "}
          <span className="muted small-text">
            {task.checklist.filter((i) => i.completed).length} /{" "}
            {task.checklist.length} {t("completed")}
          </span>
        </h3>
        <p className="helper">
          {t("Use subtasks for ownership, due dates, or task tracking.")}
        </p>
        {!task.checklist.length && (
          <p className="helper">{t("No checklist items")}</p>
        )}
        {task.checklist.map((item, index) => (
          <div className="feature-row checklist-row" key={item.id}>
            <input
              type="checkbox"
              aria-label={item.title}
              checked={item.completed}
              disabled={busy || !task.canEdit}
              onChange={(e) =>
                mutate("changeChecklist", {
                  operation: "update",
                  itemId: item.id,
                  completed: e.target.checked,
                })
              }
            />
            <input
              className={item.completed ? "checklist-done" : ""}
              aria-label={t("Checklist item title")}
              defaultValue={item.title}
              key={item.title}
              maxLength={250}
              disabled={busy || !task.canEdit}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== item.title)
                  void mutate("changeChecklist", {
                    operation: "update",
                    itemId: item.id,
                    title: e.target.value,
                  });
                else e.target.value = item.title;
              }}
            />
            {task.canEdit && (
              <>
                {[-1, 1].map((delta) => (
                  <button
                    className="icon-button"
                    key={delta}
                    aria-label={t(delta === -1 ? "Move up" : "Move down")}
                    disabled={
                      busy ||
                      index + delta < 0 ||
                      index + delta >= task.checklist.length
                    }
                    onClick={() => {
                      const ids = task.checklist.map((i) => i.id);
                      [ids[index], ids[index + delta]] = [
                        ids[index + delta],
                        ids[index],
                      ];
                      void mutate("changeChecklist", {
                        operation: "reorder",
                        ids,
                      });
                    }}
                  >
                    {delta === -1 ? "↑" : "↓"}
                  </button>
                ))}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    mutate("changeChecklist", {
                      operation: "remove",
                      itemId: item.id,
                    })
                  }
                >
                  {t("Remove")}
                </button>
              </>
            )}
          </div>
        ))}
        {task.canEdit ? (
          <form
            className="feature-row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await mutate("changeChecklist", { operation: "add", title }))
                setTitle("");
            }}
          >
            <input
              required
              maxLength={250}
              aria-label={t("New checklist item")}
              placeholder={t("New checklist item")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
            <button
              className="button secondary"
              disabled={busy || !title.trim()}
            >
              {t("Add")}
            </button>
          </form>
        ) : (
          <p className="helper">{t("Read only")}</p>
        )}
      </section>
      <section className="detail-section feature-stack" aria-busy={busy}>
        <h3>{t("Due date reminder")}</h3>
        <select
          aria-label={t("Due date reminder")}
          disabled={busy || !task.canEdit}
          value={task.reminderMinutes}
          onChange={(e) =>
            mutate("changeReminder", { minutes: Number(e.target.value) })
          }
        >
          <option value={60}>{t("1 hour before")}</option>
          <option value={1440}>{t("1 day before")}</option>
          <option value={4320}>{t("3 days before")}</option>
        </select>
        <p className="helper">
          {t(
            task.dueDate
              ? "Reminders use the end of the due date in Cairo time."
              : "Set a due date to receive reminders.",
          )}
        </p>
      </section>
    </>
  );
}
