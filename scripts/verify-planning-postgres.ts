/**
 * Integration smoke check on an isolated PostgreSQL CI database.
 * Guardrails intentionally reject any non-CI database or non-local host.
 */
import pg from "pg";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {migrateDatabase} from "../src/db/migrate";
const dbUrl=process.env.DATABASE_URL;
if(process.env.CI!=="true"||!dbUrl)throw new Error("Dedicated CI environment required.");
const parsed=new URL(dbUrl);
if(!["localhost","127.0.0.1"].includes(parsed.hostname)||parsed.pathname!=="/task_ci")
 throw new Error("Refusing to run outside dedicated local task_ci database.");
const client=new pg.Client({connectionString:dbUrl});
await client.connect();
try{
 await client.query("CREATE TABLE IF NOT EXISTS task_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())");
 for(const name of ["0000_early_rogue.sql","0001_project_features.sql","0002_advanced_core.sql"]){
  await client.query("BEGIN");
  try{
   for(const statement of (await readFile(path.join(process.cwd(),"drizzle",name),"utf8")).split("--> statement-breakpoint"))
    if(statement.trim())await client.query(statement);
   await client.query("INSERT INTO task_migrations(name) VALUES ($1)",[name]);
   await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}
 }
 await client.query("INSERT INTO users(id, employee_id) VALUES ('ci-owner','ci-owner')");
 const p=await client.query<{id:string}>("INSERT INTO projects(name,owner_id) VALUES ('Existing client project','ci-owner') RETURNING id");
 const projectId=p.rows[0].id;
 const t=await client.query<{id:string}>("INSERT INTO tasks(title,project_id,creator_id,due_date) VALUES ('Original task',$1,'ci-owner','2026-12-01') RETURNING id",[projectId]);
 const taskId=t.rows[0].id;
 await client.query("INSERT INTO comments(task_id,user_id,body) VALUES ($1,'ci-owner','Existing comment')",[taskId]);
 await migrateDatabase(client);
 await migrateDatabase(client);
 const task=await client.query("SELECT title,due_date,project_id FROM tasks WHERE id=$1",[taskId]);
 if(task.rowCount!==1||task.rows[0].title!=="Original task"||task.rows[0].due_date.toISOString().slice(0,10)!=="2026-12-01"||task.rows[0].project_id!==projectId)
  throw new Error("Existing task changed during additive migrations.");
 const comments=await client.query("SELECT count(*)::int AS count FROM comments WHERE task_id=$1",[taskId]);
 if(comments.rows[0].count!==1)throw new Error("Existing comment lost.");
 const migrations=await client.query("SELECT name FROM task_migrations ORDER BY name");
 if(migrations.rows.length!==7)throw new Error("Unexpected migration count: "+migrations.rows.length);
 const tables=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'planning_%'");
 if(tables.rows.length<11)throw new Error("Planning tables missing.");
 console.info("PostgreSQL additive upgrade verified: original IDs/dates/comments preserved, migrations idempotent, planning tables created.");
}finally{await client.end();}
