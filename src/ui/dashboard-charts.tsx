"use client";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AlertTriangle, ChevronRight, Folder } from "lucide-react";
import type { Project, Task, Workspace } from "./api";
import { priorityLabels, statusLabels, type Language } from "./i18n";
import { Avatar, type Translate } from "./primitives";

type Status = keyof typeof statusLabels;
type Priority = keyof typeof priorityLabels;
const statusOrder: Status[] = ["done", "in_progress", "todo"];
const priorityOrder: Priority[] = ["urgent", "high", "medium", "low"];

const isOverdue = (task: Task, today: string) =>
  !!task.dueDate && task.dueDate < today && task.status !== "done";
const pct = (part: number, whole: number) =>
  whole ? Math.round((part / whole) * 100) : 0;
function countStatuses(tasks: Task[]) {
  const counts = { done: 0, in_progress: 0, todo: 0 } as Record<Status, number>;
  for (const task of tasks) counts[task.status as Status]++;
  return counts;
}

/* Hover tooltip shared by all dashboard charts. */
function useTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    content: ReactNode;
  } | null>(null);
  const show = (content: ReactNode) => (e: MouseEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
  };
  const hide = () => setTip(null);
  const node = tip && (
    <div
      className={`chart-tooltip ${tip.y < 110 ? "below" : ""}`}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  );
  return { ref, show, hide, node };
}

function TipRows({
  title,
  rows,
}: {
  title: string;
  rows: [string, ReactNode, string?][];
}) {
  return (
    <>
      <strong>{title}</strong>
      {rows.map(([label, value, swatch]) => (
        <span key={label}>
          {swatch && <i className={`swatch ${swatch}`} />}
          {label}
          <b>{value}</b>
        </span>
      ))}
    </>
  );
}

export function StatusLegend({ t }: { t: Translate }) {
  return (
    <div className="chart-legend">
      {statusOrder.map((s) => (
        <span key={s}>
          <i className={`swatch status-fill-${s}`} />
          {t(statusLabels[s])}
        </span>
      ))}
    </div>
  );
}

function StackedBar({
  counts,
  scale,
  t,
  title,
  show,
  hide,
}: {
  counts: Record<Status, number>;
  scale: number;
  t: Translate;
  title: string;
  show: ReturnType<typeof useTooltip>["show"];
  hide: () => void;
}) {
  const total = statusOrder.reduce((sum, s) => sum + counts[s], 0);
  return (
    <div className="stack-track">
      <div className="stack-fill" style={{ width: `${pct(total, scale)}%` }}>
        {statusOrder.map(
          (s) =>
            counts[s] > 0 && (
              <span
                key={s}
                className={`stack-seg status-fill-${s}`}
                style={{ flexGrow: counts[s] }}
                onMouseMove={show(
                  <TipRows
                    title={title}
                    rows={statusOrder.map((k) => [
                      t(statusLabels[k]),
                      `${counts[k]} · ${pct(counts[k], total)}%`,
                      `status-fill-${k}`,
                    ])}
                  />,
                )}
                onMouseLeave={hide}
              />
            ),
        )}
      </div>
    </div>
  );
}

export function ProjectsChart({
  projects,
  tasks,
  t,
  lang,
  today,
  onProject,
}: {
  projects: Project[];
  tasks: Task[];
  t: Translate;
  lang: Language;
  today: string;
  onProject: (id: string) => void;
}) {
  const tip = useTooltip();
  const nf = new Intl.NumberFormat(lang);
  const rows = projects
    .map((p) => {
      const own = tasks.filter((x) => x.projectId === p.id && !x.parentId);
      return {
        project: p,
        counts: countStatuses(own),
        total: own.length,
        overdue: own.filter((x) => isOverdue(x, today)).length,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  return (
    <div className="projects-chart" ref={tip.ref}>
      <StatusLegend t={t} />
      {rows.map(({ project: p, counts, total, overdue }) => (
        <button
          className="project-chart-row"
          key={p.id}
          onClick={() => onProject(p.id)}
        >
          <span className="project-icon">
            <Folder size={16} />
          </span>
          <div className="project-chart-body">
            <div className="project-chart-head">
              <strong title={p.name}>{p.name}</strong>
              <span className="project-chart-meta">
                {overdue > 0 && (
                  <span className="overdue-pill">
                    <AlertTriangle size={11} />
                    {nf.format(overdue)} {t("Overdue")}
                  </span>
                )}
                <span>
                  {nf.format(counts.done)}/{nf.format(total)} {t("tasks")}
                </span>
              </span>
            </div>
            {total ? (
              <StackedBar
                counts={counts}
                scale={total}
                t={t}
                title={p.name}
                show={tip.show}
                hide={tip.hide}
              />
            ) : (
              <div className="stack-track" />
            )}
          </div>
          <span className="project-chart-pct">{nf.format(p.progress)}%</span>
          <ChevronRight size={14} />
        </button>
      ))}
      {tip.node}
    </div>
  );
}

export function PriorityChart({
  tasks,
  t,
  lang,
  today,
}: {
  tasks: Task[];
  t: Translate;
  lang: Language;
  today: string;
}) {
  const tip = useTooltip();
  const nf = new Intl.NumberFormat(lang);
  const total = tasks.length;
  const rows = priorityOrder.map((key) => {
    const own = tasks.filter((x) => x.priority === key);
    return {
      key,
      count: own.length,
      open: own.filter((x) => x.status !== "done").length,
      overdue: own.filter((x) => isOverdue(x, today)).length,
    };
  });
  const urgentOpen = rows
    .filter((r) => r.key === "urgent" || r.key === "high")
    .reduce((sum, r) => sum + r.open, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const visible = rows.filter((r) => r.count > 0);
  const gap = visible.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="priority-donut" ref={tip.ref}>
      <div className="donut-wrap">
        <svg viewBox="0 0 140 140" role="img" aria-label={t("Tasks by priority")}>
          <circle className="donut-track" cx="70" cy="70" r={radius} />
          {visible.map((r) => {
            const length = (r.count / total) * circumference;
            const segment = (
              <circle
                key={r.key}
                className={`donut-seg priority-fill-${r.key}`}
                cx="70"
                cy="70"
                r={radius}
                strokeDasharray={`${Math.max(length - gap, 0.5)} ${circumference}`}
                strokeDashoffset={-offset}
                onMouseMove={tip.show(
                  <TipRows
                    title={t(priorityLabels[r.key])}
                    rows={[
                      [t("Total tasks"), `${nf.format(r.count)} · ${pct(r.count, total)}%`],
                      [t("Open"), nf.format(r.open)],
                      [t("Overdue"), nf.format(r.overdue)],
                    ]}
                  />,
                )}
                onMouseLeave={tip.hide}
              />
            );
            offset += length;
            return segment;
          })}
        </svg>
        <div className="donut-center">
          <strong>{nf.format(total)}</strong>
          <span>{t("tasks")}</span>
        </div>
      </div>
      <div className="priority-legend">
        <div className="priority-legend-head">
          <span />
          <span>{t("Total tasks")}</span>
          <span>{t("Open")}</span>
          <span>{t("Overdue")}</span>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="priority-legend-row">
            <span className="priority-legend-label">
              <i className={`swatch priority-fill-${r.key}`} />
              {t(priorityLabels[r.key])}
            </span>
            <span>
              <b>{nf.format(r.count)}</b>
              <small>{pct(r.count, total)}%</small>
            </span>
            <span>{nf.format(r.open)}</span>
            <span className={r.overdue ? "is-overdue" : ""}>
              {nf.format(r.overdue)}
            </span>
          </div>
        ))}
        {urgentOpen > 0 && (
          <p className="priority-insight">
            <AlertTriangle size={13} />
            {nf.format(urgentOpen)} {t("urgent or high-priority tasks still open")}
          </p>
        )}
      </div>
      {tip.node}
    </div>
  );
}

