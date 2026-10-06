import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { createService } from "../src/modules/work/service";
import { subordinateUserIds } from "../src/modules/hr/hierarchy";
import type { Actor, Employee } from "../src/modules/shared/types";
const directory: Employee[] = [
  "admin",
  "manager",
  "employee",
  "peer",
  "outsider",
].map((userId) => ({
  userId,
  employeeId: userId,
  name: userId,
  email: `${userId}@test.invalid`,
  company: "Test",
  branch: "",
  department: "",
  jobTitle: "",
  managerId: ["employee", "peer"].includes(userId) ? "manager" : null,
}));
const actor = (id: string): Actor => ({
  userId: id,
  employeeId: id,
  isAdmin: id === "admin",
  directReportIds: id === "manager" ? ["employee", "peer"] : [],
});
const client = new PGlite();
const db = drizzle(client, { schema });
const svc = (id: string) => createService(db, actor(id), directory);
let projectId: string, taskId: string;
beforeAll(async () => {
  await migrateDatabase(client);
  await db
    .insert(schema.users)
    .values(directory.map((e) => ({ id: e.userId, employeeId: e.employeeId })));
});
afterAll(async () => {
  await client.close();
});
describe("real PostgreSQL work flows", () => {
  it("returns only assigned visible tasks for the HR dashboard, even for admins", async () => {
    const p = await svc("admin").createProject({
      name: "HR dashboard",
      memberIds: ["employee", "peer"],
    });
    const own = await svc("admin").createTask({
      title: "Mine",
      projectId: p.id,
      assigneeIds: ["employee"],
    });
    await svc("admin").createTask({
      title: "Peer only",
      projectId: p.id,
      assigneeIds: ["peer"],
    });
    const removed = await svc("admin").createTask({
      title: "Removed",
      projectId: p.id,
      assigneeIds: ["employee"],
    });
    await svc("admin").deleteTask(removed.id);
    expect(await svc("employee").myTasks()).toEqual([
      expect.objectContaining({
        id: own.id,
        title: "Mine",
        projectName: "HR dashboard",
      }),
    ]);
    expect(await svc("admin").myTasks()).toEqual([]);
    await svc("admin").deleteProject(p.id);
    expect(await svc("employee").myTasks()).toEqual([]);
  });
  it("protects administration and retains at least one admin", async () => {
    await db.insert(schema.admins).values({ userId: "admin" });
    await expect(svc("employee").setAdmin("peer", true)).rejects.toThrow();
    await expect(svc("admin").setAdmin("admin", false)).rejects.toThrow();
    await svc("admin").setAdmin("peer", true);
    expect(
      (await svc("admin").listAdmins()).map((a) => a.userId).sort(),
    ).toEqual(["admin", "peer"]);
    await svc("admin").setAdmin("peer", false);
  });
  it("creates a project with only valid team members", async () => {
    await expect(
      svc("employee").createProject({ name: "Invalid", memberIds: ["peer"] }),
    ).rejects.toThrow();
    await svc("employee").createProject({ name: "Own", memberIds: [] });
    await expect(
      svc("manager").createProject({
        name: "Invalid",
        memberIds: ["outsider"],
      }),
    ).rejects.toThrow();
    const p = await svc("manager").createProject({
      name: "Launch",
      memberIds: ["employee", "peer"],
      sectionNames: ["Planning", "Delivery"],
    });
    projectId = p.id;
    expect(p.name).toBe("Launch");
    expect((await svc("outsider").snapshot()).projects).toHaveLength(0);
    expect((await svc("employee").snapshot()).projects).toHaveLength(2);
  });
  it("denies foreign assignees and creates a shared task transactionally", async () => {
    await expect(
      svc("manager").createTask({
        title: "Invalid",
        projectId,
        assigneeIds: ["outsider"],
      }),
    ).rejects.toThrow();
    const task = await svc("manager").createTask({
      title: "Prepare release",
      projectId,
      assigneeIds: ["employee", "peer"],
      dueDate: "2026-10-05",
    });
    taskId = task.id;
    expect(
      (await svc("employee").snapshot()).notifications.some(
        (n) => n.kind === "assignment",
      ),
    ).toBe(true);
    await expect(svc("outsider").taskDetail(taskId)).rejects.toThrow();
    await expect(
      svc("outsider").updateTask(taskId, { title: "Hack" }),
    ).rejects.toThrow();
  });
  it("allows comments by members, rejects non-assignee edits and prevents employee reassignment", async () => {
    const own = await svc("employee").createTask({
      title: "Own work",
      projectId,
      assigneeIds: ["employee"],
    });
    await svc("peer").addComment(own.id, "Looks good");
    await expect(
      svc("peer").updateTask(own.id, { title: "Changed" }),
    ).rejects.toThrow();
    await expect(
      svc("employee").updateTask(own.id, { assigneeIds: ["peer"] }),
    ).rejects.toThrow();
    expect((await svc("employee").taskDetail(own.id)).comments).toHaveLength(1);
  });
  it("preserves completion per user, requires all, and reopens correctly", async () => {
    await svc("employee").completePart(taskId, "employee", true);
    expect((await svc("manager").taskDetail(taskId)).task.status).toBe(
      "in_progress",
    );
    await expect(
      svc("employee").completePart(taskId, "peer", true),
    ).rejects.toThrow();
    await svc("peer").completePart(taskId, "peer", true);
    expect((await svc("manager").taskDetail(taskId)).task.status).toBe("done");
    await svc("employee").completePart(taskId, "employee", false);
    expect((await svc("manager").taskDetail(taskId)).task.status).toBe(
      "in_progress",
    );
  });
  it("enforces parent completion and shared project for subtasks", async () => {
    const sub = await svc("manager").createTask({
      title: "Review",
      parentId: taskId,
      projectId,
      assigneeIds: ["employee"],
    });
    await svc("employee").completePart(taskId, "employee", true);
    expect((await svc("manager").taskDetail(taskId)).task.status).toBe(
      "in_progress",
    );
    await svc("employee").completePart(sub.id, "employee", true);
    expect((await svc("manager").taskDetail(taskId)).task.status).toBe("done");
    expect((await svc("manager").taskDetail(taskId)).task.progress).toBe(100);
    await expect(
      svc("manager").createTask({
        title: "Nested",
        parentId: sub.id,
        projectId,
        assigneeIds: ["employee"],
      }),
    ).rejects.toThrow();
  });
  it("keeps personal tasks, attachments, and notifications private", async () => {
    const privateTask = await svc("employee").createTask({
      title: "Private",
      assigneeIds: ["employee"],
    });
    const file = await svc("employee").addAttachment(
      privateTask.id,
      "notes.txt",
      Buffer.from("private"),
    );
    await expect(svc("manager").taskDetail(privateTask.id)).rejects.toThrow();
    await expect(svc("manager").getAttachment(file.id)).rejects.toThrow();
    expect((await svc("admin").getAttachment(file.id)).content.toString()).toBe(
      "private",
    );
    expect(
      (await svc("manager").snapshot()).tasks.some(
        (t) => t.id === privateTask.id,
      ),
    ).toBe(false);
    expect(
      (await svc("admin").snapshot()).tasks.some(
        (t) => t.id === privateTask.id,
      ),
    ).toBe(true);
  });
  it("deduplicates due reminders, preserves deletion audit, and hides deleted tasks", async () => {
    const overdue = await svc("employee").createTask({
      title: "Due work",
      assigneeIds: ["employee"],
      dueDate: "2026-01-01",
    });
    await svc("employee").reconcileDue("2026-10-04");
    await svc("employee").reconcileDue("2026-10-04");
    const notes = (await svc("employee").snapshot()).notifications.filter(
      (n) => n.taskId === overdue.id && n.kind === "overdue",
    );
    expect(notes).toHaveLength(1);
    await svc("employee").deleteTask(overdue.id);
    await expect(svc("employee").taskDetail(overdue.id)).rejects.toThrow();
    const logs = await db.select().from(schema.activity);
    expect(
      logs.some((l) => l.taskId === overdue.id && l.action === "task_deleted"),
    ).toBe(true);
  });
  it("rejects impossible dates and reversed project dates", async () => {
    await expect(
      svc("employee").createTask({
        title: "Invalid",
        dueDate: "2026-02-30",
        assigneeIds: ["employee"],
      }),
    ).rejects.toThrow();
    await expect(
      svc("manager").updateProject(projectId, {
        startDate: "2026-11-01",
        dueDate: "2026-10-01",
      }),
    ).rejects.toThrow();
  });
  it("preserves a completed part when saving metadata on a shared task", async () => {
    const t = await svc("manager").createTask({
      title: "Shared metadata",
      projectId,
      assigneeIds: ["employee", "peer"],
    });
    await svc("employee").completePart(t.id, "employee", true);
    await svc("employee").updateTask(t.id, {
      title: "Renamed",
      status: "in_progress",
    });
    expect(
      (await svc("employee").taskDetail(t.id)).task.assignments.find(
        (a) => a.userId === "employee",
      )?.completed,
    ).toBe(true);
    await svc("peer").completePart(t.id, "peer", true);
    await expect(
      svc("manager").updateTask(t.id, {
        title: "Manager edit",
        status: "done",
      }),
    ).resolves.toEqual({ id: t.id });
  });
  it("inherits private parent visibility for admin-created subtasks", async () => {
    const parent = await svc("employee").createTask({
      title: "Private parent",
      assigneeIds: ["employee"],
    });
    const child = await svc("admin").createTask({
      title: "Private child",
      parentId: parent.id,
      assigneeIds: ["employee"],
    });
    expect((await svc("employee").taskDetail(child.id)).task.creatorId).toBe(
      "employee",
    );
    await expect(svc("manager").taskDetail(child.id)).rejects.toThrow();
    await svc("employee").deleteTask(parent.id);
    await expect(svc("employee").taskDetail(child.id)).rejects.toThrow();
  });
  it("rechecks assignments after a delayed edit acquires its transaction", async () => {
    const t = await svc("manager").createTask({
      title: "Protected",
      projectId,
      assigneeIds: ["employee"],
    });
    let release!: () => void, entered!: () => void;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = db.transaction.bind(db);
    const spy = vi
      .spyOn(db, "transaction")
      .mockImplementationOnce(async (...args) => {
        entered();
        await paused;
        return original(...args);
      });
    const delayed = svc("employee").updateTask(t.id, {
      title: "Unauthorized stale edit",
    });
    const outcome = delayed.then(
      () => false,
      () => true,
    );
    await ready;
    await svc("manager").updateTask(t.id, { assigneeIds: ["peer"] });
    release();
    expect(await outcome).toBe(true);
    expect((await svc("manager").taskDetail(t.id)).task.title).toBe(
      "Protected",
    );
    spy.mockRestore();
  });
  it("rejects a child if its parent is deleted before insertion", async () => {
    const parent = await svc("employee").createTask({
      title: "Parent race",
      assigneeIds: ["employee"],
    });
    let release!: () => void, entered!: () => void;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = db.transaction.bind(db);
    const spy = vi
      .spyOn(db, "transaction")
      .mockImplementationOnce(async (...args) => {
        entered();
        await paused;
        return original(...args);
      });
    const pending = svc("employee").createTask({
      title: "Orphan",
      parentId: parent.id,
      assigneeIds: ["employee"],
    });
    const outcome = pending.then(
      () => false,
      () => true,
    );
    await ready;
    await svc("employee").deleteTask(parent.id);
    release();
    expect(await outcome).toBe(true);
    spy.mockRestore();
  });
});

