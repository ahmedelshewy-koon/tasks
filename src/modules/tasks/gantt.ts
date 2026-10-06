// Gantt layout for one project. Tasks have no start date of their own, so a
// bar runs from the day the task was created to its due date (Cairo days).
type GanttTask = {
  id: string;
  sectionId: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string | Date;
  blockedBy: string[];
};
type GanttSection = { id: string; name: string; position: number };
type GanttMilestone = { id: string; name: string; dueDate: string };

const DAY = 86_400_000;
export const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};
export const dayIso = (day: number) =>
  new Date(day * DAY).toISOString().slice(0, 10);
export const cairoDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
// 1970-01-01 was a Thursday; weeks start on Sunday like the calendar view.
const weekStart = (day: number) => day - ((day + 4) % 7);

export type GanttRow<T> =
  | { kind: "section"; id: string; name: string }
  | {
      kind: "task";
      task: T;
      start: number;
      end: number;
      undated: boolean;
      overdue: boolean;
    };

export function buildGantt<T extends GanttTask, M extends GanttMilestone>({
  sections,
  tasks,
  milestones,
  projectStart,
  projectDue,
  today,
}: {
  sections: GanttSection[];
  tasks: T[];
  milestones: M[];
  projectStart?: string | null;
  projectDue?: string | null;
  today: string;
}) {
  const now = dayNumber(today);
  const bars = tasks.map((task) => {
    const created = dayNumber(cairoDate(task.createdAt));
    const due = task.dueDate ? dayNumber(task.dueDate) : null;
    return {
      kind: "task" as const,
      task,
      start: due === null ? created : Math.min(created, due),
      end: due ?? created,
      undated: due === null,
      overdue: due !== null && due < now && task.status !== "done",
    };
  });
  bars.sort((a, b) => a.start - b.start || a.end - b.end);

  const ordered = [...sections].sort((a, b) => a.position - b.position);
  const known = new Set(ordered.map((s) => s.id));
  const rows: GanttRow<T>[] = [];
  if (!ordered.length) rows.push(...bars);
  else {
    for (const s of ordered) {
      const own = bars.filter((b) => b.task.sectionId === s.id);
      if (own.length)
        rows.push({ kind: "section", id: s.id, name: s.name }, ...own);
    }
    const rest = bars.filter(
      (b) => !b.task.sectionId || !known.has(b.task.sectionId),
    );
    if (rest.length)
      rows.push({ kind: "section", id: "none", name: "No section" }, ...rest);
  }

  const points = [
    now,
    ...bars.flatMap((b) => [b.start, b.end]),
    ...milestones.map((m) => dayNumber(m.dueDate)),
    ...[projectStart, projectDue].flatMap((d) => (d ? [dayNumber(d)] : [])),
  ];
  // Pad, then snap to whole weeks so week gridlines line up in LTR and RTL.
  const start = weekStart(Math.min(...points) - 3);
  const end = weekStart(Math.max(...points) + 7) + 6;
  const days = end - start + 1;

  const rowOf = new Map<string, number>();
  rows.forEach((r, i) => r.kind === "task" && rowOf.set(r.task.id, i));
  const links = rows.flatMap((r, to) => {
    if (r.kind !== "task") return [];
    return r.task.blockedBy.flatMap((id) => {
      const from = rowOf.get(id);
      if (from === undefined) return [];
      const blocker = rows[from] as Extract<GanttRow<T>, { kind: "task" }>;
      // A task scheduled to finish before its blocker does cannot hold.
      return [{ from, to, conflict: r.end < blocker.end }];
    });
  });

  return {
    start,
    days,
    today: now - start,
    rows,
    links,
    milestones: milestones
      .map((m) => ({ ...m, offset: dayNumber(m.dueDate) - start }))
      .sort((a, b) => a.offset - b.offset),
  };
}
