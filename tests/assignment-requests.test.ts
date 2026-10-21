import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { createService } from "../src/modules/work/service";
import type { Actor, Employee } from "../src/modules/shared/types";
// Two departments: sales (salesLead → seller) and ops (opsLead → operator).
const managers: Record<string, string | null> = {
  salesLead: null,
  seller: "salesLead",
  opsLead: null,
  operator: "opsLead",
  orphan: null,
};
const directory: Employee[] = Object.entries(managers).map(
  ([userId, managerId]) => ({
    userId,
    employeeId: userId,
    name: userId,
    email: `${userId}@test.invalid`,
    company: "Test",
    branch: "",
    department: userId.startsWith("sales") || userId === "seller" ? "Sales" : "Ops",
    jobTitle: "",
    managerId,
  }),
);
const actor = (id: string): Actor => ({
  userId: id,
  employeeId: id,
  isAdmin: false,
  directReportIds: directory
    .filter((e) => e.managerId === id)
    .map((e) => e.userId),
});
const client = new PGlite();
const db = drizzle(client, { schema });
const svc = (id: string) => createService(db, actor(id), directory);
beforeAll(async () => {
  await migrateDatabase(client);
  await db
    .insert(schema.users)
    .values(directory.map((e) => ({ id: e.userId, employeeId: e.employeeId })));
});
afterAll(async () => {
  await client.close();
});
describe("cross-department assignment approval", () => {
  it("holds the assignment until the employee's direct manager approves", async () => {
    const sales = await svc("salesLead").snapshot();
    expect(sales.crossAssignable).toEqual([
      expect.objectContaining({ userId: "operator", approverId: "opsLead" }),
    ]);
    const t = await svc("salesLead").createTask({
      title: "Ship samples",
      assigneeIds: ["seller", "operator"],
    });
    const before = await svc("salesLead").taskDetail(t.id);
    expect(before.task.assigneeIds).toEqual(["seller"]);
    expect((await svc("operator").snapshot()).tasks).toEqual([]);
    const [request] = (await svc("opsLead").snapshot()).assignmentApprovals;
    expect(request).toMatchObject({
      taskId: t.id,
      userId: "operator",
      requestedBy: "salesLead",
      task: { title: "Ship samples" },
    });
    await expect(
      svc("salesLead").decideAssignment(request.id, { approve: true }),
    ).rejects.toThrow(/direct manager/);
    await svc("opsLead").decideAssignment(request.id, { approve: true });
    const after = await svc("salesLead").taskDetail(t.id);
    expect(after.task.assigneeIds.sort()).toEqual(["operator", "seller"]);
    expect((await svc("operator").snapshot()).tasks.map((x) => x.id)).toEqual(
      [t.id],
    );
    expect(
      (await svc("salesLead").snapshot()).notifications.map((n) => n.kind),
    ).toContain("assignment_approved");
    await expect(
      svc("opsLead").decideAssignment(request.id, { approve: false }),
    ).rejects.toThrow(/already been decided/);
  });
  it("leaves the task unassigned to the employee when the manager rejects", async () => {
    const t = await svc("salesLead").createTask({
      title: "Weekend shift",
      assigneeIds: ["operator"],
    });
    const [request] = (await svc("opsLead").snapshot()).assignmentApprovals;
    await svc("opsLead").decideAssignment(request.id, {
      approve: false,
      note: "Fully booked",
    });
    const snap = await svc("salesLead").snapshot();
    expect(snap.tasks.find((x) => x.id === t.id)?.assigneeIds).toEqual([]);
    expect(snap.assignmentRequests).toEqual([
      expect.objectContaining({
        taskId: t.id,
        status: "rejected",
        decisionNote: "Fully booked",
      }),
    ]);
    expect((await svc("opsLead").snapshot()).assignmentApprovals).toEqual([]);
  });
  it("only lets managers request employees who have a direct manager", async () => {
    await expect(
      svc("seller").createTask({ title: "No", assigneeIds: ["operator"] }),
    ).rejects.toThrow(/below you/);
    await expect(
      svc("salesLead").createTask({ title: "No", assigneeIds: ["orphan"] }),
    ).rejects.toThrow(/below you/);
  });
});
