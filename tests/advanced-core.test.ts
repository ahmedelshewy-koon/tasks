import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { createService } from "../src/modules/work/service";
import { suggestHealth } from "../src/modules/tasks/health";
import { nextDueDate } from "../src/modules/tasks/recurrence";
import { commentParts, mentionedIds } from "../src/modules/work/mentions";
import type { Actor, Employee } from "../src/modules/shared/types";

const managers: Record<string, string | null> = {
  admin: null,
  manager: null,
  employee: "manager",
  peer: "manager",
  lead: null,
  junior: "lead",
  outsider: null,
};
const directory: Employee[] = Object.entries(managers).map(
  ([userId, managerId]) => ({
    userId,
    employeeId: userId,
    name: userId,
    email: `${userId}@test.invalid`,
    company: "Test",
    branch: "",
    department: "",
    jobTitle: "",
    managerId,
  }),
);
const reports = (id: string) =>
  directory.filter((e) => e.managerId === id).map((e) => e.userId);
const svc = (userId: string) =>
  createService(
    db,
    {
      userId,
      employeeId: userId,
      isAdmin: userId === "admin",
      directReportIds: reports(userId),
    } as Actor,
    directory,
  );
const client = new PGlite();
const db = drizzle(client, { schema });
beforeAll(async () => {
  await migrateDatabase(client);
  await db
    .insert(schema.users)
    .values(directory.map((e) => ({ id: e.userId, employeeId: e.employeeId })));
  await db.insert(schema.admins).values({ userId: "admin" });
});
afterAll(async () => {
  await client.close();
});

describe("pure helpers", () => {
  it("advances recurrence and clamps month ends", () => {
    expect(nextDueDate("2026-01-31", "monthly", "2026-01-01")).toBe(
      "2026-02-28",
    );
    expect(nextDueDate("2026-03-02", "weekly", "2026-03-01")).toBe(
      "2026-03-09",
    );
    // Late completion skips occurrences that already passed.
    expect(nextDueDate("2026-03-01", "daily", "2026-03-10")).toBe("2026-03-10");
  });
  it("explains suggested health", () => {
    const base = {
      status: "active" as const,
      total: 4,
      progress: 50,
      overdueTasks: 0,
      overdueMilestones: 0,
      startDate: null,
      dueDate: null,
      today: "2026-05-10",
    };
    expect(suggestHealth(base).health).toBe("on_track");
    expect(suggestHealth({ ...base, overdueTasks: 1 }).health).toBe("at_risk");
    expect(suggestHealth({ ...base, overdueTasks: 2 })).toEqual({
      health: "off_track",
      reasons: ["many_overdue_tasks"],
    });
    expect(suggestHealth({ ...base, dueDate: "2026-05-01" }).health).toBe(
      "off_track",
    );
    expect(suggestHealth({ ...base, progress: 100 }).health).toBe("completed");
    expect(
      suggestHealth({
        ...base,
        startDate: "2026-05-01",
        dueDate: "2026-05-20",
        progress: 10,
      }).reasons,
    ).toContain("behind_schedule");
  });
  it("parses mention tokens", () => {
    const body = "Hi @[Peer](peer), see @[Old name](employee).";
    expect(mentionedIds(body)).toEqual(["peer", "employee"]);
    expect(commentParts(body).map((p) => p.kind)).toEqual([
      "text",
      "mention",
      "text",
      "mention",
      "text",
    ]);
  });
});

