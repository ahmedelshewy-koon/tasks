"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Check,
  Flag,
  HeartPulse,
} from "lucide-react";
import { command, type Project, type Task, type Workspace } from "./api";
import { ErrorBox, PriorityBadge, type Translate } from "./primitives";
import { dateToday, type Language } from "./i18n";
import { formatDate } from "./task-views";
import { addDays } from "./view-config";
import { healthLabels } from "./activity-text";
import { computeWorkload, WorkloadTable } from "./workload";
import { ProjectActivity } from "./project-activity";
import { buildRoadmap } from "../modules/tasks/roadmap";

const reasonText: Record<string, string> = {
  project_completed: "The project is marked completed.",
  all_tasks_done: "Every task is done.",
  past_due_date: "The project due date has passed.",
  overdue_tasks: "Some tasks are overdue.",
  many_overdue_tasks: "A quarter or more of the tasks are overdue.",
  overdue_milestones: "Milestones are past their date.",
  behind_schedule: "Progress is behind the time elapsed.",
  far_behind_schedule: "Progress is far behind the time elapsed.",
  due_soon: "Due within 7 days with less than 80% done.",
};

export function HealthBadge({
  health,
  t,
}: {
  health: string;
  t: Translate;
}) {
  return (
    <span className={`badge health-badge health-${health}`}>
      <span className="health-dot" />
      {t(healthLabels[health])}
    </span>
  );
}

