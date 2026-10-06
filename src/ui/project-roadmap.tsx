"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Check, Circle, Compass, Flag, MapPin, Trophy } from "lucide-react";
import { Milestones } from "./milestones";
import type { Project, Task, Workspace } from "./api";
import { buildRoadmap } from "../modules/tasks/roadmap";
import { Avatar, StatusBadge, type Translate } from "./primitives";
import { formatDate } from "./task-views";
import type { Language } from "./i18n";

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

type Point = { x: number; y: number; row: number; ltr: boolean };

// Lay stops out as a snake: each row runs the opposite way to the one above,
// and in RTL the first row starts from the right.
function layoutStops(count: number, width: number, rtl: boolean) {
  const cols = width >= 1000 ? 4 : width >= 640 ? 3 : 2;
  const padX = width >= 640 ? 96 : 64;
  const rowHeight = width >= 640 ? 250 : 240;
  const top = 64;
  const gap = (width - padX * 2) / (cols - 1);
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const ltr = (row % 2 === 0) !== rtl;
    const x = ltr ? padX + col * gap : width - padX - col * gap;
    points.push({ x, y: top + row * rowHeight, row, ltr });
  }
  const rows = Math.ceil(count / cols);
  return { points, height: top + (rows - 1) * rowHeight + 200, padX };
}

function segmentPath(a: Point, b: Point, index: number, turn: number) {
  if (a.row === b.row) {
    const dx = b.x - a.x;
    const wave = index % 2 ? 26 : -26;
    return `M${a.x},${a.y} C${a.x + dx * 0.45},${a.y + wave} ${b.x - dx * 0.45},${b.y - wave} ${b.x},${b.y}`;
  }
  // U-turn bulges toward the side the row ended on.
  const side = a.ltr ? 1 : -1;
  return `M${a.x},${a.y} C${a.x + side * turn},${a.y} ${b.x + side * turn},${b.y} ${b.x},${b.y}`;
}

