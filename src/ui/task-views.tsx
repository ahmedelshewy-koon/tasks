"use client";
import { Fragment, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Repeat,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { Field, Task, Workspace } from "./api";
import {
  columnLabel,
  defaultColumns,
  groupTasks,
  sortTasks,
  type Filters,
  type ViewConfig,
} from "./view-config";
import {
  Avatar,
  Empty,
  PriorityBadge,
  StatusBadge,
  type Translate,
} from "./primitives";
import { dateToday, priorityLabels, statusLabels, type Language } from "./i18n";
export type { Filters };
export const blankFilters: Filters = {
  search: "",
  status: "",
  priority: "",
  assignee: "",
  due: "",
  project: "",
  tag: "",
};
export function filterTasks(tasks: Task[], f: Filters) {
  const today = dateToday();
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 7);
  const fieldFilters = Object.entries(f).filter(
    ([key, value]) => key.startsWith("field:") && value,
  );
  return tasks.filter(
    (t) =>
      t.title
        .toLocaleLowerCase()
        .includes((f.search || "").toLocaleLowerCase()) &&
      (!f.status || t.status === f.status) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.assignee || t.assigneeIds.includes(f.assignee)) &&
      (!f.tag || t.tagIds.includes(f.tag)) &&
      fieldFilters.every(
        ([key, value]) =>
          (value === "__empty"
            ? !t.fieldValues[key.slice(6)]
            : t.fieldValues[key.slice(6)] === value),
      ) &&
      (!f.project ||
        (f.project === "personal"
          ? !t.projectId
          : t.projectId === f.project)) &&
      (!f.due ||
        (f.due === "today"
          ? t.dueDate === today
          : f.due === "overdue"
            ? !!t.dueDate && t.dueDate < today && t.status !== "done"
            : f.due === "none"
              ? !t.dueDate
              : !!t.dueDate &&
                t.dueDate >= today &&
                t.dueDate <= next.toISOString().slice(0, 10))),
  );
}
export function FiltersBar({
  value,
  onChange,
  data,
  t,
  hideProject = false,
  fields = [],
  children,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  data: Workspace;
  t: Translate;
  hideProject?: boolean;
  fields?: Field[];
  children?: ReactNode;
}) {
  const set = (key: string, v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="filters">
      <div className="filters-top">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label={t("Search")}
            placeholder={t("Search tasks…")}
            value={value.search || ""}
            onChange={(e) => set("search", e.target.value)}
          />
        </label>
        {children}
      </div>
      <div className="filter-selects">
        <SlidersHorizontal size={15} className="filter-icon" />
        <select
          aria-label={t("Status")}
          value={value.status || ""}
          onChange={(e) => set("status", e.target.value)}
        >
          <option value="">{t("All statuses")}</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("Priority")}
          value={value.priority || ""}
          onChange={(e) => set("priority", e.target.value)}
        >
          <option value="">{t("All priorities")}</option>
          {Object.entries(priorityLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("Assignees")}
          value={value.assignee || ""}
          onChange={(e) => set("assignee", e.target.value)}
        >
          <option value="">{t("All assignees")}</option>
          {data.employees.map((e) => (
            <option key={e.userId} value={e.userId}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t("Due date")}
          value={value.due || ""}
          onChange={(e) => set("due", e.target.value)}
        >
          <option value="">{t("Any due date")}</option>
          <option value="today">{t("Today")}</option>
          <option value="week">{t("Next 7 days")}</option>
          <option value="overdue">{t("Overdue")}</option>
          <option value="none">{t("No due date")}</option>
        </select>
        {data.tags.length > 0 && (
          <select
            aria-label={t("Tag")}
            value={value.tag || ""}
            onChange={(e) => set("tag", e.target.value)}
          >
            <option value="">{t("All tags")}</option>
            {data.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                #{tag.name}
              </option>
            ))}
          </select>
        )}
        {fields
          .filter((field) => field.type === "select")
          .map((field) => (
            <select
              key={field.id}
              aria-label={field.name}
              value={value[`field:${field.id}`] || ""}
              onChange={(e) => set(`field:${field.id}`, e.target.value)}
            >
              <option value="">
                {field.name}: {t("Any")}
              </option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {field.name}: {option}
                </option>
              ))}
              <option value="__empty">
                {field.name}: {t("Not set")}
              </option>
            </select>
          ))}
        {!hideProject && (
          <select
            aria-label={t("Project")}
            value={value.project || ""}
            onChange={(e) => set("project", e.target.value)}
          >
            <option value="">{t("All projects")}</option>
            <option value="personal">{t("Personal")}</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {Object.values(value).some(Boolean) && (
          <button
            className="text-button"
            onClick={() => onChange(blankFilters)}
          >
            {t("Clear filters")}
          </button>
        )}
      </div>
    </div>
  );
}
export function TagChips({
  ids,
  data,
  limit = 4,
}: {
  ids: string[];
  data: Workspace;
  limit?: number;
}) {
  if (!ids.length) return null;
  const names = ids
    .map((id) => data.tags.find((tag) => tag.id === id)?.name)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
  return (
    <span className="tag-chips">
      {names.slice(0, limit).map((name) => (
        <span className="tag-chip" key={name} dir="auto">
          #{name}
        </span>
      ))}
      {names.length > limit && (
        <span className="tag-chip muted">+{names.length - limit}</span>
      )}
    </span>
  );
}
export function formatDate(value: string | null, t: Translate, lang: Language) {
  if (!value) return t("No due date");
  if (value === dateToday()) return t("Today");
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}
export function TaskList({
  tasks,
  data,
  t,
  lang,
  onOpen,
  onComplete,
  compact = false,
  detailed = false,
  view,
  fields = [],
}: {
  tasks: Task[];
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
  onComplete: (task: Task, done: boolean) => void;
  compact?: boolean;
  detailed?: boolean;
  view?: ViewConfig;
  fields?: Field[];
}) {
  const columns = compact
    ? ["status", "priority", "due"]
    : (view?.columns ?? defaultColumns).filter(
        (key) =>
          !key.startsWith("field:") ||
          fields.some((f) => `field:${f.id}` === key),
      );
  const groups = groupTasks(
    view ? sortTasks(tasks, view.sort) : tasks,
    view?.group ?? "",
    data,
    t,
  );
  const name = (id: string) =>
    data.employees.find((e) => e.userId === id)?.name || id;
  const cell = (task: Task, key: string) => {
    const overdue =
      !!task.dueDate && task.dueDate < dateToday() && task.status !== "done";
    const dueToday = task.dueDate === dateToday() && task.status !== "done";
    switch (key) {
      case "status":
        return (
          <>
            <StatusBadge status={task.status} t={t} />
            {task.blocked && (
              <span className="badge blocked-badge">{t("Blocked")}</span>
            )}
          </>
        );
      case "priority":
        return <PriorityBadge priority={task.priority} t={t} />;
      case "assignees":
        return (
          <div className={detailed ? "task-assignees" : "avatar-stack"}>
            {detailed && !task.assigneeIds.length && (
              <span>{t("No assignees")}</span>
            )}
            {task.assigneeIds.map((id) =>
              detailed ? (
                <span className="task-assignee" key={id}>
                  <Avatar small name={name(id)} />
                  <span>{name(id)}</span>
                </span>
              ) : (
                <Avatar key={id} small name={name(id)} />
              ),
            )}
          </div>
        );
      case "due":
        return (
          <>
            <span
              className={
                overdue
                  ? "overdue-text"
                  : detailed && dueToday
                    ? "due-today-text"
                    : "date-text"
              }
            >
              {formatDate(task.dueDate, t, lang)}
            </span>
            {detailed && overdue && (
              <span className="due-warning">{t("Overdue")}</span>
            )}
          </>
        );
      case "project":
        return (
          <span className="project-label">
            {data.projects.find((p) => p.id === task.projectId)?.name ||
              t("Personal")}
          </span>
        );
      case "section":
        return (
          <span className="project-label">
            {data.projects
              .flatMap((p) => p.sections)
              .find((x) => x.id === task.sectionId)?.name || "—"}
          </span>
        );
      case "tags":
        return task.tagIds.length ? (
          <TagChips ids={task.tagIds} data={data} limit={3} />
        ) : (
          <span className="muted">—</span>
        );
      case "recurrence":
        return task.recurrence ? (
          <span className="badge recurrence-badge">
            <Repeat size={11} />
            {t(recurrenceLabels[task.recurrence])}
          </span>
        ) : (
          <span className="muted">—</span>
        );
      default: {
        const field = fields.find((f) => `field:${f.id}` === key);
        const value = field ? task.fieldValues[field.id] : undefined;
        if (!field || !value) return <span className="muted">—</span>;
        return (
          <span className="field-value" dir="auto">
            {field.type === "date" ? formatDate(value, t, lang) : value}
          </span>
        );
      }
    }
  };
  return (
    <div className="table-wrap">
      <table className={`task-table${detailed ? " detailed-task-table" : ""}`}>
        <thead>
          <tr>
            <th className="task-col">{t("Task")}</th>
            {columns.map((key) => (
              <th key={key}>{columnLabel(key, fields, t)}</th>
            ))}
            <th className="sr-only">{t("Task details")}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key || "all"}>
              {group.label && (
                <tr className="group-row">
                  <th colSpan={columns.length + 2} scope="rowgroup">
                    <span dir="auto">{group.label}</span>
                    <span className="count">{group.tasks.length}</span>
                  </th>
                </tr>
              )}
              {group.tasks.map((task) => {
                const mine = task.assignments.find(
                  (a) => a.userId === data.actor.userId,
                );
                return (
                  <tr key={`${group.key}-${task.id}`}>
                    <td data-label={t("Task")}>
                      <div className="task-name">
                        <button
                          className={`task-check ${task.status === "done" ? "checked" : ""}`}
                          aria-label={`${t(mine?.completed ? "Not completed" : "Completed their part")}: ${task.title}`}
                          disabled={!mine || !task.canEdit}
                          onClick={() => onComplete(task, !mine?.completed)}
                        >
                          {task.status === "done" || mine?.completed ? (
                            <Check size={14} />
                          ) : (
                            <Circle size={16} />
                          )}
                        </button>
                        <div className="task-name-content">
                          <button
                            className={`task-title ${task.status === "done" ? "completed-title" : ""}`}
                            onClick={() => onOpen(task.id)}
                          >
                            {task.parentId && (
                              <span className="subtask-mark">↳ </span>
                            )}
                            {task.title}
                            {task.subtaskCount > 0 && (
                              <span className="subtask-count">
                                {task.subtaskCount}
                              </span>
                            )}
                            {task.recurrence &&
                              !columns.includes("recurrence") && (
                                <Repeat
                                  size={12}
                                  className="recurrence-icon"
                                  aria-label={t(
                                    recurrenceLabels[task.recurrence],
                                  )}
                                />
                              )}
                          </button>
                          {!compact && !columns.includes("tags") && (
                            <TagChips ids={task.tagIds} data={data} limit={3} />
                          )}
                          {detailed && task.description?.trim() && (
                            <p className="task-description">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    {columns.map((key) => (
                      <td key={key} data-label={columnLabel(key, fields, t)}>
                        {cell(task, key)}
                      </td>
                    ))}
                    <td>
                      <button
                        className="icon-button row-open"
                        aria-label={`${t("Task details")}: ${task.title}`}
                        onClick={() => onOpen(task.id)}
                      >
                        {detailed && <span>{t("Task details")}</span>}
                        <ArrowUpRight size={detailed ? 18 : 15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <Empty
          title={t("No matching tasks")}
          description={t("Try another search or clear your filters.")}
        />
      )}
    </div>
  );
}
export const recurrenceLabels = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
} as const;
export function TaskBoard({
  tasks,
  data,
  t,
  lang,
  onOpen,
}: {
  tasks: Task[];
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="board">
      {Object.entries(statusLabels).map(([status, label]) => {
        const items = tasks.filter((t) => t.status === status);
        return (
          <section className="board-column" key={status}>
            <div className="board-heading">
              <span className={`status-dot status-${status}`} />
              <h3>{t(label)}</h3>
              <span className="count">{items.length}</span>
            </div>
            {items.map((task) => (
              <button
                className="board-card"
                key={task.id}
                onClick={() => onOpen(task.id)}
              >
                <PriorityBadge priority={task.priority} t={t} />
                <h4>
                  {task.title}
                  {task.recurrence && (
                    <Repeat
                      size={12}
                      className="recurrence-icon"
                      aria-label={t(recurrenceLabels[task.recurrence])}
                    />
                  )}
                </h4>
                {task.blocked && (
                  <span className="badge blocked-badge">{t("Blocked")}</span>
                )}
                <TagChips ids={task.tagIds} data={data} limit={3} />
                {task.description && <p>{task.description}</p>}
                {task.subtaskCount > 0 && (
                  <div className="mini-progress">
                    <span style={{ width: `${task.progress}%` }} />
                  </div>
                )}
                <div className="board-card-footer">
                  <span>
                    <CalendarDays size={12} />
                    {formatDate(task.dueDate, t, lang)}
                  </span>
                  <div className="avatar-stack">
                    {task.assigneeIds.slice(0, 3).map((id) => (
                      <Avatar
                        key={id}
                        small
                        name={
                          data.employees.find((e) => e.userId === id)?.name ||
                          id
                        }
                      />
                    ))}
                  </div>
                </div>
              </button>
            ))}
            {!items.length && (
              <div className="board-empty">{t("No tasks yet")}</div>
            )}
          </section>
        );
      })}
    </div>
  );
}
export function TaskCalendar({
  milestones = [],
  onProject,
  tasks,
  t,
  lang,
  onOpen,
}: {
  tasks: Task[];
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
  milestones?: Workspace["milestones"];
  onProject?: (id: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date(`${dateToday()}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const start = new Date(month);
  start.setDate(1 - start.getDay());
  const dates = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <div className="calendar panel">
      <div className="calendar-header">
        <h3>
          {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en", {
            month: "long",
            year: "numeric",
          }).format(month)}
        </h3>
        <div className="button-group">
          <button
            className="button secondary small-button"
            onClick={() => {
              const d = new Date(`${dateToday()}T12:00:00`);
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            {t("Today")}
          </button>
          <button
            className="icon-button"
            aria-label={t("Previous month")}
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={t("Next month")}
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-week">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{t(d)}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {dates.map((d) => (
            <div
              key={key(d)}
              className={`calendar-day ${d.getMonth() !== month.getMonth() ? "outside" : ""}`}
            >
              <span className={key(d) === dateToday() ? "today-circle" : ""}>
                {new Intl.NumberFormat(lang === "ar" ? "ar" : "en").format(
                  d.getDate(),
                )}
              </span>
              {milestones
                .filter((m) => m.dueDate === key(d))
                .map((m) => (
                  <button
                    key={m.id}
                    className="calendar-task milestone-calendar"
                    title={m.name}
                    onClick={() => onProject?.(m.projectId)}
                  >
                    ◇ {m.name} ·{" "}
                    {t(m.status === "completed" ? "Completed" : "Upcoming")}
                  </button>
                ))}
              {tasks
                .filter((t) => t.dueDate === key(d))
                .map((task) => (
                  <button
                    key={task.id}
                    className={`calendar-task status-${task.status}`}
                    onClick={() => onOpen(task.id)}
                    title={task.title}
                  >
                    {task.title}
                    {task.blocked && ` · ${t("Blocked")}`}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
      {tasks.some((t) => !t.dueDate) && (
        <p className="calendar-note">
          {t("No due date")}: {tasks.filter((t) => !t.dueDate).length}
        </p>
      )}
    </div>
  );
}
