"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request, type Workspace } from "./api";
import { ErrorBox, Loading, type Translate } from "./primitives";
import { blankFilters, FiltersBar, filterTasks, TaskList } from "./task-views";
import {
  EmployeeChart,
  PriorityChart,
  ProjectsChart,
} from "./dashboard-charts";
import { dateToday, statusLabels, type Language } from "./i18n";
import { Milestones } from "./milestones";
import { ProjectRoadmap } from "./project-roadmap";
import { HealthBadge } from "./project-overview";

export function Reports({
  data,
  t,
  lang,
  onOpen,
}: {
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
}) {
  const query = useQuery({
    queryKey: ["workspace", "report"],
    queryFn: () =>
      request<Omit<Workspace, "me" | "development" | "hrConfigured">>(
        "/api/work?report=1",
      ),
  });
  const [filters, setFilters] = useState(blankFilters);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [dueDate, setDueDate] = useState(""),
    [kind, setKind] = useState(""),
    [blocked, setBlocked] = useState(false);
  if (query.isPending) return <Loading t={t} />;
  if (query.error) return <ErrorBox error={query.error.message} />;
  const scoped: Workspace = { ...data, ...query.data };
  const tasks = filterTasks(scoped.tasks, filters).filter(
    (task) =>
      (!from || new Date(task.createdAt).toISOString().slice(0, 10) >= from) &&
      (!to || new Date(task.createdAt).toISOString().slice(0, 10) <= to) &&
      (!dueDate || task.dueDate === dueDate) &&
      (!blocked || task.blocked) &&
      (!kind ||
        (kind === "personal"
          ? !task.projectId
          : kind === "subtask"
            ? !!task.parentId
            : !!task.projectId && !task.parentId)),
  );
  const projects = scoped.projects.filter(
    (p) => !filters.project || p.id === filters.project,
  );
  const today = dateToday();
  return (
    <div className="report-page feature-stack">
      <div className="section-heading">
        <div>
          <h1>{t("Reports")}</h1>
        </div>
        <button
          className="button secondary report-print"
          onClick={() => window.print()}
        >
          {t("Print report")}
        </button>
      </div>
      <div className="panel milestone-panel report-controls">
        <FiltersBar value={filters} onChange={setFilters} data={scoped} t={t} />
        <div className="report-filters">
          <label>
            {t("Created from")}
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            {t("Created through")}
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            {t("Due date")}
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label>
            {t("Task type")}
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">{t("All tasks")}</option>
              <option value="project">{t("Project tasks")}</option>
              <option value="personal">{t("Personal")}</option>
              <option value="subtask">{t("Subtasks")}</option>
            </select>
          </label>
          <label className="feature-row">
            <input
              type="checkbox"
              checked={blocked}
              onChange={(e) => setBlocked(e.target.checked)}
            />
            {t("Blocked work only")}
          </label>
          <button
            className="text-button"
            onClick={() => {
              setFilters(blankFilters);
              setFrom("");
              setTo("");
              setDueDate("");
              setKind("");
              setBlocked(false);
            }}
          >
            {t("Clear filters")}
          </button>
        </div>
      </div>
      {from && to && from > to && (
        <ErrorBox error={t("End date must follow start date.")} />
      )}
      <p className="helper">
        {t(
          "Charts and task tables use the selected filters. Project maps show full project context.",
        )}
      </p>
      <div className="report-metrics">
        {Object.entries(statusLabels).map(([status, label]) => (
          <div className="panel milestone-panel" key={status}>
            <span>{t(label)}</span>
            <strong>
              {tasks.filter((task) => task.status === status).length}
            </strong>
          </div>
        ))}
        <div className="panel milestone-panel">
          <span>{t("Blocked")}</span>
          <strong>{tasks.filter((task) => task.blocked).length}</strong>
        </div>
        <div className="panel milestone-panel">
          <span>{t("Overdue")}</span>
          <strong>
            {
              tasks.filter(
                (task) =>
                  task.dueDate &&
                  task.dueDate < today &&
                  task.status !== "done",
              ).length
            }
          </strong>
        </div>
      </div>
      <section className="panel milestone-panel">
        <h2>{t("Project progress")}</h2>
        <ProjectsChart
          projects={projects}
          tasks={tasks}
          t={t}
          lang={lang}
          today={today}
          onProject={(id) => setFilters({ ...filters, project: id })}
        />
      </section>
      <div className="milestone-grid">
        <section className="panel milestone-panel">
          <h2>{t("Tasks by Employee")}</h2>
          <EmployeeChart
            employees={scoped.employees}
            tasks={tasks}
            t={t}
            lang={lang}
            today={today}
          />
        </section>
        <section className="panel milestone-panel">
          <h2>{t("Tasks by Priority")}</h2>
          <PriorityChart tasks={tasks} t={t} lang={lang} today={today} />
        </section>
      </div>
      {scoped.tags.some((tag) => tasks.some((x) => x.tagIds.includes(tag.id))) && (
        <section className="panel milestone-panel">
          <h2>{t("Tasks by tag")}</h2>
          <div className="table-wrap">
            <table className="task-table tag-report">
              <thead>
                <tr>
                  <th className="task-col">{t("Tag")}</th>
                  <th>{t("Total tasks")}</th>
                  <th>{t("Open")}</th>
                  <th>{t("Done")}</th>
                  <th>{t("Overdue")}</th>
                </tr>
              </thead>
              <tbody>
                {scoped.tags
                  .map((tag) => ({
                    tag,
                    items: tasks.filter((x) => x.tagIds.includes(tag.id)),
                  }))
                  .filter((row) => row.items.length)
                  .sort((a, b) => b.items.length - a.items.length)
                  .map(({ tag, items }) => (
                    <tr key={tag.id}>
                      <td data-label={t("Tag")}>
                        <button
                          className="text-button"
                          onClick={() => setFilters({ ...filters, tag: tag.id })}
                          dir="auto"
                        >
                          #{tag.name}
                        </button>
                      </td>
                      <td data-label={t("Total tasks")}>{items.length}</td>
                      <td data-label={t("Open")}>
                        {items.filter((x) => x.status !== "done").length}
                      </td>
                      <td data-label={t("Done")}>
                        {items.filter((x) => x.status === "done").length}
                      </td>
                      <td data-label={t("Overdue")}>
                        {
                          items.filter(
                            (x) =>
                              x.dueDate &&
                              x.dueDate < today &&
                              x.status !== "done",
                          ).length
                        }
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {projects.map((project) => (
        <section key={project.id}>
          <h2 className="report-project-title">
            {project.name}
            <HealthBadge health={project.health} t={t} />
          </h2>
          <Milestones
            project={project}
            data={scoped}
            t={t}
            lang={lang}
            onOpen={onOpen}
            readOnly
          />
          <details>
            <summary>{t("Project Map")}</summary>
            <ProjectRoadmap
              project={project}
              tasks={scoped.tasks.filter(
                (task) => task.projectId === project.id,
              )}
              visibleTasks={tasks.filter(
                (task) => task.projectId === project.id,
              )}
              data={scoped}
              t={t}
              lang={lang}
              onOpen={onOpen}
              readOnly
            />
          </details>
        </section>
      ))}
      <section className="panel milestone-panel">
        <h2>{t("Dependencies / blocked work")}</h2>
        {!tasks.some((task) => task.blockedBy.length) && (
          <p>{t("No dependencies")}</p>
        )}
        {tasks
          .filter((task) => task.blockedBy.length)
          .map((task) => (
            <p key={task.id}>
              <button className="text-button" onClick={() => onOpen(task.id)}>
                {task.title}
              </button>{" "}
              · {t("Blocked by")}:{" "}
              {task.blockedBy
                .map((id) => scoped.tasks.find((item) => item.id === id)?.title)
                .join(", ")}{" "}
              {task.blocked && (
                <span className="badge blocked-badge">{t("Blocked")}</span>
              )}
            </p>
          ))}
      </section>
      <section className="panel milestone-panel">
        <h2>{t("Overdue Tasks")}</h2>
        <TaskList
          tasks={tasks
            .filter(
              (task) =>
                task.dueDate && task.dueDate < today && task.status !== "done",
            )
            .map((task) => ({ ...task, canEdit: false }))}
          data={scoped}
          t={t}
          lang={lang}
          onOpen={onOpen}
          onComplete={() => {}}
        />
      </section>
      <section className="panel milestone-panel">
        <h2>{t("Detailed Task Table")}</h2>
        <TaskList
          tasks={tasks.map((task) => ({ ...task, canEdit: false }))}
          data={scoped}
          t={t}
          lang={lang}
          onOpen={onOpen}
          onComplete={() => {}}
          detailed
        />
      </section>
    </div>
  );
}
