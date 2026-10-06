import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrateDatabase } from "../src/db/migrate";
it("retains work after reopening the persistent database and reapplies migrations safely", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "task-storage-test-"));
  let client = new PGlite(path.join(dir, "db"));
  try {
    await migrateDatabase(client);
    await client.query(
      "INSERT INTO users (id,employee_id) VALUES ('storage-user','storage-employee')",
    );
    await client.close();
    client = new PGlite(path.join(dir, "db"));
    await migrateDatabase(client);
    const result = await client.query<{ id: string }>("SELECT id FROM users");
    expect(result.rows).toEqual([{ id: "storage-user" }]);
  } finally {
    await client.close();
    // Only remove the exact temporary directory created by this test.
    if (
      path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep) &&
      path.basename(dir).startsWith("task-storage-test-")
    )
      await rm(dir, { recursive: true, force: true });
  }
});
