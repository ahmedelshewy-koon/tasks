"use client";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Folder,
  Search,
  Tag,
  Users,
} from "lucide-react";
import type { Task, Workspace } from "./api";
import { Avatar, Empty, type Translate } from "./primitives";
import { dateToday, type Language } from "./i18n";
import { addDays } from "./view-config";

export type Load = {
  userId: string;
  name: string;
  open: number;
  inProgress: number;
  overdue: number;
  dueSoon: number;
  completed: number;
  level: "overloaded" | "busy" | "normal" | "light";
};
const levels: Load["level"][] = ["overloaded", "busy", "normal", "light"];
const levelLabel: Record<Load["level"], string> = {
  overloaded: "Overloaded",
  busy: "High load",
  normal: "Balanced",
  light: "Light",
};
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
// Task counts only: each person is measured by their own part of shared work.
export function computeWorkload(
  tasks: Task[],
  people: { userId: string; name: string }[],
): Load[] {
  const today = dateToday();
  const soon = addDays(today, 3);
  const rows = people.map((person) => {
    const mine = tasks.filter((t) => t.assigneeIds.includes(person.userId));
    const done = (t: Task) =>
      t.status === "done" ||
      !!t.assignments.find((a) => a.userId === person.userId)?.completed;
    const open = mine.filter((t) => !done(t));
    return {
      ...person,
      open: open.length,
      inProgress: open.filter((t) => t.status === "in_progress").length,
      overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
      dueSoon: open.filter(
        (t) => t.dueDate && t.dueDate >= today && t.dueDate <= soon,
      ).length,
      completed: mine.length - open.length,
    };
  });
  const typical = median(rows.map((r) => r.open).filter((n) => n > 0));
  return rows
    .map((r) => ({
      ...r,
      level: (r.overdue >= 3 || r.open >= Math.max(8, typical * 2)
        ? "overloaded"
        : r.overdue > 0 || r.open >= Math.max(5, typical * 1.5)
          ? "busy"
          : r.open < typical * 0.75
            ? "light"
            : "normal") as Load["level"],
    }))
    .sort(
      (a, b) =>
        levels.indexOf(a.level) - levels.indexOf(b.level) ||
        b.overdue - a.overdue ||
        b.open - a.open ||
        a.name.localeCompare(b.name),
    );
}

function LoadBadge({ level, t }: { level: Load["level"]; t: Translate }) {
  return (
    <span className={`load-badge ${level}`}>{t(levelLabel[level])}</span>
  );
}