describe("project roles", () => {
  let projectId: string;
  it("lets the owner appoint a project manager who manages members within HR scope", async () => {
    projectId = (
      await svc("manager").createProject({
        name: "Roles",
        memberIds: ["employee"],
      })
    ).id;
    // Owner cannot add employees outside their HR team.
    await expect(
      svc("manager").updateProject(projectId, {
        memberIds: ["employee", "lead"],
      }),
    ).rejects.toThrow();
    // Admin can; the owner then promotes lead to project manager.
    await svc("admin").updateProject(projectId, {
      memberIds: ["employee", "lead"],
    });
    await svc("manager").updateProject(projectId, {
      roles: { lead: "project_manager" },
    });
    // Lead adds a direct report and someone from the owner's team.
    await svc("lead").updateProject(projectId, {
      memberIds: ["employee", "lead", "junior", "peer"],
      roles: { peer: "viewer" },
    });
    await expect(
      svc("lead").updateProject(projectId, {
        memberIds: ["employee", "lead", "junior", "peer", "outsider"],
      }),
    ).rejects.toThrow(/owner’s team/);
    await expect(
      svc("lead").updateProject(projectId, { roles: { junior: "project_manager" } }),
    ).rejects.toThrow(/project managers/);
    await expect(
      svc("lead").updateProject(projectId, { ownerId: "lead" }),
    ).rejects.toThrow(/owner/);
    const p = (await svc("lead").snapshot()).projects.find(
      (x) => x.id === projectId,
    )!;
    expect(p.myRole).toBe("project_manager");
    expect(p.canManage).toBe(true);
    expect(p.canOwn).toBe(false);
    expect(p.roles).toMatchObject({ lead: "project_manager", peer: "viewer" });
  });
  it("lets project managers assign any member but keeps viewers read-only", async () => {
    const t = await svc("lead").createTask({
      title: "Lead assigns owner's report",
      projectId,
      assigneeIds: ["employee"],
    });
    await expect(
      svc("lead").createTask({ title: "x", projectId, assigneeIds: ["peer"] }),
    ).rejects.toThrow(/Viewers/);
    await expect(
      svc("peer").createTask({ title: "x", projectId, assigneeIds: ["peer"] }),
    ).rejects.toThrow();
    await expect(svc("peer").addComment(t.id, "hello")).rejects.toThrow(
      /Viewers/,
    );
    const viewerTask = (await svc("peer").snapshot()).tasks.find(
      (x) => x.id === t.id,
    )!;
    expect(viewerTask.canEdit).toBe(false);
    expect(viewerTask.canComment).toBe(false);
    // Someone with assigned work cannot become a viewer.
    await expect(
      svc("manager").updateProject(projectId, {
        roles: { employee: "viewer" },
      }),
    ).rejects.toThrow(/viewer/);
  });
  it("logs membership changes in the project feed", async () => {
    const feed = await svc("employee").projectActivity(projectId);
    const actions = feed.items.map((i) => i.action);
    expect(actions).toContain("member_added");
    expect(actions).toContain("member_role_changed");
    expect(actions).toContain("task_created");
  });
});

describe("archive and restore", () => {
  let projectId: string, taskId: string, childId: string;
  beforeAll(async () => {
    projectId = (
      await svc("manager").createProject({
        name: "Archive",
        memberIds: ["employee"],
      })
    ).id;
    taskId = (
      await svc("manager").createTask({
        title: "Parent",
        projectId,
        assigneeIds: ["employee"],
      })
    ).id;
    childId = (
      await svc("manager").createTask({
        title: "Child",
        projectId,
        parentId: taskId,
        assigneeIds: ["employee"],
      })
    ).id;
  });
  it("only managers archive; archived work leaves normal views and is read-only", async () => {
    await expect(svc("employee").archiveTask(taskId)).rejects.toThrow();
    await svc("manager").archiveTask(taskId);
    const snap = await svc("employee").snapshot();
    expect(snap.tasks.some((t) => t.id === taskId || t.id === childId)).toBe(
      false,
    );
    expect((await svc("manager").snapshot()).archive.tasks).toEqual([
      expect.objectContaining({ id: taskId, subtaskCount: 1 }),
    ]);
    await expect(
      svc("employee").completePart(childId, "employee", true),
    ).rejects.toThrow(/Restore/);
    await expect(svc("manager").restoreTask(childId)).rejects.toThrow(
      /parent/,
    );
    const detail = await svc("employee").taskDetail(taskId);
    expect(detail.task.archived).toBe(true);
    expect(detail.task.canEdit).toBe(false);
  });
  it("restores a task with the subtasks archived alongside it", async () => {
    await svc("manager").restoreTask(taskId);
    const ids = (await svc("employee").snapshot()).tasks.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([taskId, childId]));
  });
  it("requires archive before admin-only permanent deletion", async () => {
    await expect(svc("admin").purgeProject(projectId)).rejects.toThrow(
      /Archive/,
    );
    await svc("manager").archiveProject(projectId);
    expect(
      (await svc("employee").snapshot()).projects.some(
        (p) => p.id === projectId,
      ),
    ).toBe(false);
    await expect(
      svc("manager").createTask({
        title: "x",
        projectId,
        assigneeIds: ["manager"],
      }),
    ).rejects.toThrow(/archived/);
    await expect(svc("manager").purgeProject(projectId)).rejects.toThrow();
    await svc("manager").restoreProject(projectId);
    await svc("manager").archiveProject(projectId);
    await svc("admin").purgeProject(projectId);
    expect(
      await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.projectId, projectId)),
    ).toHaveLength(0);
    const log = (await svc("admin").archiveLog()).map((l) => l.action);
    expect(log).toContain("project_deleted_permanently");
  });
});