export function ProjectRoadmap({
  project,
  tasks,
  visibleTasks,
  data,
  t,
  lang,
  onOpen,
  readOnly = false,
}: {
  readOnly?: boolean;
  project: Project;
  tasks: Task[];
  visibleTasks: Task[];
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
}) {
  const roadmap = buildRoadmap(project.sections, tasks);
  const visible = new Set(visibleTasks.map((task) => task.id));
  const currentIndex = roadmap.stages.findIndex((stage) => !stage.complete);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    roadmap.stages.find((stage) => stage.id === selectedId) ??
    roadmap.stages[currentIndex] ??
    roadmap.stages.at(-1);
  const selectedIndex = selected ? roadmap.stages.indexOf(selected) : -1;

  const mapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useIsoLayoutEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    setWidth(node.clientWidth);
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rtl = lang === "ar";
  // Stops: start, every milestone, then the shared finish line.
  const stopCount = roadmap.stages.length + 2;
  const { points, height, padX } = layoutStops(stopCount, width || 900, rtl);
  const reached = (stop: number) =>
    stop === 0 ||
    (stop <= roadmap.stages.length
      ? roadmap.stages[stop - 1].complete
      : roadmap.complete);
  const nameOf = (id: string) =>
    data.employees.find((e) => e.userId === id)?.name || id;
  // Everyone assigned to a task in the stage, in first-seen order.
  const ownersOf = (stageTasks: Task[]) => [
    ...new Set(stageTasks.flatMap((task) => task.assigneeIds)),
  ];

  return (
    <section className="roadmap" aria-label={t("Roadmap")}>
      <Milestones
        readOnly={readOnly}
        project={project}
        data={data}
        t={t}
        lang={lang}
        onOpen={onOpen}
      />
      <section className="panel milestone-panel">
        <h3>{t("Dependencies")}</h3>
        {!tasks.some((task) => task.blockedBy.length) && (
          <p className="helper">{t("No dependencies")}</p>
        )}
        {tasks
          .filter((task) => task.blockedBy.length)
          .map((task) => (
            <div className="feature-row" key={task.id}>
              <button className="text-button" onClick={() => onOpen(task.id)}>
                {task.title}
              </button>
              <span>{t("Blocked by")}</span>
              {task.blockedBy.map((id) => (
                <button
                  key={id}
                  className="text-button"
                  onClick={() => onOpen(id)}
                >
                  {tasks.find((item) => item.id === id)?.title}
                </button>
              ))}
              {task.blocked && (
                <span className="badge blocked-badge">{t("Blocked")}</span>
              )}
            </div>
          ))}
      </section>
      <div className="roadmap-goal panel">
        <div className="roadmap-goal-icon">
          <Flag size={24} />
        </div>
        <div className="roadmap-goal-copy">
          <span className="eyebrow">{t("Shared goal")}</span>
          <h2>{project.name}</h2>
          <p>
            {project.description || t("Complete all project tasks together.")}
          </p>
          <small>{t("Task progress across project stages.")}</small>
        </div>
        <div className="roadmap-total">
          <strong>{roadmap.progress}%</strong>
          <span>
            {roadmap.completed} / {roadmap.total} {t("tasks")}
          </span>
          <span>
            {t(roadmap.complete ? "Goal reached" : "Working toward the goal")}
          </span>
        </div>
      </div>
      <p className="muted small-text">
        {t("Progress includes all project tasks, regardless of filters.")}
      </p>

      <div className="journey panel">
        <div className="journey-head">
          <span className="journey-title">
            <Compass size={18} />
            {t("Journey map")}
          </span>
          <span className="muted small-text">
            {t("Select a stop on the map to see its tasks.")}
          </span>
        </div>
        <div className="journey-map" ref={mapRef} style={{ height }}>
          {width > 0 && (
            <>
              <svg
                className="journey-road"
                width={width}
                height={height}
                aria-hidden="true"
              >
                {points.slice(1).map((point, i) => {
                  const d = segmentPath(points[i], point, i, padX - 18);
                  const done = reached(i + 1);
                  const active = !done && reached(i);
                  return (
                    <g key={i}>
                      <path className="journey-road-bed" d={d} />
                      <path className="journey-road-line" d={d} />
                      {done && <path className="journey-road-done" d={d} />}
                      {active && <path className="journey-road-active" d={d} />}
                    </g>
                  );
                })}
              </svg>

              <div
                className="journey-stop journey-start is-reached"
                style={{ left: points[0].x, top: points[0].y }}
              >
                <span className="journey-pin">
                  <MapPin size={20} />
                </span>
                <span className="journey-label">
                  <strong>{t("Start")}</strong>
                  <span className="muted">
                    {roadmap.total} {t("tasks")}
                  </span>
                </span>
              </div>

              {roadmap.stages.map((stage, index) => {
                const point = points[index + 1];
                const isCurrent = index === currentIndex;
                const owners = ownersOf(stage.tasks);
                const pct = stage.tasks.length
                  ? Math.round((stage.completed / stage.tasks.length) * 100)
                  : 0;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    className={`journey-stop ${stage.complete ? "is-reached" : ""} ${isCurrent ? "is-current" : ""} ${selected?.id === stage.id ? "is-selected" : ""}`}
                    style={
                      {
                        left: point.x,
                        top: point.y,
                        "--pct": `${pct}%`,
                      } as CSSProperties
                    }
                    aria-pressed={selected?.id === stage.id}
                    onClick={() => setSelectedId(stage.id)}
                  >
                    {isCurrent && (
                      <span className="journey-here">{t("You are here")}</span>
                    )}
                    <span className="journey-pin">
                      {stage.complete ? <Check size={20} /> : index + 1}
                    </span>
                    <span className="journey-label">
                      <strong>{t(stage.name)}</strong>
                      <span className="muted">
                        {stage.completed} / {stage.tasks.length} ·{" "}
                        {formatDate(stage.dueDate, t, lang)}
                      </span>
                      {owners.length > 0 ? (
                        <span className="journey-owners">
                          <span className="avatar-stack">
                            {owners.slice(0, 3).map((id) => (
                              <Avatar key={id} small name={nameOf(id)} />
                            ))}
                            {owners.length > 3 && (
                              <span className="avatar small">
                                +{owners.length - 3}
                              </span>
                            )}
                          </span>
                          <span className="journey-owner-names">
                            {owners
                              .map((id) => nameOf(id).split(" ")[0])
                              .join("، ")}
                          </span>
                        </span>
                      ) : (
                        <span className="journey-owner-names muted">
                          {t("No assignees")}
                        </span>
                      )}
                    </span>
                    {owners.length > 0 && (
                      <span className="journey-card" role="tooltip">
                        <span className="eyebrow">{t("Stage owners")}</span>
                        {owners.map((id) => (
                          <span className="journey-card-row" key={id}>
                            <Avatar small name={nameOf(id)} />
                            <strong>{nameOf(id)}</strong>
                            <span className="muted">
                              {
                                stage.tasks.filter((task) =>
                                  task.assigneeIds.includes(id),
                                ).length
                              }{" "}
                              {t("tasks")}
                            </span>
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}

              <div
                className={`journey-stop journey-finish ${roadmap.complete ? "is-reached" : ""}`}
                style={{ left: points.at(-1)!.x, top: points.at(-1)!.y }}
              >
                <span className="journey-pin">
                  {roadmap.complete ? <Trophy size={22} /> : <Flag size={22} />}
                </span>
                <span className="journey-label">
                  <strong>
                    {t(
                      roadmap.complete ? "Goal reached" : "Shared finish line",
                    )}
                  </strong>
                  <span className="muted">{roadmap.progress}%</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {selected && (
        <div className="panel roadmap-stage-body journey-detail">
          <header>
            <div>
              <span className="eyebrow">
                {t("Stage")} {selectedIndex + 1}
              </span>
              <h3>{t(selected.name)}</h3>
            </div>
            <span className="badge">
              {selected.completed} / {selected.tasks.length} {t("Done")}
            </span>
          </header>
          <p className="muted small-text">
            {formatDate(selected.dueDate, t, lang)} ·{" "}
            {t(selected.complete ? "Stage reached" : "Stage pending")}
          </p>
          <div className="mini-progress">
            <span
              style={{
                width: `${selected.tasks.length ? (selected.completed / selected.tasks.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="roadmap-task-grid">
            {selected.tasks
              .filter((task) => visible.has(task.id))
              .map((task) => (
                <button
                  className="roadmap-task"
                  key={task.id}
                  onClick={() => onOpen(task.id)}
                >
                  <span className="roadmap-task-title">
                    {task.status === "done" ? (
                      <Check size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                    <strong>{task.title}</strong>
                  </span>
                  <span className="muted small-text">
                    {task.assigneeIds.map(nameOf).join("، ")}
                  </span>
                  <span className="roadmap-task-meta">
                    <StatusBadge status={task.status} t={t} />
                    <span>{formatDate(task.dueDate, t, lang)}</span>
                  </span>
                </button>
              ))}
          </div>
          {!selected.tasks.length && (
            <p className="muted">{t("Add tasks to this stage to begin.")}</p>
          )}
          {selected.tasks.length > 0 &&
            !selected.tasks.some((task) => visible.has(task.id)) && (
              <p className="muted">{t("No tasks match your filters.")}</p>
            )}
        </div>
      )}
    </section>
  );
}