it("enforces the full HR hierarchy on project membership, task creation and reassignment", async () => {
  const people: Employee[] = [
    ["org-boss", null],
    ["org-manager", "org-boss"],
    ["org-lead", "org-manager"],
    ["org-junior", "org-lead"],
    ["org-peer", "org-boss"],
  ].map(([id, manager]) => ({
    userId: id!,
    employeeId: `employee-${id}`,
    name: id!,
    email: `${id}@example.com`,
    managerId: manager ? `employee-${manager}` : null,
    company: "Test",
    department: "",
    branch: "",
    jobTitle: "",
  }));
  const serviceFor = (id: string, employees = people) => {
    const me = employees.find((e) => e.userId === id)!;
    return createService(
      db,
      {
        userId: me.userId,
        employeeId: me.employeeId,
        isAdmin: id === "org-boss",
        directReportIds: employees
          .filter((e) => e.managerId === me.employeeId)
          .map((e) => e.userId),
        subordinateIds: subordinateUserIds(me, employees),
      },
      employees,
    );
  };
  const boss = serviceFor("org-boss");
  const manager = serviceFor("org-manager");
  const ownProject = await manager.createProject({
    name: "Whole reporting tree",
    memberIds: ["org-junior"],
  });
  expect(ownProject).toBeDefined();
  await expect(
    manager.createProject({ name: "Wrong direction", memberIds: ["org-boss"] }),
  ).rejects.toThrow();
  const shared = await boss.createProject({
    name: "Shared hierarchy",
    memberIds: ["org-manager", "org-lead", "org-junior", "org-peer"],
  });
  const work = await manager.createTask({
    title: "Delegate across levels",
    projectId: shared.id,
    assigneeIds: ["org-junior"],
  });
  expect(
    (await serviceFor("org-junior").taskDetail(work.id)).task.assigneeIds,
  ).toEqual(["org-junior"]);
  await manager.updateTask(work.id, { assigneeIds: ["org-lead"] });
  expect((await manager.taskDetail(work.id)).task.assigneeIds).toEqual([
    "org-lead",
  ]);
  for (const forbidden of ["org-boss", "org-peer"]) {
    await expect(
      manager.createTask({
        title: "Forbidden",
        projectId: shared.id,
        assigneeIds: [forbidden],
      }),
    ).rejects.toThrow();
    await expect(
      manager.updateTask(work.id, { assigneeIds: [forbidden] }),
    ).rejects.toThrow();
  }
  const transferred = people.map((e) =>
    e.userId === "org-junior" ? { ...e, managerId: "employee-org-peer" } : e,
  );
  await expect(
    serviceFor("org-manager", transferred).updateTask(work.id, {
      assigneeIds: ["org-junior"],
    }),
  ).rejects.toThrow();
  await expect(
    boss.createTask({
      title: "Admin exception",
      projectId: shared.id,
      assigneeIds: ["org-peer"],
    }),
  ).resolves.toBeDefined();
});
