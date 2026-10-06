import type { Workspace } from "./api";
import type { Translate } from "./primitives";
import { priorityLabels, statusLabels, type Language } from "./i18n";
import { formatDate, recurrenceLabels } from "./task-views";

export const roleLabels: Record<string, string> = {
  admin: "Admin",
  owner: "Owner",
  project_manager: "Project manager",
  member: "Member",
  viewer: "Viewer",
};
export const healthLabels: Record<string, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  completed: "Completed",
};
type Event = { action: string; before: unknown; after: unknown };
const record = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

// Human-readable detail for an activity entry, or null when the action says it all.
export function activityText(
  event: Event,
  data: Workspace,
  t: Translate,
  lang: Language,
): string | null {
  const person = (id: unknown) =>
    typeof id === "string"
      ? (data.employees.find((e) => e.userId === id)?.name ?? id)
      : "";
  const pair = (before: string | null, after: string | null) =>
    before && after ? `${before} → ${after}` : (after ?? before);
  const { before, after } = event;
  switch (event.action) {
    case "assignee_added":
    case "assignee_removed":
    case "part_completed":
      return person(
        typeof (after ?? before) === "string"
          ? (after ?? before)
          : record(after).userId,
      );
    case "part_reopened":
      return person(record(after).userId);
    case "member_added":
      return `${person(record(after).userId)} · ${t(roleLabels[String(record(after).role)] ?? "Member")}`;
    case "member_removed":
      return person(record(before).userId);
    case "member_role_changed":
      return `${person(record(after).userId)}: ${t(roleLabels[String(record(before).role)])} → ${t(roleLabels[String(record(after).role)])}`;
    case "owner_changed":
      return pair(person(record(before).userId), person(record(after).userId));
    case "health_overridden":
    case "health_override_cleared":
      return pair(
        before ? t(healthLabels[String(before)]) : t("Automatic"),
        after ? t(healthLabels[String(after)]) : t("Automatic"),
      );
    case "field_changed": {
      const b = record(before);
      const a = record(after);
      return `${a.field ?? b.field}: ${b.value ?? "—"} → ${a.value ?? "—"}`;
    }
    case "status_changed":
    case "task_completed":
    case "project_status_changed": {
      const label = (v: unknown) =>
        v === "completion_requested"
          ? t("Completion requested")
          : v === "active" || v === "completed"
            ? t(v === "active" ? "Active" : "Completed")
            : t(statusLabels[v as keyof typeof statusLabels] ?? String(v));
      return pair(
        before == null ? null : label(before),
        after == null ? null : label(after),
      );
    }
    case "priority_changed":
      return pair(
        t(priorityLabels[before as keyof typeof priorityLabels] ?? ""),
        t(priorityLabels[after as keyof typeof priorityLabels] ?? ""),
      );
    case "due_date_changed":
      return pair(
        before ? formatDate(String(before), t, lang) : t("No due date"),
        after ? formatDate(String(after), t, lang) : t("No due date"),
      );
    case "recurrence_changed": {
      const label = (v: unknown) =>
        v
          ? t(recurrenceLabels[v as keyof typeof recurrenceLabels])
          : t("Does not repeat");
      return pair(label(before), label(after));
    }
    case "recurrence_created":
      return `${t("Next due")}: ${formatDate(String(record(after).dueDate), t, lang)}`;
    case "section_changed": {
      const name = (id: unknown) =>
        data.projects
          .flatMap((p) => p.sections)
          .find((section) => section.id === id)?.name ?? t("No section");
      return pair(name(before), name(after));
    }
    case "project_created":
      return record(after).template
        ? `${t("From template")}: ${record(after).template}`
        : null;
    case "task_deleted_permanently":
    case "project_deleted_permanently":
      return String(record(before).title ?? record(before).name ?? "");
    case "task_created":
      return record(after).recurringFrom ? t("Next occurrence") : null;
    case "comment_created":
    case "task_archived":
    case "task_restored":
    case "project_archived":
    case "project_restored":
      return null;
    case "description_changed": {
      const text = String(after ?? "");
      return text.length > 80 ? `${text.slice(0, 80)}…` : text || null;
    }
    default: {
      const show = (v: unknown) =>
        v === null || v === undefined
          ? null
          : typeof v === "string" || typeof v === "number"
            ? String(v)
            : JSON.stringify(v);
      return pair(show(before), show(after));
    }
  }
}