export function EmployeeChart({
  employees,
  tasks,
  t,
  lang,
  today,
}: {
  employees: Workspace["employees"];
  tasks: Task[];
  t: Translate;
  lang: Language;
  today: string;
}) {
  const tip = useTooltip();
  const nf = new Intl.NumberFormat(lang);
  const rows = employees
    .map((e) => {
      const own = tasks.filter((x) => x.assigneeIds.includes(e.userId));
      return {
        employee: e,
        counts: countStatuses(own),
        total: own.length,
        overdue: own.filter((x) => isOverdue(x, today)).length,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.employee.name.localeCompare(b.employee.name, lang),
    );
  const busy = rows.filter((r) => r.total > 0);
  const idle = rows.filter((r) => r.total === 0);
  const max = Math.max(...busy.map((r) => r.total), 1);
  const assignedTotal = busy.reduce((sum, r) => sum + r.total, 0);
  const average = busy.length ? assignedTotal / busy.length : 0;
  const unassigned = tasks.filter((x) => !x.assigneeIds.length).length;
  const overdueTotal = busy.reduce((sum, r) => sum + r.overdue, 0);
  const summary = [
    { label: t("Assigned employees"), value: nf.format(busy.length) },
    {
      label: t("Avg. tasks per employee"),
      value: new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(
        average,
      ),
    },
    { label: t("Overdue"), value: nf.format(overdueTotal), alert: overdueTotal > 0 },
    { label: t("Unassigned"), value: nf.format(unassigned), alert: unassigned > 0 },
  ];
  return (
    <div className="employee-chart" ref={tip.ref}>
      <div className="employee-summary">
        {summary.map((s) => (
          <div key={s.label} className={s.alert ? "is-alert" : ""}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>
      <div className="employee-chart-head">
        <StatusLegend t={t} />
        <span className="employee-chart-cols">
          <span>{t("Total tasks")}</span>
          <span>{t("Completion")}</span>
        </span>
      </div>
      <div className="employee-rows">
        {busy.map(({ employee: e, counts, total, overdue }) => (
          <div className="employee-row" key={e.userId}>
            <span className="employee-name">
              <Avatar small name={e.name} />
              <span title={e.name}>{e.name}</span>
            </span>
            <StackedBar
              counts={counts}
              scale={max}
              t={t}
              title={e.name}
              show={tip.show}
              hide={tip.hide}
            />
            <span className="employee-total">
              {nf.format(total)}
              {overdue > 0 && (
                <span
                  className="overdue-pill"
                  title={`${nf.format(overdue)} ${t("Overdue")}`}
                >
                  <AlertTriangle size={10} />
                  {nf.format(overdue)}
                </span>
              )}
            </span>
            <span className="employee-rate">
              {nf.format(pct(counts.done, total))}%
            </span>
          </div>
        ))}
      </div>
      {idle.length > 0 && (
        <p className="employee-idle">
          <strong>
            {nf.format(idle.length)} {t("employees without tasks")}:
          </strong>{" "}
          {idle.map((r) => r.employee.name).join(lang === "ar" ? "، " : ", ")}
        </p>
      )}
      {tip.node}
    </div>
  );
}
