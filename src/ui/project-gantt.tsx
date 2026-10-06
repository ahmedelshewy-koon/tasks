"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Diamond } from "lucide-react";
import type { Project, Task, Workspace } from "./api";
import { buildGantt, dayIso } from "../modules/tasks/gantt";
import { Empty, type Translate } from "./primitives";
import { formatDate } from "./task-views";
import { dateToday, statusLabels, type Language } from "./i18n";

const scales = {
  day: { label: "Days", width: 34 },
  week: { label: "Weeks", width: 14 },
  month: { label: "Months", width: 5 },
} as const;
type Scale = keyof typeof scales;
const NAME_WIDTH = 260;
const ROW = 40;

export function ProjectGantt({
  project,
  tasks,
  milestones,
  t,
  lang,
  onOpen,
}: {
  project: Project;
  tasks: Task[];
  milestones: Workspace["milestones"];
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
}) {
  const [scale, setScale] = useState<Scale>("day");
  const todayRef = useRef<HTMLDivElement>(null);
  const gantt = buildGantt({
    sections: project.sections,
    tasks,
    milestones,
    projectStart: project.startDate,
    projectDue: project.dueDate,
    today: dateToday(),
  });
  const dw = scales[scale].width;
  const width = gantt.days * dw;
  const rtl = lang === "ar";
  const locale = rtl ? "ar-EG" : "en-GB";
  const num = new Intl.NumberFormat(rtl ? "ar" : "en");
  // Braces matter: newer browsers return a Promise from scrollIntoView, and
  // React rejects anything but a cleanup function from an effect.
  const scrollToToday = () => {
    todayRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  };
  useEffect(scrollToToday, [scale]);

  const months: { key: string; offset: number; days: number }[] = [];
  for (let i = 0; i < gantt.days; i++) {
    const key = dayIso(gantt.start + i).slice(0, 7);
    if (months.at(-1)?.key === key) months.at(-1)!.days++;
    else months.push({ key, offset: i, days: 1 });
  }
  const ticks = Array.from({ length: gantt.days }, (_, i) => i).filter(
    (i) => scale === "day" || (scale === "week" && i % 7 === 0),
  );
  const x = (offset: number) => offset * dw;
  const pos = (offset: number, w: number): CSSProperties => ({
    insetInlineStart: x(offset),
    width: w,
  });
  const bodyHeight = gantt.rows.length * ROW;

  if (!tasks.length)
    return (
      <div className="panel">
        <Empty
          title={t("No matching tasks")}
          description={t("Try another search or clear your filters.")}
        />
      </div>
    );

  return (
    <section className="gantt panel" aria-label={t("Gantt")}>
      <div className="gantt-toolbar">
        <div className="gantt-legend">
          <span>
            <i className="gantt-swatch todo" />
            {t(statusLabels.todo)}
          </span>
          <span>
            <i className="gantt-swatch in_progress" />
            {t(statusLabels.in_progress)}
          </span>
          <span>
            <i className="gantt-swatch done" />
            {t(statusLabels.done)}
          </span>
          <span>
            <i className="gantt-swatch overdue" />
            {t("Overdue")}
          </span>
          {gantt.milestones.length > 0 && (
            <span>
              <Diamond size={11} className="gantt-diamond-icon" />
              {t("Milestones")}
            </span>
          )}
        </div>
        <div className="button-group">
          <button
            className="button secondary small-button"
            onClick={scrollToToday}
          >
            {t("Today")}
          </button>
          <div className="tabs gantt-scale">
            {(Object.keys(scales) as Scale[]).map((s) => (
              <button
                key={s}
                className={scale === s ? "active" : ""}
                aria-pressed={scale === s}
                onClick={() => setScale(s)}
              >
                {t(scales[s].label)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="gantt-scroll">
        <div
          className="gantt-grid"
          style={
            {
              width: NAME_WIDTH + width,
              "--gantt-name": `${NAME_WIDTH}px`,
              "--gantt-row": `${ROW}px`,
              "--gantt-week": `${dw * 7}px`,
            } as CSSProperties
          }
        >
          <div className="gantt-head">
            <div className="gantt-name gantt-corner">{t("Task")}</div>
            <div className="gantt-scale-head" style={{ width }}>
              <div className="gantt-months">
                {months.map((m) => (
                  <span key={m.key} style={pos(m.offset, m.days * dw)}>
                    {m.days * dw > 44 &&
                      new Intl.DateTimeFormat(locale, {
                        month: scale === "month" ? "short" : "long",
                        year: "numeric",
                      }).format(new Date(`${m.key}-15T12:00:00`))}
                  </span>
                ))}
              </div>
              {scale !== "month" && (
                <div className="gantt-days">
                  {ticks.map((i) => (
                    <span
                      key={i}
                      className={i === gantt.today ? "is-today" : ""}
                      style={pos(i, scale === "day" ? dw : dw * 7)}
                    >
                      {num.format(Number(dayIso(gantt.start + i).slice(8)))}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {gantt.milestones.length > 0 && (
            <div className="gantt-row gantt-milestone-row">
              <div className="gantt-name">{t("Milestones")}</div>
              <div className="gantt-track" style={{ width }}>
                {gantt.milestones.map((m) => (
                  <span
                    key={m.id}
                    className={`gantt-milestone ${m.status}`}
                    style={{ insetInlineStart: x(m.offset) + dw / 2 }}
                    title={`${m.name} · ${formatDate(m.dueDate, t, lang)}`}
                  >
                    <i />
                    {scale === "day" && <em>{m.name}</em>}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="gantt-body">
            {gantt.rows.map((row) =>
              row.kind === "section" ? (
                <div key={`s-${row.id}`} className="gantt-row gantt-section">
                  <div className="gantt-name">{t(row.name)}</div>
                  <div className="gantt-track" style={{ width }} />
                </div>
              ) : (
                <div key={row.task.id} className="gantt-row">
                  <button
                    className="gantt-name gantt-task-name"
                    onClick={() => onOpen(row.task.id)}
                    title={row.task.title}
                  >
                    <i className={`gantt-dot ${row.task.status}`} />
                    <span>{row.task.title}</span>
                  </button>
                  <div className="gantt-track" style={{ width }}>
                    <button
                      className={[
                        "gantt-bar",
                        row.task.status,
                        row.overdue && "overdue",
                        row.undated && "undated",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={pos(
                        row.start - gantt.start,
                        Math.max((row.end - row.start + 1) * dw, 8),
                      )}
                      onClick={() => onOpen(row.task.id)}
                      title={`${row.task.title}\n${formatDate(dayIso(row.start), t, lang)} – ${formatDate(row.task.dueDate, t, lang)} · ${num.format(row.task.progress)}%`}
                    >
                      <span
                        className="gantt-progress"
                        style={{ width: `${row.task.progress}%` }}
                      />
                      {(row.end - row.start + 1) * dw > 56 && (
                        <span className="gantt-bar-label">
                          {num.format(row.task.progress)}%
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              ),
            )}
            <svg
              className="gantt-links"
              width={width}
              height={bodyHeight}
              style={{ insetInlineStart: NAME_WIDTH }}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="gantt-arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--ds-gray-400)" />
                </marker>
              </defs>
              {gantt.links.map((link) => {
                const a = gantt.rows[link.from];
                const b = gantt.rows[link.to];
                if (a.kind !== "task" || b.kind !== "task") return null;
                // Draw in LTR space, then mirror the x axis for Arabic.
                const flip = (v: number) => (rtl ? width - v : v);
                const x1 = x(a.end - gantt.start + 1);
                const x2 = x(b.start - gantt.start);
                const y1 = link.from * ROW + ROW / 2;
                const y2 = link.to * ROW + ROW / 2;
                const d =
                  x2 >= x1 + 8
                    ? `M${flip(x1)},${y1} H${flip(x1 + 8)} V${y2} H${flip(x2)}`
                    : `M${flip(x1)},${y1} H${flip(x1 + 8)} V${(y1 + y2) / 2} H${flip(x2 - 8)} V${y2} H${flip(x2)}`;
                return (
                  <path
                    key={`${link.from}-${link.to}`}
                    d={d}
                    className={link.conflict ? "conflict" : ""}
                    markerEnd="url(#gantt-arrow)"
                  />
                );
              })}
            </svg>
          </div>
          <div
            ref={todayRef}
            className="gantt-today"
            style={{
              insetInlineStart: NAME_WIDTH + x(gantt.today) + dw / 2,
            }}
            title={t("Today")}
          />
        </div>
      </div>
      {gantt.rows.some((r) => r.kind === "task" && r.undated) && (
        <p className="calendar-note">
          {t("Tasks without a due date show as a dashed mark on their creation day.")}
        </p>
      )}
    </section>
  );
}