describe("recurring tasks, mentions, tags and fields", () => {
  let projectId: string;
  beforeAll(async () => {
    projectId = (
      await svc("manager").createProject({
        name: "Ops",
        memberIds: ["employee", "peer"],
        sectionNames: ["Weekly"],
      })
    ).id;
  });
  it("creates the next occurrence once when a recurring task completes", async () => {
    const snap = await svc("manager").snapshot();
    const sectionId = snap.projects.find((p) => p.id === projectId)!
      .sections[0].id;
    await expect(
      svc("manager").createTask({
        title: "No date",
        projectId,
        assigneeIds: ["employee"],
        recurrence: "weekly",
      }),
    ).rejects.toThrow(/due date/);
    const t = await svc("manager").createTask({
      title: "Weekly report",
      description: "Send numbers",
      projectId,
      sectionId,
      priority: "high",
      dueDate: "2099-01-05",
      assigneeIds: ["employee", "peer"],
      recurrence: "weekly",
      tags: ["Finance"],
    });
    await svc("manager").changeChecklist(t.id, {
      operation: "add",
      title: "Collect",
    });
    await svc("employee").completePart(t.id, "employee", true);
    expect(
      (await svc("manager").snapshot()).tasks.filter(
        (x) => x.title === "Weekly report",
      ),
    ).toHaveLength(1);
    await svc("peer").completePart(t.id, "peer", true);
    await svc("peer").completePart(t.id, "peer", false);
    await svc("peer").completePart(t.id, "peer", true);
    const copies = (await svc("manager").snapshot()).tasks.filter(
      (x) => x.title === "Weekly report",
    );
    expect(copies).toHaveLength(2);
    const next = copies.find((x) => x.id !== t.id)!;
    expect(next).toMatchObject({
      dueDate: "2099-01-12",
      priority: "high",
      sectionId,
      description: "Send numbers",
      recurrence: "weekly",
      status: "todo",
    });
    expect(next.assigneeIds.sort()).toEqual(["employee", "peer"]);
    expect(next.checklist.map((c) => [c.title, c.completed])).toEqual([
      ["Collect", false],
    ]);
    expect(next.tagIds).toHaveLength(1);
  });
  it("notifies mentioned project members and rejects others", async () => {
    const t = await svc("manager").createTask({
      title: "Discuss",
      projectId,
      assigneeIds: ["employee"],
    });
    await expect(
      svc("manager").addComment(t.id, "cc @[x](outsider)"),
    ).rejects.toThrow(/mention/);
    await svc("manager").addComment(t.id, "Please review @[peer](peer)");
    const notes = (await svc("peer").snapshot()).notifications.filter(
      (n) => n.taskId === t.id,
    );
    expect(notes.map((n) => n.kind)).toContain("mention");
    expect((await svc("employee").taskDetail(t.id)).mentionable).toEqual(
      expect.arrayContaining(["manager", "employee", "peer"]),
    );
  });
  it("reuses tags case-insensitively", async () => {
    const t = await svc("manager").createTask({
      title: "Tagged",
      projectId,
      assigneeIds: ["employee"],
    });
    await svc("employee").setTaskTags(t.id, { names: ["finance", "Q3"] });
    const snap = await svc("employee").snapshot();
    expect(snap.tags.filter((tag) => tag.name.toLowerCase() === "finance"))
      .toHaveLength(1);
    expect(snap.tasks.find((x) => x.id === t.id)!.tagIds).toHaveLength(2);
  });
  it("validates custom field values by type and manager scope", async () => {
    await expect(
      svc("employee").saveField(projectId, { name: "Cost", type: "number" }),
    ).rejects.toThrow();
    const { id: cost } = await svc("manager").saveField(projectId, {
      name: "Cost",
      type: "number",
    });
    const { id: stage } = await svc("manager").saveField(projectId, {
      name: "Stage",
      type: "select",
      options: ["A", "B"],
    });
    const t = await svc("manager").createTask({
      title: "Fielded",
      projectId,
      assigneeIds: ["employee"],
    });
    await expect(
      svc("employee").setFieldValue(t.id, { fieldId: cost, value: "ten" }),
    ).rejects.toThrow(/number/);
    await svc("employee").setFieldValue(t.id, { fieldId: cost, value: "10.50" });
    await svc("employee").setFieldValue(t.id, { fieldId: stage, value: "B" });
    await expect(
      svc("employee").setFieldValue(t.id, { fieldId: stage, value: "C" }),
    ).rejects.toThrow();
    let task = (await svc("employee").snapshot()).tasks.find(
      (x) => x.id === t.id,
    )!;
    expect(task.fieldValues).toEqual({ [cost]: "10.5", [stage]: "B" });
    // Dropping an option clears values that used it.
    await svc("manager").saveField(projectId, {
      id: stage,
      name: "Stage",
      type: "select",
      options: ["A"],
    });
    task = (await svc("employee").snapshot()).tasks.find((x) => x.id === t.id)!;
    expect(task.fieldValues).toEqual({ [cost]: "10.5" });
  });
  it("keeps saved views private to their owner", async () => {
    const view = await svc("employee").saveView({
      name: "Overdue",
      scope: "my-tasks",
      config: {
        filters: { due: "overdue" },
        sort: { key: "due", dir: "asc" },
        group: "",
        columns: ["status", "due"],
      },
    });
    expect((await svc("employee").snapshot()).savedViews).toHaveLength(1);
    expect((await svc("peer").snapshot()).savedViews).toHaveLength(0);
    await expect(svc("peer").removeView(view.id)).rejects.toThrow();
    await svc("employee").removeView(view.id);
  });
  it("records manual health overrides", async () => {
    await expect(
      svc("employee").setHealth(projectId, { health: "off_track" }),
    ).rejects.toThrow();
    await svc("manager").setHealth(projectId, { health: "at_risk" });
    const p = (await svc("employee").snapshot()).projects.find(
      (x) => x.id === projectId,
    )!;
    expect(p.health).toBe("at_risk");
    expect(p.healthOverride).toBe("at_risk");
    const feed = await svc("employee").projectActivity(projectId);
    expect(feed.items[0]).toMatchObject({
      action: "health_overridden",
      after: "at_risk",
    });
  });
});

