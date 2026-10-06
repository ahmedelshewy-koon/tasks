import { reportIds } from "../hr/hierarchy";
import {
  type Actor,
  type ProjectAccess,
  type ProjectRole,
  type TaskAccess,
  type Status,
  requireAccess,
} from "../shared/types";
export type EffectiveRole = "admin" | "owner" | ProjectRole;
export function memberRole(p: ProjectAccess, id: string): EffectiveRole | null {
  if (p.ownerId === id) return "owner";
  if (!p.memberIds.includes(id)) return null;
  return p.roles?.[id] ?? "member";
}
export function projectRole(a: Actor, p: ProjectAccess): EffectiveRole | null {
  return a.isAdmin ? "admin" : memberRole(p, a.userId);
}
// Owner, project manager or admin: manages tasks, sections, milestones, members.
export const canManageProject = (a: Actor, p: ProjectAccess) =>
  ["admin", "owner", "project_manager"].includes(projectRole(a, p) ?? "");
// Owner or admin: ownership changes and project manager appointments.
export const canOwnProject = (a: Actor, p: ProjectAccess) =>
  a.isAdmin || p.ownerId === a.userId;
export const canViewProject = (a: Actor, p: ProjectAccess) =>
  projectRole(a, p) !== null;
// Everyone except viewers can add work and join the conversation.
export const canContribute = (a: Actor, p: ProjectAccess) =>
  !["viewer", null].includes(projectRole(a, p));
// Viewers are read-only, so they never hold assignments.
export const isAssignable = (p: ProjectAccess, id: string) =>
  !["viewer", null].includes(memberRole(p, id));
export function canViewTask(
  a: Actor,
  t: TaskAccess,
  p: ProjectAccess | null,
): boolean {
  if (a.isAdmin) return true;
  if (!t.projectId)
    return t.creatorId === a.userId || t.assigneeIds.includes(a.userId);
  return !!p && canViewProject(a, p);
}
export function canEditTask(a: Actor, t: TaskAccess, p: ProjectAccess | null) {
  return (
    canViewTask(a, t, p) &&
    (a.isAdmin ||
      (!!p && canManageProject(a, p)) ||
      canReassignTask(a, t, p) ||
      (t.assigneeIds.includes(a.userId) && (!p || canContribute(a, p))))
  );
}
export function canReassignTask(
  a: Actor,
  t: TaskAccess,
  p: ProjectAccess | null,
) {
  return (
    canViewTask(a, t, p) &&
    (a.isAdmin ||
      (!!p && canManageProject(a, p)) ||
      (t.creatorId === a.userId &&
        reportIds(a).length > 0 &&
        (!p || canContribute(a, p))))
  );
}
export function canComment(a: Actor, t: TaskAccess, p: ProjectAccess | null) {
  return (
    canViewTask(a, t, p) &&
    (!p || canContribute(a, p) || t.assigneeIds.includes(a.userId))
  );
}
// Project tasks can be archived by project managers; personal tasks by their creator.
export function canArchiveTask(
  a: Actor,
  t: TaskAccess,
  p: ProjectAccess | null,
) {
  if (a.isAdmin) return true;
  return p ? canManageProject(a, p) : t.creatorId === a.userId;
}
export function canAssignTo(a: Actor, id: string, p: ProjectAccess | null) {
  // Tasks without a project follow the HR hierarchy only.
  if (!p) return a.isAdmin || id === a.userId || reportIds(a).includes(id);
  // Membership is already HR-validated, so project managers assign any member.
  return (
    canContribute(a, p) &&
    isAssignable(p, id) &&
    (canManageProject(a, p) || id === a.userId || reportIds(a).includes(id))
  );
}
export function validateAssignees(
  a: Actor,
  ids: string[],
  p: ProjectAccess | null,
) {
  requireAccess(ids.length > 0, "Choose at least one assignee.");
  if (!p) {
    requireAccess(
      ids.every((id) => canAssignTo(a, id, null)),
      "You can assign tasks only to yourself or employees below you in the organization.",
    );
    return;
  }
  requireAccess(
    ids.every((id) => memberRole(p, id) !== null),
    "Assignees must belong to the project.",
  );
  requireAccess(
    ids.every((id) => isAssignable(p, id)),
    "Viewers cannot be assigned work.",
  );
  requireAccess(
    ids.every((id) => canAssignTo(a, id, p)),
    "You can assign tasks only to yourself or employees below you in the organization.",
  );
}
export function aggregateStatus(
  current: Status,
  completed: boolean[],
  childStatuses: Status[],
): Status {
  const allParts = completed.length > 0 && completed.every(Boolean);
  const allChildren = childStatuses.every((s) => s === "done");
  if (allParts && allChildren) return "done";
  if (
    completed.some(Boolean) ||
    childStatuses.some((s) => s !== "todo") ||
    current === "in_progress"
  )
    return "in_progress";
  return "todo";
}
export const progress = (statuses: Status[]) =>
  statuses.length
    ? Math.round(
        (statuses.filter((s) => s === "done").length / statuses.length) * 100,
      )
    : 0;
