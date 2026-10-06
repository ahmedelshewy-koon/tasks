import { Pool } from "pg";
import { migrateDatabase } from "../src/db/migrate";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before running migrations.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await migrateDatabase(client);
  console.log("Database migrations applied.");
} finally {
  client.release();
  await pool.end();
}
