import { PGlite } from "@electric-sql/pglite";
import {
  drizzle as pgliteDrizzle,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { drizzle as postgresDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";
import { migrateDatabase } from "./migrate";
export type Database = PgliteDatabase<typeof schema>;
const globalDb = globalThis as unknown as { taskDb?: Promise<Database> };
export function getDb(): Promise<Database> {
  const pending = (globalDb.taskDb ??= (async () => {
    if (process.env.DATABASE_URL) {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
      // Idle clients can error (e.g. DB restart); without a listener Node would crash.
      pool.on("error", (error) =>
        console.error("TASK database pool error", error.message),
      );
      return postgresDrizzle(pool, { schema }) as unknown as Database;
    }
    if (process.env.NODE_ENV === "production")
      throw new Error("DATABASE_URL is required in production.");
    const directory = process.env.TASK_DATA_DIR || ".data/postgres";
    // Development data is runtime state, never part of a production bundle.
    await mkdir(path.resolve(/* turbopackIgnore: true */ directory), {
      recursive: true,
    });
    const client = new PGlite(directory);
    await migrateDatabase(client);
    return pgliteDrizzle(client, { schema });
  })());
  return pending.catch((error) => {
    globalDb.taskDb = undefined;
    throw error;
  });
}
