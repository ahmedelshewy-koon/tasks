import type { Field, Task, Workspace } from "./api";
import type { Translate } from "./primitives";
import { dateToday, priorityLabels, statusLabels } from "./i18n";

export type Filters = Record<string, string>;
export type ViewConfig = {
  sort: { key: string; dir: "asc" | "desc" };
  group: string;
  columns: string[];
};
export const defaultColumns = [
  "status",
  "priority",
  "assignees",
  "due",
  "project",
];
export const defaultView: ViewConfig = {
  sort: { key: "", dir: "asc" },
  group: "",
  columns: defaultColumns,
};
export const baseColumns = [
  "status",
  "priority",
  "assignees",
  "due",
  "project",
  "section",
  "tags",
  "recurrence",
];
const columnNames: Record<string, string> = {
  status: "Status",
  priority: "Priority",
  assignees: "Assignees",
  due: "Due date",
  project: "Project",
  section: "Section",
  tags: "Tags",
  recurrence: "Repeats",
  title: "Title",
  created: "Created",
  assignee: "Assignee",
  tag: "Tag",
};
export function columnLabel(key: string, fields: Field[], t: Translate) {
  if (key.startsWith("field:"))
    return fields.find((f) => `field:${f.id}` === key)?.name ?? t("Field");
  return t(columnNames[key] ?? key);
}
const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
const statusRank = { todo: 0, in_progress: 1, done: 2 };
// Missing values always sort last, whichever direction is chosen.
export function sortTasks(tasks: Task[], sort: ViewConfig["sort"]) {
  if (!sort.key) return tasks;
  const value = (task: Task): string | number | null => {
    switch (sort.key) {
      case "due":
        return task.dueDate;
      case "priority":
        return priorityRank[task.priority];
      case "status":
        return statusRank[task.status];
      case "title":
        return task.title.toLocaleLowerCase();
      case "created":
        return new Date(task.createdAt).getTime();
      default: {
        const raw = sort.key.startsWith("field:")
          ? task.fieldValues[sort.key.slice(6)]
          : undefined;
        if (raw === undefined) return null;
        return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw.toLowerCase();
      }
    }
  };
  const dir = sort.dir === "desc" ? -1 : 1;
  return [...tasks].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null)
      return x === y ? 0 : x === null ? 1 : -1;
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}
export type TaskGroup = { key: string; label: string; tasks: Task[] };
export function groupTasks(
  tasks: Task[],
  group: string,
  data: Workspace,
  t: Translate,
): TaskGroup[] {
  if (!group) return [{ key: "", label: "", tasks }];
  const buckets = new Map<string, TaskGroup>();
  const add = (key: string, label: string, task: Task) => {
    const bucket = buckets.get(key) ?? { key, label, tasks: [] };
    bucket.tasks.push(task);
    buckets.set(key, bucket);
  };
  const today = dateToday();
  const order: string[] = [];
  for (const task of tasks) {
    if (group === "status")
      add(task.status, t(statusLabels[task.status]), task);
    else if (group === "priority")
      add(task.priority, t(priorityLabels[task.priority]), task);
    else if (group === "project") {
      const p = data.projects.find((x) => x.id === task.projectId);
      add(p?.id ?? "personal", p?.name ?? t("Personal"), task);
    } else if (group === "section") {
      const s = data.projects
        .flatMap((p) => p.sections)
        .find((x) => x.id === task.sectionId);
      add(s?.id ?? "none", s?.name ?? t("No section"), task);
    } else if (group === "assignee") {
      // Shared tasks appear under each person who owns a part.
      for (const id of task.assigneeIds)
        add(
          id,
          data.employees.find((e) => e.userId === id)?.name ?? id,
          task,
        );
      if (!task.assigneeIds.length) add("none", t("No assignees"), task);
    } else if (group === "tag") {
      for (const id of task.tagIds)
        add(id, data.tags.find((x) => x.id === id)?.name ?? id, task);
      if (!task.tagIds.length) add("none", t("No tags"), task);
    } else if (group === "due") {
      const key =
        task.status !== "done" && task.dueDate && task.dueDate < today
          ? "overdue"
          : !task.dueDate
            ? "none"
            : task.dueDate === today
              ? "today"
              : task.dueDate <= addDays(today, 7)
                ? "week"
                : "later";
      add(
        key,
        t(
          {
            overdue: "Overdue",
            today: "Today",
            week: "Next 7 days",
            later: "Later",
            none: "No due date",
          }[key]!,
        ),
        task,
      );
    }
  }
  if (group === "status") order.push("todo", "in_progress", "done");
  if (group === "priority") order.push("urgent", "high", "medium", "low");
  if (group === "due") order.push("overdue", "today", "week", "later", "none");
  const list = [...buckets.values()];
  return order.length
    ? list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    : list.sort(
        (a, b) =>
          Number(a.key === "none" || a.key === "personal") -
            Number(b.key === "none" || b.key === "personal") ||
          a.label.localeCompare(b.label),
      );
}
export function addDays(date: string, count: number) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + count);
  return next.toISOString().slice(0, 10);
}