describe("project templates", () => {
  it("captures a project and recreates its structure on new dates", async () => {
    const source = (
      await svc("manager").createProject({
        name: "Launch",
        startDate: "2026-01-01",
        memberIds: ["employee"],
        sectionNames: ["Plan", "Build"],
      })
    ).id;
    const snap = await svc("manager").snapshot();
    const build = snap.projects.find((p) => p.id === source)!.sections[1].id;
    const m = await svc("manager").saveMilestone(source, {
      name: "Beta",
      dueDate: "2026-01-11",
    });
    const a = await svc("manager").createTask({
      title: "Design",
      projectId: source,
      sectionId: build,
      dueDate: "2026-01-04",
      priority: "urgent",
      assigneeIds: ["employee"],
    });
    const b = await svc("manager").createTask({
      title: "Ship",
      projectId: source,
      assigneeIds: ["manager"],
    });
    await svc("manager").createTask({
      title: "Sub",
      projectId: source,
      parentId: a.id,
      assigneeIds: ["employee"],
    });
    await svc("manager").setDependency(b.id, { blockerId: a.id, enabled: true });
    await svc("manager").linkMilestone(a.id, { milestoneId: m.id });
    await svc("manager").changeChecklist(a.id, {
      operation: "add",
      title: "Sketch",
    });
    await expect(
      svc("employee").saveTemplate({ projectId: source, name: "T" }),
    ).rejects.toThrow();
    const { id: templateId } = await svc("manager").saveTemplate({
      projectId: source,
      name: "Launch kit",
      includeAssignees: true,
    });
    const template = (await svc("employee").snapshot()).templates.find(
      (t) => t.id === templateId,
    )!;
    expect(template.summary).toMatchObject({
      sections: 2,
      milestones: 1,
      tasks: 2,
      subtasks: 1,
      dependencies: 1,
      checklistItems: 1,
      assigned: true,
    });
    // An employee without reports creates from the template; assignees
    // who are not members of the new project fall back to the owner.
    const created = await svc("employee").createProject({
      name: "Second launch",
      startDate: "2026-06-01",
      templateId,
    });
    const after = await svc("employee").snapshot();
    const p = after.projects.find((x) => x.id === created.id)!;
    expect(p.sections.map((x) => x.name)).toEqual(["Plan", "Build"]);
    const tasks = after.tasks.filter((t) => t.projectId === created.id);
    const design = tasks.find((t) => t.title === "Design")!;
    const ship = tasks.find((t) => t.title === "Ship")!;
    expect(design).toMatchObject({
      dueDate: "2026-06-04",
      priority: "urgent",
      sectionId: p.sections[1].id,
    });
    expect(design.assigneeIds).toEqual(["employee"]);
    expect(ship.assigneeIds).toEqual(["employee"]);
    expect(ship.blockedBy).toEqual([design.id]);
    expect(design.checklist.map((c) => c.title)).toEqual(["Sketch"]);
    expect(tasks.some((t) => t.parentId === design.id)).toBe(true);
    const milestone = after.milestones.find(
      (x) => x.projectId === created.id,
    )!;
    expect(milestone.dueDate).toBe("2026-06-11");
    expect(design.milestoneId).toBe(milestone.id);
    // Template set-up does not flood the project feed.
    const feed = await svc("employee").projectActivity(created.id);
    expect(feed.items.map((i) => i.action)).toEqual(["project_created"]);
  });
});
