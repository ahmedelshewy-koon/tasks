import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { GET } from "../src/app/api/hr/team-tasks/route";

vi.mock("../src/db", () => ({ getDb: () => db }));
const client = new PGlite();
const db = drizzle(client, { schema });
const visible = "00000000-0000-4000-8000-0000000000a1";
const hidden = "00000000-0000-4000-8000-0000000000a2";
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const person = (userId: string, name: string, managerId: string | null) => ({
  userId,
  employeeId: `1${userId}`,
  name,
  email: `${userId}@example.com`,
  company: "",
  branch: "",
  department: "",
  jobTitle: "",
  managerId,
});
const manager = person("1", "Manager", null);
const report = person("2", "Report", "11");
const outsider = person("3", "Outsider", null);

beforeAll(async () => {
  await migrateDatabase(client);
  await db.insert(schema.users).values([
    { id: "1", employeeId: "11" },
    { id: "2", employeeId: "12" },
    { id: "3", employeeId: "13" },
  ]);
  await db.insert(schema.projects).values([
    { id: visible, name: "Portal", ownerId: "1" },
    { id: hidden, name: "Elsewhere", ownerId: "3" },
  ]);
  await db.insert(schema.members).values([
    { projectId: visible, userId: "1" },
    { projectId: visible, userId: "2" },
    { projectId: visible, userId: "3" },
    { projectId: hidden, userId: "2" },
    { projectId: hidden, userId: "3" },
  ]);
  const task = (
    n: number,
    title: string,
    extra: Partial<typeof schema.tasks.$inferInsert> = {},
  ) => ({ id: id(n), title, projectId: visible, creatorId: "1", ...extra });
  await db.insert(schema.tasks).values([
    task(1, "Later", { dueDate: "2026-10-10" }),
    task(2, "Soonest", { dueDate: "2026-10-05", status: "in_progress" }),
    task(3, "Finished", { dueDate: "2026-10-01", status: "done" }),
    task(4, "Outsider work", { dueDate: "2026-10-02" }),
    task(5, "Undated"),
    task(6, "Not visible to manager", {
      projectId: hidden,
      creatorId: "3",
      dueDate: "2026-10-03",
    }),
  ]);
  await db.insert(schema.assignees).values([
    { taskId: id(1), userId: "2" },
    { taskId: id(2), userId: "2" },
    { taskId: id(3), userId: "2" },
    { taskId: id(4), userId: "3" },
    { taskId: id(5), userId: "2" },
    { taskId: id(6), userId: "2" },
  ]);
});
afterAll(() => client.close());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const request = (me: typeof manager) => {
  vi.stubEnv("TASK_AUTH_MODE", "hr");
  vi.stubEnv("HR_API_URL", "http://hr/api/task");
  vi.stubGlobal("fetch", async () =>
    Response.json({
      me,
      employees: [manager, report, outsider],
      directReports: me === manager ? [report] : [],
    }),
  );
  return GET(
    new Request("http://task/api/hr/team-tasks", {
      headers: { authorization: "Bearer valid-hr-session" },
    }),
  );
};

it("requires a current HR session", async () => {
  expect(
    (await GET(new Request("http://task/api/hr/team-tasks"))).status,
  ).toBe(401);
});
it("returns reports' open, visible tasks nearest due date first", async () => {
  const response = await request(manager);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const { tasks } = await response.json();
  expect(tasks.map((t: { title: string }) => t.title)).toEqual([
    "Soonest",
    "Later",
    "Undated",
  ]);
  expect(tasks[0]).toEqual({
    id: id(2),
    title: "Soonest",
    status: "in_progress",
    priority: "medium",
    dueDate: "2026-10-05",
    projectName: "Portal",
    assignees: ["Report"],
  });
});
it("returns nothing to employees without reports", async () => {
  expect(await (await request(outsider)).json()).toEqual({ tasks: [] });
});
