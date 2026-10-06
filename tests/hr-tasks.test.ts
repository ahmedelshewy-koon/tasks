import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { GET } from "../src/app/api/hr/tasks/route";

vi.mock("../src/db", () => ({ getDb: () => db }));
const client = new PGlite();
const db = drizzle(client, { schema });
beforeAll(async () => {
  await migrateDatabase(client);
  await db.insert(schema.users).values([
    { id: "7", employeeId: "17" },
    { id: "8", employeeId: "18" },
  ]);
  await db.insert(schema.tasks).values([
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "My private task",
      creatorId: "7",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      title: "Other private task",
      creatorId: "8",
    },
  ]);
  await db.insert(schema.assignees).values([
    { taskId: "00000000-0000-4000-8000-000000000001", userId: "7" },
    { taskId: "00000000-0000-4000-8000-000000000002", userId: "8" },
  ]);
});
afterAll(() => client.close());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("requires a current HR session and disables the bridge in development identity mode", async () => {
  expect((await GET(new Request("http://task/api/hr/tasks"))).status).toBe(401);
  vi.stubEnv("TASK_AUTH_MODE", "development");
  expect(
    (
      await GET(
        new Request("http://task/api/hr/tasks", {
          headers: { authorization: "Bearer local-admin" },
        }),
      )
    ).status,
  ).toBe(401);
});
it("uses the validated HR identity, ignoring a caller supplied user ID", async () => {
  vi.stubEnv("TASK_AUTH_MODE", "hr");
  vi.stubEnv("HR_API_URL", "http://hr/api/task");
  const me = {
    userId: "7",
    employeeId: "17",
    name: "Employee",
    email: "employee@example.com",
    company: "",
    branch: "",
    department: "",
    jobTitle: "",
    managerId: null,
    isHrAdmin: true,
  };
  vi.stubGlobal("fetch", async () =>
    Response.json({ me, employees: [me], directReports: [] }),
  );
  const response = await GET(
    new Request("http://task/api/hr/tasks?userId=8", {
      headers: { authorization: "Bearer valid-hr-session" },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    tasks: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "My private task",
        status: "todo",
        priority: "medium",
        dueDate: null,
        projectName: null,
      },
    ],
  });
});
it("rejects expired HR sessions without returning task data", async () => {
  vi.stubEnv("TASK_AUTH_MODE", "hr");
  vi.stubEnv("HR_API_URL", "http://hr/api/task");
  vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
  const response = await GET(
    new Request("http://task/api/hr/tasks", {
      headers: { authorization: "Bearer expired" },
    }),
  );
  expect(response.status).toBe(401);
  expect(await response.json()).not.toHaveProperty("tasks");
});
