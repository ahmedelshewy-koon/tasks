"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Activity,
  Archive,
  CheckCircle2,
  Diamond,
  HeartPulse,
  Link2,
  MessageSquare,
  Plus,
  Repeat,
  UserPlus,
  Users,
} from "lucide-react";
import { request, type ProjectFeed, type Workspace } from "./api";
import { ErrorBox, Loading, type Translate } from "./primitives";
import type { Language } from "./i18n";
import { activityText } from "./activity-text";

const icons: Record<string, typeof Activity> = {
  task_created: Plus,
  task_completed: CheckCircle2,
  comment_created: MessageSquare,
  assignee_added: UserPlus,
  assignee_removed: Users,
  milestone_created: Diamond,
  milestone_updated: Diamond,
  dependency_added: Link2,
  dependency_removed: Link2,
  member_added: UserPlus,
  member_removed: Users,
  member_role_changed: Users,
  owner_changed: Users,
  health_overridden: HeartPulse,
  health_override_cleared: HeartPulse,
  project_archived: Archive,
  project_restored: Archive,
  task_archived: Archive,
  task_restored: Archive,
  task_deleted_permanently: Archive,
  recurrence_created: Repeat,
};

export function ProjectActivity({
  projectId,
  data,
  t,
  lang,
  onOpen,
  limit,
}: {
  projectId: string;
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
  limit?: number;
}) {
  const query = useInfiniteQuery({
    queryKey: ["workspace", "activity", projectId],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      request<ProjectFeed>(
        `/api/work?activity=${projectId}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) =>
      last.hasMore
        ? new Date(last.items.at(-1)!.createdAt).toISOString()
        : undefined,
  });
  if (query.isPending) return <Loading t={t} />;
  if (query.error) return <ErrorBox error={t(query.error.message)} />;
  const items = query.data.pages.flatMap((p) => p.items);
  const shown = limit ? items.slice(0, limit) : items;
  const person = (id: string) =>
    data.employees.find((e) => e.userId === id)?.name || t("Former member");
  const time = (value: Date | string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  if (!shown.length)
    return <p className="helper feed-empty">{t("No project activity yet.")}</p>;
  return (
    <div className="project-feed">
      <ol>
        {shown.map((item) => {
          const Icon = icons[item.action] ?? Activity;
          const detail = activityText(item, data, t, lang);
          return (
            <li key={item.id} className={`feed-item feed-${item.action}`}>
              <span className="feed-icon">
                <Icon size={14} />
              </span>
              <div>
                <p>
                  <strong>{item.actorName ?? person(item.userId)}</strong>{" "}
                  <span>{t(`feed:${item.action}`)}</span>
                  {item.taskId && item.taskTitle && (
                    <>
                      {" "}
                      <button
                        className="text-button feed-task"
                        onClick={() => onOpen(item.taskId!)}
                        dir="auto"
                      >
                        {item.taskTitle}
                      </button>
                    </>
                  )}
                </p>
                {detail && (
                  <small className="activity-values" dir="auto">
                    {detail}
                  </small>
                )}
                <time>{time(item.createdAt)}</time>
              </div>
            </li>
          );
        })}
      </ol>
      {!limit && query.hasNextPage && (
        <button
          className="button secondary small-button"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {t(query.isFetchingNextPage ? "Loading…" : "Show older activity")}
        </button>
      )}
    </div>
  );
}
