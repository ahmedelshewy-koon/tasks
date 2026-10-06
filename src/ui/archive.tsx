"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Folder, SquareCheck, Trash2 } from "lucide-react";
import { command, request, type Workspace } from "./api";
import { Empty, ErrorBox, Loading, type Translate } from "./primitives";
import type { Language } from "./i18n";
import { Confirm } from "./forms";
import { activityText } from "./activity-text";

type Target = { kind: "project" | "task"; id: string };

export function ArchivePage({
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
  const client = useQueryClient();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const [purging, setPurging] = useState<Target>();
  const { projects, tasks } = data.archive;
  const date = (value: Date | string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
      dateStyle: "medium",
    }).format(new Date(value));
  const projectName = (id: string | null) =>
    data.projects.find((p) => p.id === id)?.name ?? t("Personal");
  const restore = async (target: Target) => {
    setBusy(target.id);
    setError("");
    try {
      await command(
        target.kind === "project" ? "restoreProject" : "restoreTask",
        undefined,
        target.id,
      );
      await client.invalidateQueries({ queryKey: ["workspace"] });
      await client.invalidateQueries({ queryKey: ["archive-log"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  const actions = (target: Target) => (
    <div className="archive-actions">
      <button
        className="button secondary small-button"
        disabled={busy === target.id}
        onClick={() => restore(target)}
      >
        <ArchiveRestore size={14} />
        {t("Restore")}
      </button>
      {data.actor.isAdmin && (
        <button
          className="text-button danger-text"
          onClick={() => setPurging(target)}
        >
          <Trash2 size={14} />
          {t("Delete permanently")}
        </button>
      )}
    </div>
  );
  return (
    <>
      {error && <ErrorBox error={t(error)} />}
      <section className="panel archive-section">
        <div className="panel-header">
          <h2>
            <Folder size={16} />
            {t("Archived projects")}
            <span className="count">{projects.length}</span>
          </h2>
        </div>
        {!projects.length ? (
          <p className="helper archive-empty">{t("No archived projects.")}</p>
        ) : (
          <ul className="archive-list">
            {projects.map((p) => (
              <li key={p.id}>
                <div>
                  <strong dir="auto">{p.name}</strong>
                  <small className="muted">
                    {p.taskCount} {t("tasks")} · {t("Archived")}{" "}
                    {date(p.archivedAt)}
                  </small>
                </div>
                {actions({ kind: "project", id: p.id })}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel archive-section">
        <div className="panel-header">
          <h2>
            <SquareCheck size={16} />
            {t("Archived tasks")}
            <span className="count">{tasks.length}</span>
          </h2>
        </div>
        {!tasks.length ? (
          <p className="helper archive-empty">{t("No archived tasks.")}</p>
        ) : (
          <ul className="archive-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <div>
                  <button
                    className="task-title"
                    onClick={() => onOpen(task.id)}
                    dir="auto"
                  >
                    {task.parentId && <span className="subtask-mark">↳ </span>}
                    {task.title}
                  </button>
                  <small className="muted">
                    {projectName(task.projectId)}
                    {task.subtaskCount > 0 &&
                      ` · ${task.subtaskCount} ${t("subtasks")}`}
                    {" · "}
                    {t("Archived")} {date(task.archivedAt)}
                  </small>
                </div>
                {actions({ kind: "task", id: task.id })}
              </li>
            ))}
          </ul>
        )}
      </section>
      {!projects.length && !tasks.length && (
        <div className="panel">
          <Empty
            title={t("Nothing archived")}
            description={t(
              "Archived projects and tasks you manage will appear here until they are restored or deleted.",
            )}
          />
        </div>
      )}
      {data.actor.isAdmin && <ArchiveLog data={data} t={t} lang={lang} />}
      {purging && (
        <Confirm
          t={t}
          action="purge"
          onClose={() => setPurging(undefined)}
          onConfirm={async () => {
            await command(
              purging.kind === "project" ? "purgeProject" : "purgeTask",
              undefined,
              purging.id,
            );
            await client.invalidateQueries({ queryKey: ["workspace"] });
            await client.invalidateQueries({ queryKey: ["archive-log"] });
          }}
        />
      )}
    </>
  );
}

function ArchiveLog({
  data,
  t,
  lang,
}: {
  data: Workspace;
  t: Translate;
  lang: Language;
}) {
  const query = useQuery({
    queryKey: ["archive-log"],
    queryFn: () =>
      request<
        {
          id: string;
          action: string;
          userId: string;
          before: unknown;
          after: unknown;
          createdAt: string;
          actorName: string | null;
        }[]
      >("/api/work?archiveLog=1"),
  });
  return (
    <section className="panel archive-section">
      <div className="panel-header">
        <h2>{t("Archive history")}</h2>
        <span className="muted small-text">{t("Admins only")}</span>
      </div>
      {query.isPending ? (
        <Loading t={t} />
      ) : query.error ? (
        <ErrorBox error={t(query.error.message)} />
      ) : !query.data.length ? (
        <p className="helper archive-empty">{t("No archive activity yet.")}</p>
      ) : (
        <ul className="archive-list archive-log">
          {query.data.map((row) => {
            const name =
              (row.after as { name?: string; title?: string } | null)?.name ??
              (row.after as { title?: string } | null)?.title ??
              activityText(row, data, t, lang);
            return (
              <li key={row.id}>
                <div>
                  <span>
                    <strong>
                      {row.actorName ?? t("Former member")}
                    </strong>{" "}
                    {t(`feed:${row.action}`)}{" "}
                    <span dir="auto">{name}</span>
                  </span>
                  <small className="muted">
                    {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(row.createdAt))}
                  </small>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
