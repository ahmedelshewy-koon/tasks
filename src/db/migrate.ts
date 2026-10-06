import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
export async function migrateDatabase(client: {
  query: (sql: string) => Promise<unknown>;
}) {
  await client.query(
    "CREATE TABLE IF NOT EXISTS task_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  const applied = (await client.query("SELECT name FROM task_migrations")) as {
    rows: { name: string }[];
  };
  const folder = path.join(process.cwd(), "drizzle");
  for (const name of (await readdir(folder))
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort()) {
    if (applied.rows.some((r) => r.name === name)) continue;
    await client.query("BEGIN");
    try {
      for (const statement of (
        await readFile(path.join(folder, name), "utf8")
      ).split("--> statement-breakpoint"))
        if (statement.trim()) await client.query(statement);
      await client.query(
        `INSERT INTO task_migrations (name) VALUES ('${name.replaceAll("'", "''")}')`,
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}