export function WorkloadTable({
  rows,
  t,
  lang,
  onPerson,
  compact = false,
}: {
  rows: Load[];
  t: Translate;
  lang: Language;
  onPerson?: (userId: string) => void;
  compact?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.open));
  const n = (v: number) => new Intl.NumberFormat(lang).format(v);
  return (
    <div className="table-wrap">
      <table className={`task-table workload-table ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            <th className="task-col">{t("Employee")}</th>
            <th>{t("Active tasks")}</th>
            <th>{t("In Progress")}</th>
            <th>{t("Due soon")}</th>
            <th>{t("Overdue")}</th>
            <th>{t("Completed")}</th>
            <th className="workload-bar-col">{t("Load level")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className={`load-${r.level}`}>
              <td data-label={t("Employee")}>
                <div className="workload-person">
                  <Avatar small name={r.name} />
                  {onPerson ? (
                    <button
                      className="task-title"
                      onClick={() => onPerson(r.userId)}
                    >
                      {r.name}
                      <ArrowUpRight size={13} />
                    </button>
                  ) : (
                    <span>{r.name}</span>
                  )}
                </div>
              </td>
              <td data-label={t("Active tasks")}>
                <strong className="wl-open">{n(r.open)}</strong>
              </td>
              <td data-label={t("In Progress")}>
                <span className="wl-progress">{n(r.inProgress)}</span>
              </td>
              <td data-label={t("Due soon")}>
                <span className="wl-soon">{n(r.dueSoon)}</span>
              </td>
              <td data-label={t("Overdue")}>
                <span className={r.overdue ? "wl-overdue" : "muted"}>
                  {n(r.overdue)}
                </span>
              </td>
              <td data-label={t("Completed")}>
                <span className="wl-done">{n(r.completed)}</span>
              </td>
              <td data-label={t("Load level")} className="workload-bar-col">
                <div className="workload-level">
                  {!compact && (
                    <div
                      className="workload-bar"
                      role="img"
                      aria-label={`${n(r.open)} ${t("open tasks")}, ${n(r.overdue)} ${t("overdue")}`}
                    >
                      <span
                        className="bar-open"
                        style={{ width: `${(r.open / max) * 100}%` }}
                      />
                    </div>
                  )}
                  <LoadBadge level={r.level} t={t} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Period = "" | "week" | "month";
// Monday-based week and calendar month, as ISO dates.
function periodRange(period: Period): [string, string] | null {
  if (!period) return null;
  const today = dateToday();
  const date = new Date(`${today}T00:00:00`);
  if (period === "week") {
    const start = addDays(today, -((date.getDay() + 6) % 7));
    return [start, addDays(start, 6)];
  }
  const start = `${today.slice(0, 7)}-01`;
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return [start, `${today.slice(0, 7)}-${String(next.getDate()).padStart(2, "0")}`];
}

function FilterSelect({
  icon: Icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: typeof Folder;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="wl-filter">
      <Icon size={18} aria-hidden="true" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={16} aria-hidden="true" className="wl-caret" />
    </label>
  );
}

export function WorkloadPage({
  data,
  people,
  t,
  lang,
  onPerson,
  onTeam,
}: {
  data: Workspace;
  people: string[];
  t: Translate;
  lang: Language;
  onPerson: (userId: string) => void;
  onTeam: () => void;
}) {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [period, setPeriod] = useState<Period>("");
  const team = data.employees.filter((e) => people.includes(e.userId));
  const departments = [
    ...new Set(team.map((e) => e.department).filter(Boolean)),
  ].sort();
  const range = periodRange(period);
  const today = dateToday();
  const tasks = data.tasks.filter(
    (task) =>
      (!project ||
        (project === "personal"
          ? !task.projectId
          : task.projectId === project)) &&
      (!range ||
        (!!task.dueDate &&
          ((task.dueDate >= range[0] && task.dueDate <= range[1]) ||
            // Overdue open work still weighs on this period.
            (task.dueDate < today && task.status !== "done")))),
  );
  const term = query.trim().toLowerCase();
  const rows = computeWorkload(
    tasks,
    team
      .filter((e) => !department || e.department === department)
      .map((e) => ({ userId: e.userId, name: e.name })),
  ).filter(
    (r) =>
      (!level || r.level === level) &&
      (!term || r.name.toLowerCase().includes(term)),
  );
  const n = (v: number) => new Intl.NumberFormat(lang).format(v);
  const totalOpen = rows.reduce((sum, r) => sum + r.open, 0);
  const totalOverdue = rows.reduce((sum, r) => sum + r.overdue, 0);
  const top = rows.find((r) => r.open > 0);
  const attention = rows
    .filter((r) => r.level === "overloaded" || r.level === "busy")
    .slice(0, 3);
  // Arabic uses the plural noun for 3–10 (and zero), the singular otherwise.
  const unit = (count: number, one: string, many: string) => {
    const rule = new Intl.PluralRules(lang).select(count);
    return t(
      lang === "ar"
        ? rule === "few" || rule === "zero"
          ? many
          : one
        : rule === "one"
          ? one
          : many,
    );
  };
  const cards = [
    {
      key: "team",
      icon: Users,
      label: t("Team total"),
      value: n(rows.length),
      hint: unit(rows.length, "member", "members"),
    },
    {
      key: "open",
      icon: FileText,
      label: t("All open tasks"),
      value: n(totalOpen),
      hint: unit(totalOpen, "task", "tasks"),
    },
    {
      key: "overdue",
      icon: Clock3,
      label: t("Overdue tasks"),
      value: n(totalOverdue),
      hint: unit(totalOverdue, "task", "tasks"),
    },
  ];
  return (
    <div className="workload-page">
      <section className="wl-stats" aria-label={t("Team workload")}>
        {cards.map(({ key, icon: Icon, label, value, hint }) => (
          <div key={key} className={`wl-stat wl-stat-${key}`}>
            <span className="wl-stat-icon">
              <Icon size={26} aria-hidden="true" />
            </span>
            <div>
              <span className="wl-stat-label">{label}</span>
              <strong className="wl-stat-value">{value}</strong>
              <span className="wl-stat-hint">{hint}</span>
            </div>
          </div>
        ))}
        <div className="wl-stat wl-stat-top">
          <span className="wl-stat-icon">
            <BarChart3 size={26} aria-hidden="true" />
          </span>
          <div>
            <span className="wl-stat-label">{t("Highest load")}</span>
            {top ? (
              <>
                <strong className="wl-stat-name">{top.name}</strong>
                <span className="wl-stat-hint">
                  {n(top.open)} {unit(top.open, "active task", "active tasks")}
                </span>
              </>
            ) : (
              <strong className="wl-stat-name">—</strong>
            )}
          </div>
        </div>
      </section>

      <div className="wl-filters">
        <label className="wl-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={t("Search for an employee...")}
            aria-label={t("Search for an employee...")}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <FilterSelect
          icon={Folder}
          label={t("Project")}
          value={project}
          onChange={setProject}
        >
          <option value="">{t("All projects")}</option>
          <option value="personal">{t("Personal")}</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          icon={Users}
          label={t("Department")}
          value={department}
          onChange={setDepartment}
        >
          <option value="">{t("All departments")}</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          icon={Tag}
          label={t("Load level")}
          value={level}
          onChange={setLevel}
        >
          <option value="">{t("All statuses")}</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {t(levelLabel[l])}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          icon={CalendarDays}
          label={t("Period")}
          value={period}
          onChange={(v) => setPeriod(v as Period)}
        >
          <option value="">{t("All time")}</option>
          <option value="week">{t("This week")}</option>
          <option value="month">{t("This month")}</option>
        </FilterSelect>
      </div>

      <div className="wl-body">
        <section className="panel wl-main">
          <h2 className="wl-panel-title">
            <Users size={22} aria-hidden="true" />
            {t("Team workload")}
          </h2>
          {rows.length ? (
            <WorkloadTable rows={rows} t={t} lang={lang} onPerson={onPerson} />
          ) : (
            <Empty
              title={t(team.length ? "No matching employees" : "No team members")}
              description={t(
                team.length
                  ? "Try changing the search or filters."
                  : "Employees below you in the organization will appear here when linked in HR.",
              )}
            />
          )}
        </section>

        <aside className="panel wl-attention">
          <h2 className="wl-panel-title">
            <AlertTriangle size={22} aria-hidden="true" className="warn" />
            {t("Needs your attention")}
          </h2>
          <p className="wl-attention-sub">
            {t("Team members with overdue tasks or a high workload.")}
          </p>
          {attention.length ? (
            <ul className="wl-attention-list">
              {attention.map((r) => (
                <li key={r.userId}>
                  <button onClick={() => onPerson(r.userId)}>
                    <Avatar name={r.name} />
                    <span className="wl-attention-info">
                      <strong>{r.name}</strong>
                      <span>
                        <span className="muted">
                          {n(r.open)} {t("active")}
                        </span>
                        <span className="wl-overdue">
                          {n(r.overdue)} {t("overdue")}
                        </span>
                      </span>
                    </span>
                    <LoadBadge level={r.level} t={t} />
                    <ChevronRight
                      size={18}
                      aria-hidden="true"
                      className="wl-chevron"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wl-attention-empty">
              {t("No one needs attention right now.")}
            </p>
          )}
          <button className="wl-all-button" onClick={onTeam}>
            {t("View all team members")}
            <ChevronRight size={18} aria-hidden="true" className="wl-chevron" />
          </button>
        </aside>
      </div>

      <p className="helper workload-legend">
        {t(
          "Counts use each person’s own part of shared tasks and only work visible to you. Due soon means the next 3 days. High load: any overdue task or 1.5× the team’s typical open tasks. Overloaded: 3+ overdue tasks or 2× the typical open tasks. Light: under 75% of the typical open tasks.",
        )}
      </p>
    </div>
  );
}
