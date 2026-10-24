import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import * as s from "../../db/schema";
import { AppError } from "../shared/types";
import { hrAdapter, isDevelopment } from "../hr/adapter";
import { subordinateUserIds } from "../hr/hierarchy";
import { openSession, sealSession } from "./crypto";
import { createService } from "../work/service";
const COOKIE = "task_session";
const secret = () => process.env.SESSION_SECRET || "";
// Without "remember", the cookie ends with the browser session.
export async function signIn(token: string, remember = true) {
  await hrAdapter().authenticate(token);
  const value = await sealSession(
    { token, mode: isDevelopment() ? "development" : "hr" },
    secret(),
  );
  if (value.length > 3900)
    throw new AppError(400, "HR token exceeds the supported session size.");
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: 8 * 60 * 60 } : {}),
  });
}
export async function signOut() {
  (await cookies()).delete(COOKIE);
}
export async function context() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) throw new AppError(401, "Please sign in.");
  let session;
  try {
    session = await openSession(value, secret());
  } catch {
    throw new AppError(401, "Please sign in again.");
  }
  if (session.mode !== (isDevelopment() ? "development" : "hr"))
    throw new AppError(401, "Please sign in again.");
  const hr = hrAdapter();
  const me = await hr.authenticate(session.token);
  const [directory, reports, db] = await Promise.all([
    hr.employees(session.token),
    hr.directReports(session.token, me.employeeId),
    getDb(),
  ]);
  if (!directory.some((e) => e.userId === me.userId)) directory.push(me);
  for (const report of reports) {
    if (!directory.some((e) => e.employeeId === report.employeeId))
      directory.push(report);
  }
  await db
    .insert(s.users)
    .values({ id: me.userId, employeeId: me.employeeId })
    .onConflictDoUpdate({
      target: s.users.id,
      set: { employeeId: me.employeeId },
    });
  const bootstrap = isDevelopment()
    ? ["local-admin"]
    : (process.env.TASK_BOOTSTRAP_ADMINS || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  if (
    bootstrap.includes(me.userId) ||
    (!isDevelopment() &&
      process.env.TASK_BOOTSTRAP_HR_ADMIN === "true" &&
      me.isHrAdmin)
  )
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(742001)`);
      const existing = await tx.select().from(s.admins);
      if (!existing.length)
        await tx
          .insert(s.admins)
          .values({ userId: me.userId })
          .onConflictDoNothing();
    });
  const grants = await db
    .select()
    .from(s.admins)
    .where(eq(s.admins.userId, me.userId));
  const actor = {
    userId: me.userId,
    employeeId: me.employeeId,
    isAdmin: grants.length > 0,
    directReportIds: reports.map((e) => e.userId),
    subordinateIds: subordinateUserIds(me, directory),
  };
  return {
    me,
    actor,
    service: createService(db, actor, directory),
    development: isDevelopment(),
  };
}
