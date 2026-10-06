import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { createService } from "../src/modules/work/service";
import { dueInstant, reminderKind } from "../src/modules/work/reminders";
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
const client = new PGlite(),
  db = drizzle(client, { schema });
const svc = (userId: string) =>
  createService(
    db,
    {
      userId,
      employeeId: userId,
      isAdmin: userId === "admin",
      directReportIds: userId === "manager" ? ["employee", "peer"] : [],
    } as Actor,
    directory,
  );
let projectId: string, a: string, b: string, c: string;
beforeAll(async () => {
  await migrateDatabase(client);
  await db
    .insert(schema.users)
    .values(directory.map((e) => ({ id: e.userId, employeeId: e.employeeId })));
  const p = await svc("manager").createProject({
    name: "Delivery",
    memberIds: ["employee", "peer"],
  });
  projectId = p.id;
  const create = (title: string) =>
    svc("manager").createTask({
      title,
      projectId,
      assigneeIds: ["employee", "peer"],
    });
  a = (await create("A")).id;
  b = (await create("B")).id;
  c = (await create("C")).id;
});
afterAll(async () => {
  vi.useRealTimers();
  await client.close();
});
describe("project management features", () => {
  it("rejects unauthorized, cross-project, self and indirect circular dependencies", async () => {
    await expect(
      svc("employee").setDependency(a, { blockerId: b, enabled: true }),
    ).rejects.toThrow();
    await svc("manager").setDependency(a, { blockerId: b, enabled: true });
    await svc("manager").setDependency(b, { blockerId: c, enabled: true });
    await expect(
      svc("manager").setDependency(c, { blockerId: a, enabled: true }),
    ).rejects.toThrow("Circular");
    await expect(
      svc("manager").setDependency(c, { blockerId: c, enabled: true }),
    ).rejects.toThrow("Circular");
    const other = await svc("employee").createTask({
      title: "Personal",
      assigneeIds: ["employee"],
    });
    await expect(
      svc("admin").setDependency(a, { blockerId: other.id, enabled: true }),
    ).rejects.toThrow("same project");
    expect((await svc("employee").taskDetail(a)).task.blocked).toBe(true);
  });
  it("uses overall multi-assignee completion and reblocks reopened work", async () => {
    await svc("employee").completePart(b, "employee", true);
    expect((await svc("employee").taskDetail(b)).task.status).toBe(
      "in_progress",
    );
    expect((await svc("employee").taskDetail(a)).task.blocked).toBe(true);
    await svc("peer").completePart(b, "peer", true);
    expect((await svc("employee").taskDetail(a)).task.blocked).toBe(false);
    await svc("peer").completePart(b, "peer", false);
    expect((await svc("employee").taskDetail(a)).task.blocked).toBe(true);
    await svc("manager").setDependency(a, { blockerId: b, enabled: false });
    expect((await svc("employee").taskDetail(a)).task.blockedBy).toEqual([]);
  });
  it("serializes opposing edge creation to prevent concurrent cycles", async () => {
    const result = await Promise.allSettled([
      svc("manager").setDependency(a, { blockerId: b, enabled: true }),
      svc("manager").setDependency(b, { blockerId: a, enabled: true }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("validates milestone ownership, linking, dates and activity", async () => {
    const input = { name: "Launch", dueDate: "2026-11-10" };
    await expect(
      svc("employee").saveMilestone(projectId, input),
    ).rejects.toThrow();
    await expect(
      svc("manager").saveMilestone(projectId, {
        ...input,
        dueDate: "2026-02-30",
      }),
    ).rejects.toThrow();
    const m = await svc("manager").saveMilestone(projectId, input);
    await expect(
      svc("employee").linkMilestone(a, { milestoneId: m.id }),
    ).rejects.toThrow();
    await svc("manager").linkMilestone(a, { milestoneId: m.id });
    await svc("manager").saveMilestone(projectId, {
      ...input,
      id: m.id,
      status: "completed",
    });
    expect((await svc("employee").taskDetail(a)).task.milestoneId).toBe(m.id);
    expect((await svc("outsider").snapshot()).milestones).toEqual([]);
    const p2 = await svc("admin").createProject({ name: "Other" });
    const m2 = await svc("admin").saveMilestone(p2.id, input);
    await expect(
      svc("admin").linkMilestone(a, { milestoneId: m2.id }),
    ).rejects.toThrow();
    await svc("manager").linkMilestone(a, { milestoneId: null });
    expect(
      (await svc("manager").snapshot()).projectActivity.map((l) => l.action),
    ).toEqual(
      expect.arrayContaining(["milestone_created", "milestone_updated"]),
    );
    expect(
      (await svc("employee").taskDetail(a)).activity.map((l) => l.action),
    ).toEqual(
      expect.arrayContaining(["milestone_linked", "milestone_unlinked"]),
    );
  });
  it("keeps checklist items separate, reorders exactly, and rejects cross-task updates", async () => {
    const before = (await svc("employee").snapshot()).tasks.length;
    await svc("employee").changeChecklist(a, {
      operation: "add",
      title: "Review",
    });
    await svc("employee").changeChecklist(a, {
      operation: "add",
      title: "Sign off",
    });
    const items = (await svc("employee").taskDetail(a)).task.checklist;
    await svc("employee").changeChecklist(a, {
      operation: "update",
      itemId: items[0].id,
      completed: true,
    });
    await svc("employee").changeChecklist(a, {
      operation: "update",
      itemId: items[0].id,
      completed: false,
    });
    await svc("employee").changeChecklist(a, {
      operation: "reorder",
      ids: items.map((i) => i.id).reverse(),
    });
    expect((await svc("employee").taskDetail(a)).task.checklist[0].title).toBe(
      "Sign off",
    );
    await expect(
      svc("employee").changeChecklist(b, {
        operation: "update",
        itemId: items[0].id,
        completed: true,
      }),
    ).rejects.toThrow();
    await expect(
      svc("employee").changeChecklist(a, {
        operation: "reorder",
        ids: [items[0].id, items[0].id],
      }),
    ).rejects.toThrow();
    await expect(
      svc("outsider").changeChecklist(a, {
        operation: "add",
        title: "Forbidden",
      }),
    ).rejects.toThrow();
    expect((await svc("employee").snapshot()).tasks).toHaveLength(before);
    expect(
      (await svc("employee").taskDetail(a)).activity.map((l) => l.action),
    ).toEqual(
      expect.arrayContaining([
        "checklist_added",
        "checklist_completed",
        "checklist_reopened",
      ]),
    );
  });
  it("allows members to see features but only assignees to edit checklists and reminders", async () => {
    const task = await svc("manager").createTask({
      title: "Peer work",
      projectId,
      assigneeIds: ["peer"],
    });
    expect((await svc("employee").taskDetail(task.id)).task.canEdit).toBe(
      false,
    );
    await expect(
      svc("employee").changeChecklist(task.id, {
        operation: "add",
        title: "No",
      }),
    ).rejects.toThrow();
    await expect(
      svc("employee").changeReminder(task.id, { minutes: 60 }),
    ).rejects.toThrow();
  });
  it("enforces report permissions and excludes projects merely joined by a manager", async () => {
    await expect(svc("employee").report()).rejects.toThrow();
    const p = await svc("admin").createProject({
      name: "Not managed",
      memberIds: ["manager"],
    });
    expect(
      (await svc("manager").snapshot()).projects.some(
        (item) => item.id === p.id,
      ),
    ).toBe(true);
    expect(
      (await svc("manager").report()).projects.some((item) => item.id === p.id),
    ).toBe(false);
    expect(
      (await svc("admin").report()).projects.some((item) => item.id === p.id),
    ).toBe(true);
  });
  it("honors reminder timing, validates options and deduplicates changes and runs", async () => {
    const task = await svc("employee").createTask({
      title: "Reminder",
      assigneeIds: ["employee"],
      dueDate: "2026-11-15",
    });
    expect(task.reminderMinutes).toBe(1440);
    await expect(
      svc("employee").changeReminder(task.id, { minutes: -1 }),
    ).rejects.toThrow();
    await svc("employee").changeReminder(task.id, { minutes: 60 });
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(dueInstant("2026-11-15") - 61 * 60000));
      await svc("employee").reconcileDue();
      expect(
        (await svc("employee").snapshot()).notifications.filter(
          (n) => n.taskId === task.id,
        ),
      ).toHaveLength(0);
      vi.setSystemTime(new Date(dueInstant("2026-11-15") - 60 * 60000));
      await svc("employee").reconcileDue();
      await svc("employee").reconcileDue();
      await svc("employee").changeReminder(task.id, { minutes: 4320 });
      await svc("employee").reconcileDue();
      expect(
        (await svc("employee").snapshot()).notifications.filter(
          (n) => n.taskId === task.id,
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it("handles Cairo summer/winter offsets and exact reminder thresholds", () => {
    expect(new Date(dueInstant("2026-07-01")).toISOString()).toBe(
      "2026-07-01T20:59:59.000Z",
    );
    expect(new Date(dueInstant("2026-12-01")).toISOString()).toBe(
      "2026-12-01T21:59:59.000Z",
    );
    const task = { dueDate: "2026-12-01", reminderMinutes: 4320 };
    expect(
      reminderKind(task, new Date(dueInstant(task.dueDate) - 4320 * 60000 - 1)),
    ).toBeNull();
    expect(
      reminderKind(task, new Date(dueInstant(task.dueDate) - 4320 * 60000)),
    ).toBe("upcoming");
    expect(reminderKind(task, new Date(dueInstant(task.dueDate) + 1))).toBe(
      "overdue",
    );
  });
});
