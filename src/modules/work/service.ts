import { reminderKind } from "./reminders";
import {
  dateValue,
  fieldInput,
  tagNames,
  viewInput,
  projectInput,
  projectPatch,
  taskInput,
  taskPatch,
} from "./validation";
import { mentionedIds } from "./mentions";
import {
  captureTemplate,
  templateContent,
  templateSummary,
  type TemplateContent,
} from "./templates";
import { reportIds, subordinateUserIds } from "../hr/hierarchy";
import { and, eq, inArray, isNull, desc, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db";
import * as s from "../../db/schema";
import {
  AppError,
  requireAccess,
  type Actor,
  type Employee,
  type ProjectRole,
} from "../shared/types";
import {
  aggregateStatus,
  canArchiveTask,
  canComment,
  canContribute,
  canEditTask,
  canReassignTask,
  canManageProject,
  canOwnProject,
  canViewProject,
  canViewTask,
  isAssignable,
  progress,
  projectRole,
  validateAssignees,
} from "../tasks/policy";
import { suggestHealth } from "../tasks/health";
import { addDays, cairoToday, nextDueDate } from "../tasks/recurrence";

// Project feed: meaningful delivery events only. Edits such as checklist ticks,
// descriptions, reminders and attachments stay in each task's own history.
export const FEED_ACTIONS = [
  "project_created",
  "project_status_changed",
  "task_created",
  "task_completed",
  "status_changed",
  "comment_created",
  "assignee_added",
  "assignee_removed",
  "milestone_created",
  "milestone_updated",
  "dependency_added",
  "dependency_removed",
  "member_added",
  "member_removed",
  "member_role_changed",
  "owner_changed",
  "health_overridden",
  "health_override_cleared",
  "project_archived",
  "project_restored",
  "task_archived",
  "task_restored",
  "task_deleted_permanently",
  "recurrence_created",
];
const ARCHIVE_ACTIONS = [
  "project_archived",
  "project_restored",
  "project_deleted_permanently",
  "task_archived",
  "task_restored",
  "task_deleted_permanently",
];
const groupBy = <T, K>(rows: T[], key: (row: T) => K) => {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
};

export function createService(
  db: Database,
  actor: Actor,
  directory: Employee[],
) {
  async function register(ids: string[]) {
    const entries = [...new Set(ids)].map((id) => {
      const employee = directory.find((e) => e.userId === id);
      if (!employee)
        throw new AppError(400, "Employee is not available from HR.");
      return { id, employeeId: employee.employeeId };
    });
    if (entries.length)
      await db.insert(s.users).values(entries).onConflictDoNothing();
  }
  async function project(
    id: string,
    source: Database = db,
    allowArchived = false,
  ) {
    const [p] = await source
      .select()
      .from(s.projects)
      .where(and(eq(s.projects.id, id), isNull(s.projects.deletedAt)));
    if (!p) throw new AppError(404, "Project not found.");
    if (p.archivedAt && !allowArchived)
      throw new AppError(
        409,
        "This project is archived. Restore it to make changes.",
      );
    const rows = await source
      .select()
      .from(s.members)
      .where(eq(s.members.projectId, id));
    return {
      ...p,
      memberIds: rows.map((m) => m.userId),
      roles: Object.fromEntries(rows.map((m) => [m.userId, m.role])) as Record<
        string,
        ProjectRole
      >,
    };
  }
  async function task(id: string, edit = false, source: Database = db) {
    const [t] = await source
      .select()
      .from(s.tasks)
      .where(and(eq(s.tasks.id, id), isNull(s.tasks.deletedAt)));
    if (!t) throw new AppError(404, "Task not found.");
    const assigned = await source
      .select()
      .from(s.assignees)
      .where(eq(s.assignees.taskId, id));
    const p = t.projectId ? await project(t.projectId, source, true) : null;
    let parentArchived = false;
    if (t.parentId) {
      const [parent] = await source
        .select({ deletedAt: s.tasks.deletedAt, archivedAt: s.tasks.archivedAt })
        .from(s.tasks)
        .where(eq(s.tasks.id, t.parentId));
      if (!parent || parent.deletedAt)
        throw new AppError(404, "Task not found.");
      parentArchived = !!parent.archivedAt;
    }
    const archived = !!(t.archivedAt || parentArchived || p?.archivedAt);
    const item = { ...t, assigneeIds: assigned.map((a) => a.userId) };
    requireAccess(
      edit ? canEditTask(actor, item, p) : canViewTask(actor, item, p),
    );
    if (edit && archived)
      throw new AppError(409, "Restore this task before making changes.");
    return {
      ...item,
      assignments: assigned,
      project: p,
      archived,
      parentArchived,
    };
  }
  async function log(
    tx: Database,
    taskId: string,
    action: string,
    before: unknown = null,
    after: unknown = null,
  ) {
    const [row] = await tx
      .select({ projectId: s.tasks.projectId })
      .from(s.tasks)
      .where(eq(s.tasks.id, taskId));
    await tx.insert(s.activity).values({
      taskId,
      projectId: row?.projectId ?? null,
      userId: actor.userId,
      action,
      before,
      after,
    });
  }
  async function projectLog(
    tx: Database,
    projectId: string | null,
    action: string,
    before: unknown = null,
    after: unknown = null,
  ) {
    await tx
      .insert(s.activity)
      .values({ projectId, userId: actor.userId, action, before, after });
  }
  async function notify(
    tx: Database,
    taskId: string,
    ids: string[],
    kind: string,
    message: string,
  ) {
    const values = [...new Set(ids)]
      .filter((id) => id !== actor.userId)
      .map((userId) => ({ userId, taskId, kind, message }));
    if (values.length) await tx.insert(s.notifications).values(values);
  }
  async function applyTags(tx: Database, taskId: string, names: string[]) {
    const current = await tx
      .select({ tagId: s.taskTags.tagId, name: s.tags.name })
      .from(s.taskTags)
      .innerJoin(s.tags, eq(s.tags.id, s.taskTags.tagId))
      .where(eq(s.taskTags.taskId, taskId));
    const wanted: { id: string; name: string }[] = [];
    for (const name of names) {
      const find = () =>
        tx
          .select()
          .from(s.tags)
          .where(sql`lower(${s.tags.name}) = lower(${name})`);
      let [tag] = await find();
      if (!tag) {
        await tx
          .insert(s.tags)
          .values({ name, createdBy: actor.userId })
          .onConflictDoNothing();
        [tag] = await find();
      }
      wanted.push(tag);
    }
    const removed = current.filter(
      (c) => !wanted.some((w) => w.id === c.tagId),
    );
    const added = wanted.filter((w) => !current.some((c) => c.tagId === w.id));
    if (removed.length)
      await tx.delete(s.taskTags).where(
        and(
          eq(s.taskTags.taskId, taskId),
          inArray(
            s.taskTags.tagId,
            removed.map((r) => r.tagId),
          ),
        ),
      );
    if (added.length)
      await tx
        .insert(s.taskTags)
        .values(added.map((tag) => ({ taskId, tagId: tag.id })));
    for (const tag of added) await log(tx, taskId, "tag_added", null, tag.name);
    for (const tag of removed)
      await log(tx, taskId, "tag_removed", tag.name, null);
  }
  // A completed recurring task creates its next occurrence exactly once.
  async function spawnRecurrence(
    tx: Database,
    t: typeof s.tasks.$inferSelect,
    assigneeIds: string[],
  ) {
    if (!t.recurrence) return;
    let ids = assigneeIds;
    if (t.projectId) {
      const [p] = await tx
        .select()
        .from(s.projects)
        .where(eq(s.projects.id, t.projectId));
      if (!p || p.archivedAt || p.deletedAt) return;
      const rows = await tx
        .select()
        .from(s.members)
        .where(eq(s.members.projectId, p.id));
      const access = {
        ownerId: p.ownerId,
        memberIds: rows.map((m) => m.userId),
        roles: Object.fromEntries(rows.map((m) => [m.userId, m.role])),
      };
      ids = ids.filter((id) => isAssignable(access, id));
    }
    if (!ids.length) {
      await log(tx, t.id, "recurrence_stopped");
      return;
    }
    const today = cairoToday();
    const dueDate = nextDueDate(t.dueDate ?? today, t.recurrence, today);
    const [next] = await tx
      .insert(s.tasks)
      .values({
        title: t.title,
        description: t.description,
        projectId: t.projectId,
        sectionId: t.sectionId,
        creatorId: t.creatorId,
        priority: t.priority,
        dueDate,
        reminderMinutes: t.reminderMinutes,
        recurrence: t.recurrence,
      })
      .returning();
    await tx
      .insert(s.assignees)
      .values(ids.map((userId) => ({ taskId: next.id, userId })));
    const items = await tx
      .select()
      .from(s.checklist)
      .where(eq(s.checklist.taskId, t.id));
    if (items.length)
      await tx.insert(s.checklist).values(
        items.map((item) => ({
          taskId: next.id,
          title: item.title,
          position: item.position,
        })),
      );
    const tagRows = await tx
      .select()
      .from(s.taskTags)
      .where(eq(s.taskTags.taskId, t.id));
    if (tagRows.length)
      await tx
        .insert(s.taskTags)
        .values(tagRows.map((row) => ({ taskId: next.id, tagId: row.tagId })));
    await tx
      .update(s.tasks)
      .set({ recurrenceNextId: next.id })
      .where(eq(s.tasks.id, t.id));
    await log(tx, next.id, "task_created", null, {
      title: next.title,
      recurringFrom: t.id,
    });
    await log(tx, t.id, "recurrence_created", null, {
      taskId: next.id,
      title: next.title,
      dueDate,
    });
    await notify(tx, next.id, ids, "assignment", next.title);
  }
  async function recompute(tx: Database, id: string) {
    const [t] = await tx.select().from(s.tasks).where(eq(s.tasks.id, id));
    if (!t || t.deletedAt || t.archivedAt) return;
    const assignments = await tx
      .select()
      .from(s.assignees)
      .where(eq(s.assignees.taskId, id));
    const children = await tx
      .select()
      .from(s.tasks)
      .where(
        and(
          eq(s.tasks.parentId, id),
          isNull(s.tasks.deletedAt),
          isNull(s.tasks.archivedAt),
        ),
      );
    const status = aggregateStatus(
      t.status,
      assignments.map((a) => a.completed),
      children.map((c) => c.status),
    );
    if (status !== t.status) {
      await tx
        .update(s.tasks)
        .set({ status, updatedAt: new Date() })
        .where(eq(s.tasks.id, id));
      await log(
        tx,
        id,
        status === "done" ? "task_completed" : "status_changed",
        t.status,
        status,
      );
      if (status === "done" && !t.parentId && !t.recurrenceNextId)
        await spawnRecurrence(
          tx,
          t,
          assignments.map((a) => a.userId),
        );
    }
  }
  async function lockProject(tx: Database, id: string) {
    await tx.execute(sql`select id from projects where id = ${id} for update`);
  }
  // Lock project, then parent, then task, matching every other mutation.
  async function lockTask(tx: Database, id: string) {
    const [t] = await tx.select().from(s.tasks).where(eq(s.tasks.id, id));
    if (t?.projectId) await lockProject(tx, t.projectId);
    if (t?.parentId)
      await tx.execute(
        sql`select id from tasks where id = ${t.parentId} for update`,
      );
    await tx.execute(sql`select id from tasks where id = ${id} for update`);
    return t;
  }
  // Lock the parent first for every child mutation so sibling changes cannot deadlock or lose rollups.
  async function locked<T>(
    id: string,
    fn: (tx: Database) => Promise<T>,
    edit = true,
  ) {
    return db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const t = await lockTask(tx, id);
      await task(id, edit, tx);
      const result = await fn(tx);
      await recompute(tx, id);
      if (t?.parentId) await recompute(tx, t.parentId);
      return result;
    });
  }
  // Removes a task and everything that belongs only to it. Admin-only callers.
  async function purgeTasks(tx: Database, ids: string[]) {
    if (!ids.length) return;
    await tx
      .delete(s.notifications)
      .where(inArray(s.notifications.taskId, ids));
    await tx.delete(s.activity).where(inArray(s.activity.taskId, ids));
    await tx.delete(s.comments).where(inArray(s.comments.taskId, ids));
    await tx.delete(s.attachments).where(inArray(s.attachments.taskId, ids));
    await tx.delete(s.checklist).where(inArray(s.checklist.taskId, ids));
    await tx.delete(s.assignees).where(inArray(s.assignees.taskId, ids));
    await tx.delete(s.taskTags).where(inArray(s.taskTags.taskId, ids));
    await tx.delete(s.fieldValues).where(inArray(s.fieldValues.taskId, ids));
    await tx
      .delete(s.dependencies)
      .where(
        or(
          inArray(s.dependencies.taskId, ids),
          inArray(s.dependencies.blockerId, ids),
        ),
      );
    await tx
      .update(s.tasks)
      .set({ recurrenceNextId: null })
      .where(inArray(s.tasks.recurrenceNextId, ids));
    await tx.delete(s.tasks).where(inArray(s.tasks.id, ids));
  }
  // Project owner's HR team plus the acting manager's own reports.
  function memberPool(p: { ownerId: string }) {
    const owner = directory.find((e) => e.userId === p.ownerId);
    return new Set([
      ...reportIds(actor),
      ...(owner ? subordinateUserIds(owner, directory) : []),
    ]);
  }
  const mentionable = (t: {
    project: { ownerId: string; memberIds: string[] } | null;
    creatorId: string;
    assigneeIds: string[];
  }) =>
    t.project
      ? [t.project.ownerId, ...t.project.memberIds]
      : [t.creatorId, ...t.assigneeIds];
  const canCreateTemplates = actor.isAdmin || reportIds(actor).length > 0;

  async function build() {
    const today = cairoToday();
    const [
      ps,
      ms,
      ts,
      assignmentRows,
      sectionRows,
      notes,
      milestoneRows,
      dependencyRows,
      checklistRows,
      projectLogs,
      tagRows,
      taskTagRows,
      fieldRows,
      valueRows,
      viewRows,
      templateRows,
    ] = await Promise.all([
      db.select().from(s.projects).where(isNull(s.projects.deletedAt)),
      db.select().from(s.members),
      db.select().from(s.tasks).where(isNull(s.tasks.deletedAt)),
      db.select().from(s.assignees),
      db.select().from(s.sections),
      db
        .select()
        .from(s.notifications)
        .where(eq(s.notifications.userId, actor.userId))
        .orderBy(desc(s.notifications.createdAt)),
      db.select().from(s.milestones),
      db.select().from(s.dependencies),
      db.select().from(s.checklist),
      // Project-level events only; task events load through the activity feed.
      db
        .select()
        .from(s.activity)
        .where(
          and(
            sql`${s.activity.projectId} is not null`,
            isNull(s.activity.taskId),
          ),
        )
        .orderBy(desc(s.activity.createdAt)),
      db.select().from(s.tags),
      db.select().from(s.taskTags),
      db.select().from(s.fields),
      db.select().from(s.fieldValues),
      db
        .select()
        .from(s.savedViews)
        .where(eq(s.savedViews.userId, actor.userId))
        .orderBy(s.savedViews.createdAt),
      db.select().from(s.templates).orderBy(desc(s.templates.updatedAt)),
    ]);
    const membersBy = groupBy(ms, (m) => m.projectId);
    const allProjects = ps
      .map((p) => {
        const rows = membersBy.get(p.id) ?? [];
        return {
          ...p,
          memberIds: rows.map((m) => m.userId),
          roles: Object.fromEntries(
            rows.map((m) => [m.userId, m.role]),
          ) as Record<string, ProjectRole>,
        };
      })
      .filter((p) => canViewProject(actor, p));
    const projectById = new Map(allProjects.map((p) => [p.id, p]));
    const rawById = new Map(ts.map((t) => [t.id, t]));
    const assignmentsBy = groupBy(assignmentRows, (a) => a.taskId);
    const visible = ts
      .map((t) => {
        const assignments = assignmentsBy.get(t.id) ?? [];
        return {
          ...t,
          assignments,
          assigneeIds: assignments.map((a) => a.userId),
        };
      })
      .filter(
        (t) =>
          canViewTask(
            actor,
            t,
            (t.projectId && projectById.get(t.projectId)) || null,
          ) &&
          (!t.projectId || projectById.has(t.projectId)) &&
          (!t.parentId || rawById.has(t.parentId)),
      );
    const isArchived = (t: (typeof visible)[number]) =>
      !!(
        t.archivedAt ||
        (t.parentId && rawById.get(t.parentId)?.archivedAt) ||
        (t.projectId && projectById.get(t.projectId)?.archivedAt)
      );
    const childrenBy = groupBy(
      visible.filter((t) => t.parentId),
      (t) => t.parentId,
    );
    const depsByTask = groupBy(dependencyRows, (d) => d.taskId);
    const depsByBlocker = groupBy(dependencyRows, (d) => d.blockerId);
    const checklistBy = groupBy(checklistRows, (c) => c.taskId);
    const tagsBy = groupBy(taskTagRows, (r) => r.taskId);
    const valuesBy = groupBy(valueRows, (v) => v.taskId);
    const statusOf = new Map(visible.map((t) => [t.id, t.status]));
    const enrich = (t: (typeof visible)[number], pool: Set<string>) => {
      const p = (t.projectId && projectById.get(t.projectId)) || null;
      const archived = isArchived(t);
      const children = (childrenBy.get(t.id) ?? []).filter((c) =>
        pool.has(c.id),
      );
      return {
        ...t,
        archived,
        progress: children.length
          ? progress(children.map((c) => c.status))
          : Math.round(
              (t.assignments.filter((a) => a.completed).length /
                Math.max(t.assignments.length, 1)) *
                100,
            ),
        blockedBy: (depsByTask.get(t.id) ?? [])
          .filter((d) => pool.has(d.blockerId))
          .map((d) => d.blockerId),
        blocks: (depsByBlocker.get(t.id) ?? [])
          .filter((d) => pool.has(d.taskId))
          .map((d) => d.taskId),
        blocked: (depsByTask.get(t.id) ?? []).some(
          (d) => pool.has(d.blockerId) && statusOf.get(d.blockerId) !== "done",
        ),
        checklist: (checklistBy.get(t.id) ?? []).sort(
          (a, b) => a.position - b.position || a.id.localeCompare(b.id),
        ),
        tagIds: (tagsBy.get(t.id) ?? []).map((r) => r.tagId),
        fieldValues: Object.fromEntries(
          (valuesBy.get(t.id) ?? []).map((v) => [v.fieldId, v.value]),
        ) as Record<string, string>,
        subtaskCount: children.length,
        canEdit: !archived && canEditTask(actor, t, p),
        canComment: !archived && canComment(actor, t, p),
        canArchive: canArchiveTask(actor, t, p),
      };
    };
    const active = visible.filter((t) => !isArchived(t));
    const activeIds = new Set(active.map((t) => t.id));
    const enriched = active.map((t) => enrich(t, activeIds));
    const sectionsBy = groupBy(sectionRows, (x) => x.projectId);
    const fieldsBy = groupBy(fieldRows, (f) => f.projectId);
    const topBy = groupBy(
      enriched.filter((t) => t.projectId && !t.parentId),
      (t) => t.projectId!,
    );
    const activeProjects = allProjects.filter((p) => !p.archivedAt);
    const visibleTagIds = new Set(
      taskTagRows.filter((r) => rawById.has(r.taskId)).map((r) => r.tagId),
    );
    const projects = activeProjects.map((p) => {
      const top = topBy.get(p.id) ?? [];
      const pct = progress(top.map((t) => t.status));
      const overdueTasks = top.filter(
        (t) => t.dueDate && t.dueDate < today && t.status !== "done",
      ).length;
      const overdueMilestones = milestoneRows.filter(
        (m) =>
          m.projectId === p.id && m.status === "upcoming" && m.dueDate < today,
      ).length;
      const suggested = suggestHealth({
        status: p.status,
        total: top.length,
        progress: pct,
        overdueTasks,
        overdueMilestones,
        startDate: p.startDate,
        dueDate: p.dueDate,
        today,
      });
      return {
        ...p,
        myRole: projectRole(actor, p),
        canManage: canManageProject(actor, p),
        canOwn: canOwnProject(actor, p),
        canContribute: canContribute(actor, p),
        progress: pct,
        taskCount: top.length,
        overdueTasks,
        overdueMilestones,
        suggestedHealth: suggested.health,
        healthReasons: suggested.reasons,
        health: p.healthOverride ?? suggested.health,
        sections: (sectionsBy.get(p.id) ?? []).sort(
          (a, b) => a.position - b.position,
        ),
        fields: (fieldsBy.get(p.id) ?? []).sort(
          (a, b) => a.position - b.position || a.name.localeCompare(b.name),
        ),
      };
    });
    const activeProjectIds = new Set(activeProjects.map((p) => p.id));
    // Project managers may add people from the owner's team, so they see it.
    const ownerTeams = new Set(
      activeProjects
        .filter((p) => projectRole(actor, p) === "project_manager")
        .flatMap((p) => [...memberPool(p)]),
    );
    const output = {
      actor,
      today,
      canCreateTemplates,
      // Who each managed project's members may be drawn from (admins: anyone).
      memberPools: Object.fromEntries(
        activeProjects
          .filter((p) => canManageProject(actor, p) && !actor.isAdmin)
          .map((p) => [p.id, [...memberPool(p)]]),
      ) as Record<string, string[]>,
      employees: directory.filter(
        (e) =>
          actor.isAdmin ||
          e.userId === actor.userId ||
          reportIds(actor).includes(e.userId) ||
          ownerTeams.has(e.userId) ||
          allProjects.some(
            (p) => p.ownerId === e.userId || p.memberIds.includes(e.userId),
          ),
      ),
      projects,
      milestones: milestoneRows.filter((m) => activeProjectIds.has(m.projectId)),
      projectActivity: projectLogs.filter(
        (l) => l.projectId && activeProjectIds.has(l.projectId),
      ),
      tasks: enriched,
      tags: tagRows
        .filter((tag) => visibleTagIds.has(tag.id) || tag.createdBy === actor.userId)
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      savedViews: viewRows,
      templates: templateRows.map((row) => {
        const content = row.content as TemplateContent;
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          createdBy: row.createdBy,
          updatedAt: row.updatedAt,
          content,
          summary: templateSummary(content),
          canEdit: actor.isAdmin || row.createdBy === actor.userId,
        };
      }),
      archive: {
        projects: allProjects
          .filter((p) => p.archivedAt && canManageProject(actor, p))
          .map((p) => ({
            id: p.id,
            name: p.name,
            ownerId: p.ownerId,
            archivedAt: p.archivedAt!,
            taskCount: visible.filter((t) => t.projectId === p.id && !t.parentId)
              .length,
          })),
        tasks: visible
          .filter(
            (t) =>
              t.archivedAt &&
              !(t.parentId && rawById.get(t.parentId)?.archivedAt) &&
              !(t.projectId && projectById.get(t.projectId)?.archivedAt) &&
              canArchiveTask(
                actor,
                t,
                (t.projectId && projectById.get(t.projectId)) || null,
              ),
          )
          .map((t) => ({
            id: t.id,
            title: t.title,
            projectId: t.projectId,
            parentId: t.parentId,
            status: t.status,
            archivedAt: t.archivedAt!,
            subtaskCount: (childrenBy.get(t.id) ?? []).length,
          })),
      },
      notifications: notes.filter((n) => activeIds.has(n.taskId)),
    };
    return { output, visible, enrich };
  }

  const api = {
    async setDependency(id: string, input: unknown) {
      const data = z
        .object({ blockerId: z.uuid(), enabled: z.boolean() })
        .parse(input);
      return locked(id, async (tx) => {
        const current = await task(id, true, tx);
        requireAccess(
          actor.isAdmin ||
            (!!current.project && canManageProject(actor, current.project)),
        );
        const blocker = await task(data.blockerId, false, tx);
        if (!current.projectId || blocker.projectId !== current.projectId)
          throw new AppError(
            400,
            "Dependencies must belong to the same project.",
          );
        const edges = await tx.select().from(s.dependencies);
        if (data.enabled) {
          const pending = [data.blockerId],
            visited = new Set<string>();
          while (pending.length) {
            const next = pending.pop()!;
            if (next === id)
              throw new AppError(400, "Circular dependencies are not allowed.");
            if (visited.has(next)) continue;
            visited.add(next);
            pending.push(
              ...edges.filter((e) => e.taskId === next).map((e) => e.blockerId),
            );
          }
          if (
            edges.some((e) => e.taskId === id && e.blockerId === data.blockerId)
          )
            return { id };
          await tx
            .insert(s.dependencies)
            .values({ taskId: id, blockerId: data.blockerId });
        } else {
          if (
            !edges.some(
              (e) => e.taskId === id && e.blockerId === data.blockerId,
            )
          )
            return { id };
          await tx
            .delete(s.dependencies)
            .where(
              and(
                eq(s.dependencies.taskId, id),
                eq(s.dependencies.blockerId, data.blockerId),
              ),
            );
        }
        await log(
          tx,
          id,
          data.enabled ? "dependency_added" : "dependency_removed",
          null,
          blocker.title,
        );
        return { id };
      });
    },
    async saveMilestone(projectId: string, input: unknown) {
      const data = z
        .object({
          id: z.uuid().optional(),
          name: z.string().trim().min(1).max(150),
          description: z.string().max(10000).default(""),
          dueDate: dateValue.refine(Boolean),
          status: z.enum(["upcoming", "completed"]).default("upcoming"),
        })
        .parse(input);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, projectId);
        requireAccess(canManageProject(actor, await project(projectId, tx)));
        const { id, ...values } = data;
        const [previous] = id
          ? await tx
              .select()
              .from(s.milestones)
              .where(
                and(
                  eq(s.milestones.id, id),
                  eq(s.milestones.projectId, projectId),
                ),
              )
          : [];
        if (id && !previous) throw new AppError(404, "Milestone not found.");
        const rows = id
          ? await tx
              .update(s.milestones)
              .set({ ...values, dueDate: values.dueDate! })
              .where(eq(s.milestones.id, id))
              .returning()
          : await tx
              .insert(s.milestones)
              .values({ ...values, dueDate: values.dueDate!, projectId })
              .returning();
        if (
          !previous ||
          Object.entries(values).some(
            ([k, v]) => previous[k as keyof typeof previous] !== v,
          )
        )
          await projectLog(
            tx,
            projectId,
            id ? "milestone_updated" : "milestone_created",
            previous?.name ?? null,
            values.name,
          );
        return rows[0];
      });
    },
    async linkMilestone(id: string, input: unknown) {
      const { milestoneId } = z
        .object({ milestoneId: z.uuid().nullable() })
        .parse(input);
      return locked(id, async (tx) => {
        const current = await task(id, true, tx);
        requireAccess(
          actor.isAdmin ||
            (!!current.project && canManageProject(actor, current.project)),
        );
        const [milestone] = milestoneId
          ? await tx
              .select()
              .from(s.milestones)
              .where(eq(s.milestones.id, milestoneId))
          : [];
        if (
          milestoneId &&
          (!milestone || milestone.projectId !== current.projectId)
        )
          throw new AppError(400, "Milestone must belong to the project.");
        if (current.milestoneId === milestoneId) return { id };
        const [previous] = current.milestoneId
          ? await tx
              .select()
              .from(s.milestones)
              .where(eq(s.milestones.id, current.milestoneId))
          : [];
        await tx
          .update(s.tasks)
          .set({ milestoneId, updatedAt: new Date() })
          .where(eq(s.tasks.id, id));
        if (previous) await log(tx, id, "milestone_unlinked", previous.name);
        if (milestone)
          await log(tx, id, "milestone_linked", null, milestone.name);
        return { id };
      });
    },
    async changeChecklist(id: string, input: unknown) {
      const data = z
        .discriminatedUnion("operation", [
          z.object({
            operation: z.literal("add"),
            title: z.string().trim().min(1).max(250),
          }),
          z.object({
            operation: z.literal("update"),
            itemId: z.uuid(),
            title: z.string().trim().min(1).max(250).optional(),
            completed: z.boolean().optional(),
          }),
          z.object({ operation: z.literal("remove"), itemId: z.uuid() }),
          z.object({
            operation: z.literal("reorder"),
            ids: z.array(z.uuid()).max(500),
          }),
        ])
        .parse(input);
      return locked(id, async (tx) => {
        const items = await tx
          .select()
          .from(s.checklist)
          .where(eq(s.checklist.taskId, id));
        if (data.operation === "add") {
          if (items.length >= 500)
            throw new AppError(400, "Checklist limit reached.");
          await tx.insert(s.checklist).values({
            taskId: id,
            title: data.title,
            position: Math.max(-1, ...items.map((i) => i.position)) + 1,
          });
          await log(tx, id, "checklist_added", null, data.title);
        } else if (data.operation === "reorder") {
          if (
            data.ids.length !== items.length ||
            new Set(data.ids).size !== items.length ||
            !data.ids.every((key) => items.some((i) => i.id === key))
          )
            throw new AppError(
              400,
              "Checklist changed. Refresh and try again.",
            );
          for (const [position, itemId] of data.ids.entries())
            await tx
              .update(s.checklist)
              .set({ position })
              .where(eq(s.checklist.id, itemId));
        } else {
          const item = items.find((i) => i.id === data.itemId);
          if (!item) throw new AppError(404, "Checklist item not found.");
          if (data.operation === "remove") {
            await tx.delete(s.checklist).where(eq(s.checklist.id, item.id));
            await log(tx, id, "checklist_removed", item.title);
          } else {
            if (data.title === undefined && data.completed === undefined)
              return { id };
            await tx
              .update(s.checklist)
              .set({ title: data.title, completed: data.completed })
              .where(eq(s.checklist.id, item.id));
            if (
              data.completed !== undefined &&
              data.completed !== item.completed
            )
              await log(
                tx,
                id,
                data.completed ? "checklist_completed" : "checklist_reopened",
                null,
                item.title,
              );
            if (data.title !== undefined && data.title !== item.title)
              await log(tx, id, "checklist_updated", item.title, data.title);
          }
        }
        return { id };
      });
    },
    async changeReminder(id: string, input: unknown) {
      const { minutes } = z
        .object({
          minutes: z.union([z.literal(60), z.literal(1440), z.literal(4320)]),
        })
        .parse(input);
      return locked(id, async (tx) => {
        const current = await task(id, true, tx);
        if (current.reminderMinutes === minutes) return { id };
        await tx
          .update(s.tasks)
          .set({ reminderMinutes: minutes, updatedAt: new Date() })
          .where(eq(s.tasks.id, id));
        await log(tx, id, "reminder_changed", current.reminderMinutes, minutes);
        return { id };
      });
    },
    async report() {
      requireAccess(actor.isAdmin || reportIds(actor).length > 0);
      const snapshot = await api.snapshot();
      const projects = snapshot.projects.filter(
        (p) => actor.isAdmin || p.canManage,
      );
      const tasks = snapshot.tasks.filter(
        (t) => actor.isAdmin || projects.some((p) => p.id === t.projectId),
      );
      const employees = snapshot.employees.filter(
        (e) =>
          actor.isAdmin ||
          e.userId === actor.userId ||
          reportIds(actor).includes(e.userId),
      );
      return {
        ...snapshot,
        projects,
        tasks,
        employees,
        notifications: [],
        milestones: snapshot.milestones.filter((m) =>
          projects.some((p) => p.id === m.projectId),
        ),
        projectActivity: snapshot.projectActivity.filter((l) =>
          projects.some((p) => p.id === l.projectId),
        ),
      };
    },
    async myTasks() {
      const snapshot = await api.snapshot();
      return snapshot.tasks
        .filter((task) => task.assigneeIds.includes(actor.userId))
        .sort(
          (a, b) =>
            Number(a.status === "done") - Number(b.status === "done") ||
            (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
            a.id.localeCompare(b.id),
        )
        .map(({ id, title, status, priority, dueDate, projectId }) => ({
          id,
          title,
          status,
          priority,
          dueDate,
          projectName:
            snapshot.projects.find((project) => project.id === projectId)
              ?.name ?? null,
        }));
    },
    // Open work of the actor's reports, nearest due date first (undated last).
    async teamTasks(limit = 20) {
      const team = reportIds(actor);
      if (!team.length) return [];
      const snapshot = await api.snapshot();
      return snapshot.tasks
        .filter(
          (task) =>
            task.status !== "done" &&
            task.assigneeIds.some((id) => team.includes(id)),
        )
        .sort(
          (a, b) =>
            (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
            a.id.localeCompare(b.id),
        )
        .slice(0, limit)
        .map(
          ({
            id,
            title,
            status,
            priority,
            dueDate,
            projectId,
            assigneeIds,
          }) => ({
            id,
            title,
            status,
            priority,
            dueDate,
            projectName:
              snapshot.projects.find((project) => project.id === projectId)
                ?.name ?? null,
            assignees: assigneeIds
              .filter((id) => team.includes(id))
              .map((id) => directory.find((e) => e.userId === id)?.name ?? null)
              .filter((name): name is string => !!name),
          }),
        );
    },
    async snapshot() {
      return (await build()).output;
    },
    async createProject(input: unknown) {
      const data = projectInput.parse(input);
      const ownerId = actor.isAdmin
        ? data.ownerId || actor.userId
        : actor.userId;
      const memberIds = [...new Set(data.memberIds)].filter(
        (id) => id !== ownerId,
      );
      requireAccess(
        actor.isAdmin || memberIds.every((id) => reportIds(actor).includes(id)),
        "Members must be employees below you in the organization.",
      );
      if (data.startDate && data.dueDate && data.startDate > data.dueDate)
        throw new AppError(400, "Due date must follow start date.");
      let template: { name: string; content: TemplateContent } | null = null;
      if (data.templateId) {
        const [row] = await db
          .select()
          .from(s.templates)
          .where(eq(s.templates.id, data.templateId));
        if (!row) throw new AppError(404, "Template not found.");
        template = { name: row.name, content: templateContent.parse(row.content) };
      }
      await register([ownerId, ...memberIds]);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        const [p] = await tx
          .insert(s.projects)
          .values({
            name: data.name,
            description: data.description,
            ownerId,
            startDate: data.startDate,
            dueDate: data.dueDate,
            status: data.status,
          })
          .returning();
        const roles = Object.fromEntries(
          memberIds.map((id) => [id, data.roles[id] ?? "member"]),
        ) as Record<string, ProjectRole>;
        if (memberIds.length)
          await tx.insert(s.members).values(
            memberIds.map((userId) => ({
              projectId: p.id,
              userId,
              role: roles[userId],
            })),
          );
        const sectionNames = [
          ...(template?.content.sections ?? []),
          ...data.sectionNames,
        ];
        const sectionIds: string[] = [];
        for (const [position, name] of sectionNames.entries()) {
          const [row] = await tx
            .insert(s.sections)
            .values({ projectId: p.id, name, position })
            .returning();
          sectionIds.push(row.id);
        }
        await projectLog(tx, p.id, "project_created", null, {
          name: p.name,
          ...(template ? { template: template.name } : {}),
        });
        if (template)
          await instantiate(tx, p, template.content, sectionIds, {
            ownerId,
            memberIds,
            roles,
          });
        return p;
      });
    },
    async updateProject(id: string, input: unknown) {
      const data = projectPatch.parse(input);
      const p = await project(id);
      requireAccess(canManageProject(actor, p));
      if (data.ownerId && data.ownerId !== p.ownerId) {
        requireAccess(
          canOwnProject(actor, p),
          "Only the owner or an admin can change the project owner.",
        );
        if (!actor.isAdmin)
          requireAccess(
            isAssignable(p, data.ownerId),
            "Choose a current project member as the new owner.",
          );
      }
      await register([
        ...(data.memberIds ?? []),
        ...(data.ownerId ? [data.ownerId] : []),
      ]);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, id);
        const current = await project(id, tx);
        requireAccess(canManageProject(actor, current));
        const own = canOwnProject(actor, current);
        const owner = data.ownerId ?? current.ownerId;
        if (owner !== current.ownerId)
          requireAccess(
            own,
            "Only the owner or an admin can change the project owner.",
          );
        const finalStart =
          data.startDate === undefined ? current.startDate : data.startDate;
        const finalDue =
          data.dueDate === undefined ? current.dueDate : data.dueDate;
        if (finalStart && finalDue && finalStart > finalDue)
          throw new AppError(400, "Due date must follow start date.");
        const roleOf = (userId: string) => current.roles[userId] ?? "member";
        if (data.memberIds || data.roles || owner !== current.ownerId) {
          const roles = { ...current.roles, ...(data.roles ?? {}) };
          const next = new Map<string, ProjectRole>(
            (data.memberIds ?? current.memberIds)
              .filter((userId) => userId !== owner)
              .map((userId) => [userId, roles[userId] ?? "member"]),
          );
          // A previous owner keeps managing the project they handed over.
          if (owner !== current.ownerId && !next.has(current.ownerId))
            next.set(current.ownerId, "project_manager");
          const added = [...next.keys()].filter(
            (userId) =>
              !current.memberIds.includes(userId) &&
              userId !== current.ownerId,
          );
          const pool = memberPool(current);
          requireAccess(
            actor.isAdmin || added.every((userId) => pool.has(userId)),
            "You can add only employees from the owner’s team or your own reports.",
          );
          const removed = current.memberIds.filter(
            (userId) => !next.has(userId) && userId !== owner,
          );
          const changed = [...next].filter(
            ([userId, role]) =>
              current.memberIds.includes(userId) && roleOf(userId) !== role,
          );
          if (!own) {
            requireAccess(
              ![...next].some(
                ([userId, role]) =>
                  role === "project_manager" &&
                  (!current.memberIds.includes(userId) ||
                    roleOf(userId) !== "project_manager"),
              ) &&
                !removed.some((userId) => roleOf(userId) === "project_manager") &&
                !changed.some(
                  ([userId]) => roleOf(userId) === "project_manager",
                ),
              "Only the owner or an admin can change project managers.",
            );
          }
          const work = await tx
            .select({ userId: s.assignees.userId })
            .from(s.assignees)
            .innerJoin(s.tasks, eq(s.tasks.id, s.assignees.taskId))
            .where(and(eq(s.tasks.projectId, id), isNull(s.tasks.deletedAt)));
          if (work.some((a) => a.userId !== owner && !next.has(a.userId)))
            throw new AppError(
              400,
              "Reassign this member’s tasks before removing them.",
            );
          if (work.some((a) => next.get(a.userId) === "viewer"))
            throw new AppError(
              400,
              "Reassign this member’s tasks before making them a viewer.",
            );
          await tx.delete(s.members).where(eq(s.members.projectId, id));
          if (next.size)
            await tx.insert(s.members).values(
              [...next].map(([userId, role]) => ({
                projectId: id,
                userId,
                role,
              })),
            );
          for (const userId of added)
            await projectLog(tx, id, "member_added", null, {
              userId,
              role: next.get(userId),
            });
          for (const userId of removed)
            await projectLog(tx, id, "member_removed", { userId }, null);
          for (const [userId, role] of changed)
            await projectLog(
              tx,
              id,
              "member_role_changed",
              { userId, role: roleOf(userId) },
              { userId, role },
            );
        }
        const values = {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.startDate !== undefined && { startDate: data.startDate }),
          ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
          ...(data.status !== undefined && { status: data.status }),
          ...(owner !== current.ownerId && { ownerId: owner }),
        };
        if (Object.keys(values).length)
          await tx.update(s.projects).set(values).where(eq(s.projects.id, id));
        if (owner !== current.ownerId)
          await projectLog(
            tx,
            id,
            "owner_changed",
            { userId: current.ownerId },
            { userId: owner },
          );
        if (data.status && data.status !== current.status)
          await projectLog(
            tx,
            id,
            "project_status_changed",
            current.status,
            data.status,
          );
        return { id };
      });
    },
    async setHealth(id: string, input: unknown) {
      const { health } = z
        .object({
          health: z
            .enum(["on_track", "at_risk", "off_track", "completed"])
            .nullable(),
        })
        .parse(input);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, id);
        const current = await project(id, tx);
        requireAccess(
          canManageProject(actor, current),
          "Only project managers and admins can change project health.",
        );
        if (current.healthOverride === health) return { id };
        await tx
          .update(s.projects)
          .set({ healthOverride: health })
          .where(eq(s.projects.id, id));
        await projectLog(
          tx,
          id,
          health ? "health_overridden" : "health_override_cleared",
          current.healthOverride,
          health,
        );
        return { id };
      });
    },
    async archiveProject(id: string) {
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, id);
        const current = await project(id, tx, true);
        requireAccess(
          canManageProject(actor, current),
          "Only project managers and admins can archive projects.",
        );
        if (current.archivedAt)
          throw new AppError(409, "This project is already archived.");
        await tx
          .update(s.projects)
          .set({ archivedAt: new Date() })
          .where(eq(s.projects.id, id));
        await projectLog(tx, id, "project_archived", null, {
          name: current.name,
        });
        return { id };
      });
    },
    async restoreProject(id: string) {
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, id);
        const current = await project(id, tx, true);
        requireAccess(
          canManageProject(actor, current),
          "Only project managers and admins can restore projects.",
        );
        if (!current.archivedAt)
          throw new AppError(409, "This project is not archived.");
        await tx
          .update(s.projects)
          .set({ archivedAt: null })
          .where(eq(s.projects.id, id));
        await projectLog(tx, id, "project_restored", null, {
          name: current.name,
        });
        return { id };
      });
    },
    async purgeProject(id: string) {
      requireAccess(actor.isAdmin, "Only admins can delete permanently.");
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, id);
        const current = await project(id, tx, true);
        if (!current.archivedAt)
          throw new AppError(
            409,
            "Archive this project before deleting it permanently.",
          );
        const rows = await tx
          .select({ id: s.tasks.id })
          .from(s.tasks)
          .where(eq(s.tasks.projectId, id));
        await purgeTasks(
          tx,
          rows.map((r) => r.id),
        );
        await tx.delete(s.milestones).where(eq(s.milestones.projectId, id));
        await tx.delete(s.sections).where(eq(s.sections.projectId, id));
        await tx.delete(s.fields).where(eq(s.fields.projectId, id));
        await tx.delete(s.members).where(eq(s.members.projectId, id));
        await tx.delete(s.savedViews).where(eq(s.savedViews.projectId, id));
        await tx.delete(s.activity).where(eq(s.activity.projectId, id));
        await tx.delete(s.projects).where(eq(s.projects.id, id));
        await projectLog(tx, null, "project_deleted_permanently", {
          name: current.name,
        });
        return { id };
      });
    },
    async archiveTask(id: string) {
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockTask(tx, id);
        const current = await task(id, false, tx);
        requireAccess(
          canArchiveTask(actor, current, current.project),
          "Only project managers and admins can archive project tasks.",
        );
        if (current.archived)
          throw new AppError(409, "This task is already archived.");
        await tx
          .update(s.tasks)
          .set({ archivedAt: new Date() })
          .where(
            and(
              or(eq(s.tasks.id, id), eq(s.tasks.parentId, id)),
              isNull(s.tasks.archivedAt),
              isNull(s.tasks.deletedAt),
            ),
          );
        await log(tx, id, "task_archived", null, { title: current.title });
        if (current.parentId) await recompute(tx, current.parentId);
        return { id };
      });
    },
    async restoreTask(id: string) {
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockTask(tx, id);
        const current = await task(id, false, tx);
        requireAccess(
          canArchiveTask(actor, current, current.project),
          "Only project managers and admins can restore project tasks.",
        );
        if (current.project?.archivedAt)
          throw new AppError(409, "Restore the project first.");
        if (current.parentArchived)
          throw new AppError(409, "Restore the parent task first.");
        if (!current.archivedAt)
          throw new AppError(409, "This task is not archived.");
        // Subtasks archived together with their parent come back with it.
        await tx
          .update(s.tasks)
          .set({ archivedAt: null })
          .where(
            or(
              eq(s.tasks.id, id),
              and(
                eq(s.tasks.parentId, id),
                eq(s.tasks.archivedAt, current.archivedAt),
              ),
            ),
          );
        await log(tx, id, "task_restored", null, { title: current.title });
        await recompute(tx, id);
        if (current.parentId) await recompute(tx, current.parentId);
        return { id };
      });
    },
    async purgeTask(id: string) {
      requireAccess(actor.isAdmin, "Only admins can delete permanently.");
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockTask(tx, id);
        const current = await task(id, false, tx);
        if (!current.archivedAt)
          throw new AppError(
            409,
            "Archive this task before deleting it permanently.",
          );
        const children = await tx
          .select({ id: s.tasks.id })
          .from(s.tasks)
          .where(eq(s.tasks.parentId, id));
        await purgeTasks(tx, [id, ...children.map((c) => c.id)]);
        await projectLog(tx, current.projectId, "task_deleted_permanently", {
          title: current.title,
        });
        if (current.parentId) await recompute(tx, current.parentId);
        return { id };
      });
    },
    async archiveLog() {
      requireAccess(actor.isAdmin);
      const rows = await db
        .select()
        .from(s.activity)
        .where(inArray(s.activity.action, ARCHIVE_ACTIONS))
        .orderBy(desc(s.activity.createdAt))
        .limit(50);
      return rows.map((row) => ({
        ...row,
        actorName: directory.find((e) => e.userId === row.userId)?.name ?? null,
      }));
    },
    async projectActivity(projectId: string, before?: string) {
      requireAccess(canViewProject(actor, await project(projectId, db, true)));
      const rows = await db
        .select({
          log: s.activity,
          taskTitle: s.tasks.title,
          taskDeleted: s.tasks.deletedAt,
        })
        .from(s.activity)
        .leftJoin(s.tasks, eq(s.tasks.id, s.activity.taskId))
        .where(
          and(
            eq(s.activity.projectId, projectId),
            inArray(s.activity.action, FEED_ACTIONS),
            // Template set-up and completion requests would drown real events.
            sql`coalesce(${s.activity.after}->>'fromTemplate', '') = ''`,
            sql`not (${s.activity.action} = 'status_changed' and ${s.activity.after}::text = '"completion_requested"')`,
            before ? lt(s.activity.createdAt, new Date(before)) : undefined,
          ),
        )
        .orderBy(desc(s.activity.createdAt))
        .limit(41);
      return {
        items: rows.slice(0, 40).map((r) => ({
          ...r.log,
          // Actors may sit outside the viewer's employee list (e.g. an admin).
          actorName:
            directory.find((e) => e.userId === r.log.userId)?.name ?? null,
          taskTitle: r.taskDeleted ? null : r.taskTitle,
        })),
        hasMore: rows.length > 40,
      };
    },
    async addSection(projectId: string, name: string) {
      const p = await project(projectId);
      requireAccess(canManageProject(actor, p));
      const label = z.string().trim().min(1).max(100).parse(name);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, projectId);
        requireAccess(canManageProject(actor, await project(projectId, tx)));
        const [row] = await tx
          .insert(s.sections)
          .values({ projectId, name: label, position: Date.now() % 2147483647 })
          .returning();
        return row;
      });
    },
    async saveField(projectId: string, input: unknown) {
      const data = fieldInput.parse(input);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, projectId);
        requireAccess(
          canManageProject(actor, await project(projectId, tx)),
          "Only project managers and admins can manage custom fields.",
        );
        const existing = await tx
          .select()
          .from(s.fields)
          .where(eq(s.fields.projectId, projectId));
        const options = data.type === "select" ? [...new Set(data.options)] : [];
        if (data.id) {
          const field = existing.find((f) => f.id === data.id);
          if (!field) throw new AppError(404, "Field not found.");
          if (field.type !== data.type)
            throw new AppError(400, "A field’s type cannot be changed.");
          await tx
            .update(s.fields)
            .set({ name: data.name, options })
            .where(eq(s.fields.id, field.id));
          // Values for removed select options no longer have a meaning.
          if (field.type === "select") {
            const values = await tx
              .select()
              .from(s.fieldValues)
              .where(eq(s.fieldValues.fieldId, field.id));
            const stale = values.filter((v) => !options.includes(v.value));
            if (stale.length)
              await tx.delete(s.fieldValues).where(
                and(
                  eq(s.fieldValues.fieldId, field.id),
                  inArray(
                    s.fieldValues.taskId,
                    stale.map((v) => v.taskId),
                  ),
                ),
              );
          }
          await projectLog(tx, projectId, "field_updated", field.name, data.name);
          return { id: field.id };
        }
        if (existing.length >= 30)
          throw new AppError(400, "Projects can have up to 30 custom fields.");
        const [row] = await tx
          .insert(s.fields)
          .values({
            projectId,
            name: data.name,
            type: data.type,
            options,
            position: Math.max(-1, ...existing.map((f) => f.position)) + 1,
          })
          .returning();
        await projectLog(tx, projectId, "field_created", null, data.name);
        return { id: row.id };
      });
    },
    async removeField(projectId: string, input: unknown) {
      const { fieldId } = z.object({ fieldId: z.uuid() }).parse(input);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, projectId);
        requireAccess(
          canManageProject(actor, await project(projectId, tx)),
          "Only project managers and admins can manage custom fields.",
        );
        const [field] = await tx
          .select()
          .from(s.fields)
          .where(
            and(eq(s.fields.id, fieldId), eq(s.fields.projectId, projectId)),
          );
        if (!field) throw new AppError(404, "Field not found.");
        await tx.delete(s.fieldValues).where(eq(s.fieldValues.fieldId, fieldId));
        await tx.delete(s.fields).where(eq(s.fields.id, fieldId));
        await projectLog(tx, projectId, "field_removed", field.name);
        return { id: fieldId };
      });
    },
    async setFieldValue(id: string, input: unknown) {
      const data = z
        .object({ fieldId: z.uuid(), value: z.string().max(500).nullable() })
        .parse(input);
      return locked(id, async (tx) => {
        const current = await task(id, true, tx);
        const [field] = await tx
          .select()
          .from(s.fields)
          .where(eq(s.fields.id, data.fieldId));
        if (!field || field.projectId !== current.projectId)
          throw new AppError(400, "Field must belong to the task’s project.");
        let value = data.value?.trim() || null;
        if (value !== null) {
          if (field.type === "number") {
            if (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(+value))
              throw new AppError(400, "Enter a valid number.");
            value = String(Number(value));
          } else if (field.type === "date") value = dateValue.parse(value);
          else if (field.type === "select" && !field.options.includes(value))
            throw new AppError(400, "Choose one of the field’s options.");
        }
        const [previous] = await tx
          .select()
          .from(s.fieldValues)
          .where(
            and(
              eq(s.fieldValues.taskId, id),
              eq(s.fieldValues.fieldId, field.id),
            ),
          );
        if ((previous?.value ?? null) === value) return { id };
        if (previous)
          await tx
            .delete(s.fieldValues)
            .where(
              and(
                eq(s.fieldValues.taskId, id),
                eq(s.fieldValues.fieldId, field.id),
              ),
            );
        if (value !== null)
          await tx
            .insert(s.fieldValues)
            .values({ taskId: id, fieldId: field.id, value });
        await log(
          tx,
          id,
          "field_changed",
          { field: field.name, value: previous?.value ?? null },
          { field: field.name, value },
        );
        return { id };
      });
    },
    async setTaskTags(id: string, input: unknown) {
      const { names } = z.object({ names: tagNames }).parse(input);
      return locked(id, async (tx) => {
        await applyTags(tx, id, names);
        return { id };
      });
    },
    async saveView(input: unknown) {
      const data = viewInput.parse(input);
      if (data.scope === "project") {
        if (!data.projectId)
          throw new AppError(400, "Choose a project for this view.");
        requireAccess(
          canViewProject(actor, await project(data.projectId, db, true)),
        );
      }
      const values = {
        name: data.name,
        scope: data.scope,
        projectId: data.scope === "project" ? data.projectId : null,
        config: data.config,
      };
      if (data.id) {
        const [row] = await db
          .update(s.savedViews)
          .set(values)
          .where(
            and(
              eq(s.savedViews.id, data.id),
              eq(s.savedViews.userId, actor.userId),
            ),
          )
          .returning();
        if (!row) throw new AppError(404, "Saved view not found.");
        return row;
      }
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(s.savedViews)
        .where(eq(s.savedViews.userId, actor.userId));
      if (count >= 50)
        throw new AppError(400, "You can keep up to 50 saved views.");
      const [row] = await db
        .insert(s.savedViews)
        .values({ ...values, userId: actor.userId })
        .returning();
      return row;
    },
    async removeView(id: string) {
      const rows = await db
        .delete(s.savedViews)
        .where(
          and(eq(s.savedViews.id, id), eq(s.savedViews.userId, actor.userId)),
        )
        .returning();
      if (!rows.length) throw new AppError(404, "Saved view not found.");
      return { id };
    },
    async saveTemplate(input: unknown) {
      const data = z
        .object({
          projectId: z.uuid(),
          name: z.string().trim().min(1).max(150),
          description: z.string().max(2000).default(""),
          includeAssignees: z.boolean().default(false),
        })
        .parse(input);
      requireAccess(
        canCreateTemplates,
        "Only managers and admins can create project templates.",
      );
      const p = await project(data.projectId);
      requireAccess(
        canManageProject(actor, p),
        "Only project managers and admins can create project templates.",
      );
      const [sectionRows, milestoneRows, taskRows] = await Promise.all([
        db.select().from(s.sections).where(eq(s.sections.projectId, p.id)),
        db.select().from(s.milestones).where(eq(s.milestones.projectId, p.id)),
        db
          .select()
          .from(s.tasks)
          .where(
            and(
              eq(s.tasks.projectId, p.id),
              isNull(s.tasks.deletedAt),
              isNull(s.tasks.archivedAt),
            ),
          )
          .orderBy(s.tasks.createdAt),
      ]);
      const live = taskRows.filter(
        (t) => !t.parentId || taskRows.some((parent) => parent.id === t.parentId),
      );
      const ids = live.map((t) => t.id);
      const [assignmentRows, checklistRows, dependencyRows] = ids.length
        ? await Promise.all([
            db.select().from(s.assignees).where(inArray(s.assignees.taskId, ids)),
            db.select().from(s.checklist).where(inArray(s.checklist.taskId, ids)),
            db
              .select()
              .from(s.dependencies)
              .where(inArray(s.dependencies.taskId, ids)),
          ])
        : [[], [], []];
      const content = captureTemplate({
        base: p.startDate ?? cairoToday(p.createdAt),
        sections: sectionRows.sort((a, b) => a.position - b.position),
        milestones: milestoneRows.sort((a, b) =>
          a.dueDate.localeCompare(b.dueDate),
        ),
        tasks: live.map((t) => ({
          ...t,
          assigneeIds: assignmentRows
            .filter((a) => a.taskId === t.id)
            .map((a) => a.userId),
        })),
        checklist: checklistRows,
        dependencies: dependencyRows,
        includeAssignees: data.includeAssignees,
      });
      const [row] = await db
        .insert(s.templates)
        .values({
          name: data.name,
          description: data.description,
          createdBy: actor.userId,
          content,
        })
        .returning();
      await db.insert(s.activity).values({
        projectId: p.id,
        userId: actor.userId,
        action: "template_created",
        after: data.name,
      });
      return { id: row.id };
    },
    async updateTemplate(id: string, input: unknown) {
      const data = z
        .object({
          name: z.string().trim().min(1).max(150),
          description: z.string().max(2000).default(""),
        })
        .parse(input);
      const [row] = await db
        .select()
        .from(s.templates)
        .where(eq(s.templates.id, id));
      if (!row) throw new AppError(404, "Template not found.");
      requireAccess(actor.isAdmin || row.createdBy === actor.userId);
      await db
        .update(s.templates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(s.templates.id, id));
      return { id };
    },
    async deleteTemplate(id: string) {
      const [row] = await db
        .select()
        .from(s.templates)
        .where(eq(s.templates.id, id));
      if (!row) throw new AppError(404, "Template not found.");
      requireAccess(actor.isAdmin || row.createdBy === actor.userId);
      await db.delete(s.templates).where(eq(s.templates.id, id));
      return { id };
    },
    async createTask(input: unknown) {
      const data = taskInput.parse(input);
      const p = data.projectId ? await project(data.projectId) : null;
      if (p)
        requireAccess(
          canContribute(actor, p),
          "Viewers cannot add tasks to this project.",
        );
      let parent: Awaited<ReturnType<typeof task>> | null = null;
      if (data.parentId) {
        parent = await task(data.parentId, true);
        if (parent.parentId)
          throw new AppError(400, "Subtasks support one level in V1.");
        if (parent.projectId !== (data.projectId || null))
          throw new AppError(400, "Subtasks must use the parent project.");
      }
      if (data.recurrence) {
        if (data.parentId)
          throw new AppError(400, "Only top-level tasks can repeat.");
        if (!data.dueDate)
          throw new AppError(400, "Recurring tasks need a due date.");
      }
      validateAssignees(
        parent && !p ? { ...actor, userId: parent.creatorId } : actor,
        data.assigneeIds,
        p,
      );
      if (data.sectionId) {
        const [section] = await db
          .select()
          .from(s.sections)
          .where(eq(s.sections.id, data.sectionId));
        if (!section || section.projectId !== data.projectId)
          throw new AppError(400, "Section must belong to the project.");
      }
      await register([actor.userId, ...data.assigneeIds]);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        if (p) {
          await lockProject(tx, p.id);
          const current = await project(p.id, tx);
          requireAccess(canContribute(actor, current));
          validateAssignees(actor, data.assigneeIds, current);
        }
        if (parent)
          await tx.execute(
            sql`select id from tasks where id = ${parent.id} for update`,
          );
        if (parent) await task(parent.id, true, tx);
        const [t] = await tx
          .insert(s.tasks)
          .values({
            title: data.title,
            description: data.description,
            projectId: data.projectId,
            parentId: data.parentId,
            sectionId: data.sectionId,
            creatorId: parent && !p ? parent.creatorId : actor.userId,
            priority: data.priority,
            dueDate: data.dueDate,
            recurrence: data.recurrence ?? null,
            status: data.status === "done" ? "todo" : data.status,
          })
          .returning();
        await tx.insert(s.assignees).values(
          [...new Set(data.assigneeIds)].map((userId) => ({
            taskId: t.id,
            userId,
            completed: data.status === "done" && userId === actor.userId,
          })),
        );
        await log(tx, t.id, "task_created", null, { title: t.title });
        if (data.tags?.length) await applyTags(tx, t.id, data.tags);
        await notify(tx, t.id, data.assigneeIds, "assignment", t.title);
        await recompute(tx, t.id);
        if (parent) await recompute(tx, parent.id);
        return t;
      });
    },
    async taskDetail(id: string) {
      const current = await task(id);
      const { visible, enrich } = await build();
      const pool = new Set(visible.map((t) => t.id));
      const raw = visible.find((t) => t.id === id);
      if (!raw) throw new AppError(404, "Task not found.");
      const [commentRows, files, logs] = await Promise.all([
        db
          .select()
          .from(s.comments)
          .where(eq(s.comments.taskId, id))
          .orderBy(s.comments.createdAt),
        db
          .select({
            id: s.attachments.id,
            name: s.attachments.name,
            size: s.attachments.size,
            userId: s.attachments.userId,
            createdAt: s.attachments.createdAt,
          })
          .from(s.attachments)
          .where(eq(s.attachments.taskId, id)),
        db
          .select()
          .from(s.activity)
          .where(eq(s.activity.taskId, id))
          .orderBy(desc(s.activity.createdAt)),
      ]);
      return {
        task: enrich(raw, pool),
        subtasks: visible
          .filter((t) => t.parentId === id)
          .map((t) => enrich(t, pool)),
        comments: commentRows,
        attachments: files,
        activity: logs,
        mentionable: [...new Set(mentionable(current))],
      };
    },
    async updateTask(id: string, input: unknown) {
      const t = await task(id, true);
      const data = taskPatch.parse(input);
      if (data.assigneeIds) {
        requireAccess(
          canReassignTask(actor, t, t.project),
          "Only a project manager, the assigning manager, or an admin can reassign work.",
        );
        validateAssignees(actor, data.assigneeIds, t.project);
        await register(data.assigneeIds);
      }
      if (data.sectionId) {
        const [section] = await db
          .select()
          .from(s.sections)
          .where(eq(s.sections.id, data.sectionId));
        if (!section || section.projectId !== t.projectId)
          throw new AppError(400, "Section must belong to the project.");
      }
      return locked(id, async (tx) => {
        const current = await task(id, true, tx);
        if (data.assigneeIds && current.project) {
          requireAccess(canReassignTask(actor, current, current.project));
          validateAssignees(actor, data.assigneeIds, current.project);
        }
        const [fresh] = await tx
          .select()
          .from(s.tasks)
          .where(eq(s.tasks.id, id));
        if (fresh.deletedAt) throw new AppError(404, "Task not found.");
        const recurrence =
          data.recurrence === undefined ? fresh.recurrence : data.recurrence;
        const due = data.dueDate === undefined ? fresh.dueDate : data.dueDate;
        if (recurrence && fresh.parentId)
          throw new AppError(400, "Only top-level tasks can repeat.");
        if (recurrence && !due)
          throw new AppError(400, "Recurring tasks need a due date.");
        const { assigneeIds, status, ...values } = data;
        await tx
          .update(s.tasks)
          .set({
            ...values,
            updatedAt: new Date(),
            ...(status && status !== "done" ? { status } : {}),
          })
          .where(eq(s.tasks.id, id));
        for (const field of [
          "title",
          "description",
          "priority",
          "dueDate",
          "sectionId",
          "recurrence",
        ] as const) {
          if (data[field] !== undefined && data[field] !== fresh[field])
            await log(
              tx,
              id,
              `${field === "dueDate" ? "due_date" : field === "sectionId" ? "section" : field}_changed`,
              fresh[field],
              data[field],
            );
        }
        if (status && status !== fresh.status)
          await log(
            tx,
            id,
            "status_changed",
            fresh.status,
            status === "done" ? "completion_requested" : status,
          );
        if (assigneeIds) {
          const old = await tx
            .select()
            .from(s.assignees)
            .where(eq(s.assignees.taskId, id));
          const removed = old.filter((a) => !assigneeIds.includes(a.userId));
          if (removed.length)
            await tx.delete(s.assignees).where(
              and(
                eq(s.assignees.taskId, id),
                inArray(
                  s.assignees.userId,
                  removed.map((a) => a.userId),
                ),
              ),
            );
          const added = [...new Set(assigneeIds)].filter(
            (userId) => !old.some((a) => a.userId === userId),
          );
          if (added.length)
            await tx
              .insert(s.assignees)
              .values(added.map((userId) => ({ taskId: id, userId })));
          for (const userId of added)
            await log(tx, id, "assignee_added", null, userId);
          for (const a of removed)
            await log(tx, id, "assignee_removed", a.userId, null);
          await notify(
            tx,
            id,
            added,
            "assignment",
            values.title || fresh.title,
          );
        }
        if (status && status !== fresh.status) {
          const assigned = await tx
            .select()
            .from(s.assignees)
            .where(eq(s.assignees.taskId, id));
          if (status === "done")
            requireAccess(
              assigned.some((a) => a.userId === actor.userId),
              "Complete your own part using the assignee controls.",
            );
          if (assigned.some((a) => a.userId === actor.userId)) {
            await tx
              .update(s.assignees)
              .set({ completed: status === "done" })
              .where(
                and(
                  eq(s.assignees.taskId, id),
                  eq(s.assignees.userId, actor.userId),
                ),
              );
            if (status === "done")
              await log(tx, id, "part_completed", null, actor.userId);
          }
        }
        const currentAssignments = await tx
          .select()
          .from(s.assignees)
          .where(eq(s.assignees.taskId, id));
        await notify(
          tx,
          id,
          currentAssignments.map((a) => a.userId),
          "update",
          values.title || fresh.title,
        );
        return { id };
      });
    },
    async completePart(id: string, userId: string, completed: boolean) {
      await task(id, true);
      requireAccess(
        actor.isAdmin || userId === actor.userId,
        "You can complete only your own part.",
      );
      return locked(id, async (tx) => {
        const rows = await tx
          .update(s.assignees)
          .set({ completed })
          .where(
            and(eq(s.assignees.taskId, id), eq(s.assignees.userId, userId)),
          )
          .returning();
        if (!rows.length) throw new AppError(400, "Employee is not assigned.");
        await log(
          tx,
          id,
          completed ? "part_completed" : "part_reopened",
          !completed,
          { userId, completed },
        );
        return { id };
      });
    },
    // Retained for internal maintenance; the workspace archives before deleting.
    async deleteTask(id: string) {
      await task(id, true);
      const childRows = await db
        .select()
        .from(s.tasks)
        .where(and(eq(s.tasks.parentId, id), isNull(s.tasks.deletedAt)));
      for (const child of childRows) await task(child.id, true);
      return locked(id, async (tx) => {
        const children = await tx
          .select()
          .from(s.tasks)
          .where(and(eq(s.tasks.parentId, id), isNull(s.tasks.deletedAt)));
        for (const child of children) {
          await task(child.id, true, tx);
          await log(tx, child.id, "task_deleted");
        }
        const ids = [id, ...children.map((c) => c.id)];
        await tx
          .update(s.tasks)
          .set({ deletedAt: new Date() })
          .where(inArray(s.tasks.id, ids));
        await log(tx, id, "task_deleted");
        return { id };
      });
    },
    // Retained for internal maintenance; the workspace archives before deleting.
    async deleteProject(id: string) {
      const p = await project(id, db, true);
      requireAccess(canManageProject(actor, p));
      await db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await lockProject(tx, id);
        requireAccess(canManageProject(actor, await project(id, tx, true)));
        const items = await tx
          .select()
          .from(s.tasks)
          .where(and(eq(s.tasks.projectId, id), isNull(s.tasks.deletedAt)));
        for (const t of items)
          await log(tx, t.id, "task_deleted", {
            title: t.title,
            reason: "project_deleted",
          });
        await tx
          .update(s.tasks)
          .set({ deletedAt: new Date() })
          .where(eq(s.tasks.projectId, id));
        await tx
          .update(s.projects)
          .set({ deletedAt: new Date() })
          .where(eq(s.projects.id, id));
      });
      return { id };
    },
    async addComment(id: string, body: string) {
      const text = z.string().trim().min(1).max(5000).parse(body);
      const t = await task(id);
      requireAccess(
        canComment(actor, t, t.project),
        "Viewers can read this project but cannot comment.",
      );
      if (t.archived)
        throw new AppError(409, "Restore this task before making changes.");
      const mentions = mentionedIds(text);
      const allowed = mentionable(t);
      requireAccess(
        mentions.every((userId) => allowed.includes(userId)),
        "You can mention only people who can see this task.",
      );
      return locked(
        id,
        async (tx) => {
          const current = await task(id, false, tx);
          requireAccess(canComment(actor, current, current.project));
          if (current.archived)
            throw new AppError(409, "Restore this task before making changes.");
          const [c] = await tx
            .insert(s.comments)
            .values({ taskId: id, userId: actor.userId, body: text })
            .returning();
          await log(tx, id, "comment_created", null, {
            commentId: c.id,
            ...(mentions.length ? { mentions } : {}),
          });
          await notify(tx, id, mentions, "mention", current.title);
          await notify(
            tx,
            id,
            [...current.assigneeIds, current.creatorId].filter(
              (userId) => !mentions.includes(userId),
            ),
            "comment",
            current.title,
          );
          return c;
        },
        false,
      );
    },
    async addAttachment(id: string, name: string, content: Buffer) {
      await task(id, true);
      if (!content.length || content.length > 10 * 1024 * 1024)
        throw new AppError(400, "Files must be between 1 byte and 10 MB.");
      const safeName = z
        .string()
        .trim()
        .min(1)
        .max(200)
        .parse(name.replace(/[\\/\r\n\x00]/g, "_"));
      return locked(id, async (tx) => {
        const [row] = await tx
          .insert(s.attachments)
          .values({
            taskId: id,
            userId: actor.userId,
            name: safeName,
            size: content.length,
            content,
          })
          .returning({ id: s.attachments.id });
        await log(tx, id, "attachment_added", null, safeName);
        return row;
      });
    },
    async getAttachment(id: string) {
      const [meta] = await db
        .select({ taskId: s.attachments.taskId })
        .from(s.attachments)
        .where(eq(s.attachments.id, id));
      if (!meta) throw new AppError(404, "Attachment not found.");
      await task(meta.taskId);
      const [file] = await db
        .select()
        .from(s.attachments)
        .where(eq(s.attachments.id, id));
      return file;
    },
    async deleteAttachment(id: string) {
      const [file] = await db
        .select({ taskId: s.attachments.taskId, name: s.attachments.name })
        .from(s.attachments)
        .where(eq(s.attachments.id, id));
      if (!file) throw new AppError(404, "Attachment not found.");
      await task(file.taskId, true);
      await locked(file.taskId, async (tx) => {
        await tx.delete(s.attachments).where(eq(s.attachments.id, id));
        await log(tx, file.taskId, "attachment_removed", file.name);
      });
      return { id };
    },
    async markRead(id?: string) {
      await db
        .update(s.notifications)
        .set({ readAt: new Date() })
        .where(
          id
            ? and(
                eq(s.notifications.userId, actor.userId),
                eq(s.notifications.id, id),
              )
            : eq(s.notifications.userId, actor.userId),
        );
      return { ok: true };
    },
    async reconcileDue(today?: string) {
      const now = today ? new Date(today + "T12:00:00Z") : new Date();
      const snapshot = await api.snapshot();
      for (const t of snapshot.tasks.filter(
        (t) => t.assigneeIds.includes(actor.userId) && t.status !== "done",
      )) {
        const kind = reminderKind(t, now);
        if (!kind) continue;
        await db
          .insert(s.notifications)
          .values({
            userId: actor.userId,
            taskId: t.id,
            kind,
            message: t.title,
            dedupeKey: `${actor.userId}:${t.id}:${kind}:${t.dueDate}`,
          })
          .onConflictDoNothing();
      }
    },
    async listAdmins() {
      requireAccess(actor.isAdmin);
      return db.select().from(s.admins);
    },
    async setAdmin(userId: string, enabled: boolean) {
      requireAccess(actor.isAdmin);
      await register([userId]);
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(742001)`);
        if (enabled)
          await tx.insert(s.admins).values({ userId }).onConflictDoNothing();
        else {
          const all = await tx.select().from(s.admins);
          if (all.length <= 1 && all.some((a) => a.userId === userId))
            throw new AppError(400, "Keep at least one TASK admin.");
          await tx.delete(s.admins).where(eq(s.admins.userId, userId));
        }
        return { ok: true };
      });
    },
  };
  // Builds a new project's work from a template inside the creating transaction.
  async function instantiate(
    tx: Database,
    p: typeof s.projects.$inferSelect,
    content: TemplateContent,
    sectionIds: string[],
    access: {
      ownerId: string;
      memberIds: string[];
      roles: Record<string, ProjectRole>;
    },
  ) {
    const base = p.startDate ?? cairoToday();
    const at = (offset: number | null) =>
      offset === null ? null : addDays(base, offset);
    // Keep template assignees only if they are assignable in the new project.
    const people = (ids: string[]) => {
      const valid = [...new Set(ids)].filter((id) => isAssignable(access, id));
      return valid.length ? valid : [access.ownerId];
    };
    const milestoneIds = new Map<string, string>();
    for (const m of content.milestones) {
      const [row] = await tx
        .insert(s.milestones)
        .values({
          projectId: p.id,
          name: m.name,
          description: m.description,
          dueDate: addDays(base, m.offset),
        })
        .returning();
      milestoneIds.set(m.key, row.id);
    }
    const taskIds = new Map<string, string>();
    const create = async (
      item: TemplateContent["tasks"][number]["subtasks"][number],
      extra: {
        parentId?: string;
        sectionId?: string | null;
        milestoneId?: string | null;
      },
    ) => {
      const [row] = await tx
        .insert(s.tasks)
        .values({
          title: item.title,
          description: item.description,
          projectId: p.id,
          creatorId: actor.userId,
          priority: item.priority,
          dueDate: at(item.offset),
          ...extra,
        })
        .returning();
      const assigned = people(item.assigneeIds);
      await tx
        .insert(s.assignees)
        .values(assigned.map((userId) => ({ taskId: row.id, userId })));
      if (item.checklist.length)
        await tx.insert(s.checklist).values(
          item.checklist.map((title, position) => ({
            taskId: row.id,
            title,
            position,
          })),
        );
      taskIds.set(item.key, row.id);
      await log(tx, row.id, "task_created", null, {
        title: row.title,
        fromTemplate: true,
      });
      await notify(tx, row.id, assigned, "assignment", row.title);
      return row;
    };
    for (const item of content.tasks) {
      const parent = await create(item, {
        sectionId: item.section === null ? null : (sectionIds[item.section] ?? null),
        milestoneId: (item.milestone && milestoneIds.get(item.milestone)) || null,
      });
      for (const child of item.subtasks)
        await create(child, { parentId: parent.id });
    }
    const edges = content.dependencies.filter(
      (e) => taskIds.has(e.task) && taskIds.has(e.blocker) && e.task !== e.blocker,
    );
    if (edges.length)
      await tx
        .insert(s.dependencies)
        .values(
          edges.map((e) => ({
            taskId: taskIds.get(e.task)!,
            blockerId: taskIds.get(e.blocker)!,
          })),
        )
        .onConflictDoNothing();
  }
  return api;
}
export type WorkService = ReturnType<typeof createService>;
export type Snapshot = Awaited<ReturnType<WorkService["snapshot"]>>;
export type TaskDetail = Awaited<ReturnType<WorkService["taskDetail"]>>;
export type ProjectFeed = Awaited<ReturnType<WorkService["projectActivity"]>>;
