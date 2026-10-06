import { reminderKind } from "@/modules/work/reminders";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { respondError } from "@/modules/shared/http";
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (
    !expected ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const now = new Date();
    const rows = await db
      .select({ task: s.tasks, assignee: s.assignees })
      .from(s.tasks)
      .innerJoin(s.assignees, eq(s.tasks.id, s.assignees.taskId))
      .leftJoin(s.projects, eq(s.tasks.projectId, s.projects.id))
      .where(
        and(
          isNull(s.tasks.deletedAt),
          isNull(s.tasks.archivedAt),
          isNull(s.projects.deletedAt),
          isNull(s.projects.archivedAt),
          ne(s.tasks.status, "done"),
        ),
      );
    let checked = 0;
    for (const { task, assignee } of rows) {
      const kind = reminderKind(task, now);
      if (!kind) continue;
      await db
        .insert(s.notifications)
        .values({
          userId: assignee.userId,
          taskId: task.id,
          kind,
          message: task.title,
          dedupeKey: `${assignee.userId}:${task.id}:${kind}:${task.dueDate}`,
        })
        .onConflictDoNothing();
      checked++;
    }
    return NextResponse.json({ checked });
  } catch (error) {
    return respondError(error);
  }
}