function HealthCard({ project, t }: { project: Project; t: Translate }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = async (value: string) => {
    setBusy(true);
    setError("");
    try {
      await command("setHealth", { health: value || null }, project.id);
      await client.invalidateQueries({ queryKey: ["workspace"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel overview-card health-card">
      <div className="overview-card-head">
        <span className="eyebrow">
          <HeartPulse size={12} /> {t("Project health")}
        </span>
        <HealthBadge health={project.health} t={t} />
      </div>
      <p className="helper">
        {project.healthOverride
          ? `${t("Set manually")} · ${t("Suggested")}: ${t(healthLabels[project.suggestedHealth])}`
          : t("Suggested by TASK from progress and due dates.")}
      </p>
      {project.healthReasons.length > 0 && (
        <ul className="health-reasons">
          {project.healthReasons.map((reason) => (
            <li key={reason}>{t(reasonText[reason])}</li>
          ))}
        </ul>
      )}
      {project.canManage && (
        <label className="field">
          <span>{t("Health status")}</span>
          <select
            value={project.healthOverride ?? ""}
            disabled={busy}
            onChange={(e) => change(e.target.value)}
          >
            <option value="">
              {t("Automatic")} ({t(healthLabels[project.suggestedHealth])})
            </option>
            {Object.entries(healthLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <ErrorBox error={t(error)} />}
    </section>
  );
}

function TaskMiniList({
  tasks,
  data,
  t,
  lang,
  onOpen,
  empty,
}: {
  tasks: Task[];
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
  empty: string;
}) {
  if (!tasks.length) return <p className="helper">{t(empty)}</p>;
  return (
    <ul className="mini-task-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <button className="task-title" onClick={() => onOpen(task.id)}>
            <span dir="auto">{task.title}</span>
          </button>
          <PriorityBadge priority={task.priority} t={t} />
          <span className="muted small-text">
            {task.assigneeIds
              .map(
                (id) =>
                  data.employees
                    .find((e) => e.userId === id)
                    ?.name.split(" ")[0] ?? id,
              )
              .join("، ")}
          </span>
          <time
            className={
              task.dueDate && task.dueDate < dateToday()
                ? "overdue-text"
                : "date-text"
            }
          >
            {formatDate(task.dueDate, t, lang)}
          </time>
        </li>
      ))}
    </ul>
  );
}

export function ProjectOverview({
  project,
  data,
  t,
  lang,
  onOpen,
  onView,
}: {
  project: Project;
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
  onView: (view: string) => void;
}) {
  const today = dateToday();
  const tasks = data.tasks.filter((task) => task.projectId === project.id);
  const top = tasks.filter((task) => !task.parentId);
  const open = tasks.filter((task) => task.status !== "done");
  const overdue = open
    .filter((task) => task.dueDate && task.dueDate < today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const upcoming = open
    .filter(
      (task) =>
        task.dueDate &&
        task.dueDate >= today &&
        task.dueDate <= addDays(today, 14),
    )
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const milestones = data.milestones
    .filter((m) => m.projectId === project.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const roadmap = buildRoadmap(project.sections, tasks);
  const people = [project.ownerId, ...project.memberIds].filter(
    (id) => project.roles[id] !== "viewer",
  );
  const workload = computeWorkload(
    tasks,
    data.employees
      .filter((e) => people.includes(e.userId))
      .map((e) => ({ userId: e.userId, name: e.name })),
  ).filter((row) => row.open + row.completed > 0);
  const done = top.filter((task) => task.status === "done").length;
  return (
    <div className="project-overview">
      <div className="overview-top">
        <section className="panel overview-card progress-card">
          <span className="eyebrow">{t("Progress")}</span>
          <strong className="overview-number">{project.progress}%</strong>
          <div className="mini-progress">
            <span style={{ width: `${project.progress}%` }} />
          </div>
          <p className="helper">
            {done} / {top.length} {t("tasks done")}
            {project.dueDate &&
              ` · ${t("Due")} ${formatDate(project.dueDate, t, lang)}`}
          </p>
        </section>
        <HealthCard project={project} t={t} />
        <section className="panel overview-card">
          <span className="eyebrow">{t("Overdue Tasks")}</span>
          <strong
            className={`overview-number ${overdue.length ? "overdue-text" : ""}`}
          >
            {overdue.length}
          </strong>
          <p className="helper">
            {project.overdueMilestones > 0
              ? `${project.overdueMilestones} ${t("overdue milestones")}`
              : t("No overdue milestones")}
          </p>
        </section>
        <section className="panel overview-card">
          <span className="eyebrow">{t("Next milestone")}</span>
          {milestones.find((m) => m.status === "upcoming") ? (
            (() => {
              const next = milestones.find((m) => m.status === "upcoming")!;
              return (
                <>
                  <strong className="overview-title" dir="auto">
                    ◇ {next.name}
                  </strong>
                  <p
                    className={`helper ${next.dueDate < today ? "overdue-text" : ""}`}
                  >
                    {formatDate(next.dueDate, t, lang)}
                  </p>
                </>
              );
            })()
          ) : (
            <p className="helper">
              {t(milestones.length ? "All milestones completed" : "No milestones yet")}
            </p>
          )}
        </section>
      </div>
      <div className="overview-columns">
        <div className="overview-column">
          <section className="panel overview-section">
            <div className="section-heading">
              <h3>
                <AlertTriangle size={15} />
                {t("Overdue Tasks")}
                <span className="count">{overdue.length}</span>
              </h3>
            </div>
            <TaskMiniList
              tasks={overdue.slice(0, 6)}
              data={data}
              t={t}
              lang={lang}
              onOpen={onOpen}
              empty="Nothing is overdue."
            />
            {overdue.length > 6 && (
              <button className="text-button" onClick={() => onView("list")}>
                {t("View all in List")}
                <ArrowUpRight size={13} />
              </button>
            )}
          </section>
          <section className="panel overview-section">
            <div className="section-heading">
              <h3>
                <CalendarClock size={15} />
                {t("Upcoming Tasks")}
                <span className="count">{upcoming.length}</span>
              </h3>
              <span className="muted small-text">{t("Next 14 days")}</span>
            </div>
            <TaskMiniList
              tasks={upcoming.slice(0, 6)}
              data={data}
              t={t}
              lang={lang}
              onOpen={onOpen}
              empty="No tasks due in the next 14 days."
            />
          </section>
          <section className="panel overview-section">
            <div className="section-heading">
              <h3>{t("Team workload")}</h3>
            </div>
            {workload.length ? (
              <WorkloadTable rows={workload} t={t} lang={lang} compact />
            ) : (
              <p className="helper">{t("No assigned work yet.")}</p>
            )}
          </section>
        </div>
        <div className="overview-column">
          <section className="panel overview-section">
            <div className="section-heading">
              <h3>◇ {t("Milestones")}</h3>
              <button
                className="text-button"
                onClick={() => onView("roadmap")}
              >
                {t("Manage")}
                <ArrowUpRight size={13} />
              </button>
            </div>
            {!milestones.length && (
              <p className="helper">{t("No milestones yet")}</p>
            )}
            <ul className="overview-milestones">
              {milestones.slice(0, 6).map((m) => {
                const linked = tasks.filter((x) => x.milestoneId === m.id);
                const late = m.status === "upcoming" && m.dueDate < today;
                return (
                  <li key={m.id} className={late ? "is-late" : ""}>
                    <span className="milestone-mark">
                      {m.status === "completed" ? <Check size={12} /> : "◇"}
                    </span>
                    <span dir="auto">{m.name}</span>
                    <span className="muted small-text">
                      {linked.filter((x) => x.status === "done").length}/
                      {linked.length}
                    </span>
                    <time className={late ? "overdue-text" : "date-text"}>
                      {formatDate(m.dueDate, t, lang)}
                    </time>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="panel overview-section">
            <div className="section-heading">
              <h3>
                <Flag size={15} />
                {t("Project Map")}
              </h3>
              <button
                className="text-button"
                onClick={() => onView("roadmap")}
              >
                {t("Open Project Map")}
                <ArrowUpRight size={13} />
              </button>
            </div>
            <ol className="map-preview">
              {roadmap.stages.map((stage, index) => {
                const pct = stage.tasks.length
                  ? Math.round((stage.completed / stage.tasks.length) * 100)
                  : 0;
                return (
                  <li
                    key={stage.id}
                    className={stage.complete ? "is-reached" : ""}
                  >
                    <span className="map-stop">
                      {stage.complete ? <Check size={12} /> : index + 1}
                    </span>
                    <span className="map-name" dir="auto">
                      {t(stage.name)}
                    </span>
                    <span className="mini-progress">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="muted small-text">
                      {stage.completed}/{stage.tasks.length}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="panel overview-section">
            <div className="section-heading">
              <h3>{t("Recent activity")}</h3>
              <button
                className="text-button"
                onClick={() => onView("activity")}
              >
                {t("View all activity")}
                <ArrowUpRight size={13} />
              </button>
            </div>
            <ProjectActivity
              projectId={project.id}
              data={data}
              t={t}
              lang={lang}
              onOpen={onOpen}
              limit={6}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
