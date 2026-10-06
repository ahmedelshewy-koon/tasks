import { NextResponse } from "next/server";
import { z } from "zod";
import { context } from "@/modules/auth/session";
import { respondError, sameOrigin } from "@/modules/shared/http";
const id = z.uuid();
export async function GET(request: Request) {
  try {
    const ctx = await context();
    const query = new URL(request.url).searchParams;
    if (query.has("report"))
      return NextResponse.json(await ctx.service.report());
    if (query.has("task"))
      return NextResponse.json(
        await ctx.service.taskDetail(id.parse(query.get("task"))),
      );
    if (query.has("activity"))
      return NextResponse.json(
        await ctx.service.projectActivity(
          id.parse(query.get("activity")),
          query.get("before")
            ? z.iso.datetime().parse(query.get("before"))
            : undefined,
        ),
      );
    if (query.has("archiveLog"))
      return NextResponse.json(await ctx.service.archiveLog());
    if (query.has("admins"))
      return NextResponse.json(await ctx.service.listAdmins());
    await ctx.service.reconcileDue();
    return NextResponse.json({
      ...(await ctx.service.snapshot()),
      me: ctx.me,
      development: ctx.development,
      hrConfigured: !!process.env.HR_API_URL,
    });
  } catch (error) {
    return respondError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 200000)
      return NextResponse.json(
        { error: "Request is too large." },
        { status: 413 },
      );
    const { service } = await context();
    const body = z
      .object({
        action: z.string(),
        id: z.string().optional(),
        data: z.unknown().optional(),
      })
      .parse(await request.json());
    let result;
    switch (body.action) {
      case "setDependency":
        result = await service.setDependency(id.parse(body.id), body.data);
        break;
      case "saveMilestone":
        result = await service.saveMilestone(id.parse(body.id), body.data);
        break;
      case "linkMilestone":
        result = await service.linkMilestone(id.parse(body.id), body.data);
        break;
      case "changeChecklist":
        result = await service.changeChecklist(id.parse(body.id), body.data);
        break;
      case "changeReminder":
        result = await service.changeReminder(id.parse(body.id), body.data);
        break;
      case "createProject":
        result = await service.createProject(body.data);
        break;
      case "updateProject":
        result = await service.updateProject(id.parse(body.id), body.data);
        break;
      case "setHealth":
        result = await service.setHealth(id.parse(body.id), body.data);
        break;
      case "archiveProject":
        result = await service.archiveProject(id.parse(body.id));
        break;
      case "restoreProject":
        result = await service.restoreProject(id.parse(body.id));
        break;
      case "purgeProject":
        result = await service.purgeProject(id.parse(body.id));
        break;
      case "archiveTask":
        result = await service.archiveTask(id.parse(body.id));
        break;
      case "restoreTask":
        result = await service.restoreTask(id.parse(body.id));
        break;
      case "purgeTask":
        result = await service.purgeTask(id.parse(body.id));
        break;
      case "saveField":
        result = await service.saveField(id.parse(body.id), body.data);
        break;
      case "removeField":
        result = await service.removeField(id.parse(body.id), body.data);
        break;
      case "setFieldValue":
        result = await service.setFieldValue(id.parse(body.id), body.data);
        break;
      case "setTaskTags":
        result = await service.setTaskTags(id.parse(body.id), body.data);
        break;
      case "saveView":
        result = await service.saveView(body.data);
        break;
      case "removeView":
        result = await service.removeView(id.parse(body.id));
        break;
      case "saveTemplate":
        result = await service.saveTemplate(body.data);
        break;
      case "updateTemplate":
        result = await service.updateTemplate(id.parse(body.id), body.data);
        break;
      case "deleteTemplate":
        result = await service.deleteTemplate(id.parse(body.id));
        break;
      case "addSection":
        result = await service.addSection(
          id.parse(body.id),
          z.object({ name: z.string() }).parse(body.data).name,
        );
        break;
      case "createTask":
        result = await service.createTask(body.data);
        break;
      case "updateTask":
        result = await service.updateTask(id.parse(body.id), body.data);
        break;
      case "completePart": {
        const d = z
          .object({ userId: z.string(), completed: z.boolean() })
          .parse(body.data);
        result = await service.completePart(
          id.parse(body.id),
          d.userId,
          d.completed,
        );
        break;
      }
      case "addComment":
        result = await service.addComment(
          id.parse(body.id),
          z.object({ body: z.string() }).parse(body.data).body,
        );
        break;
      case "markRead":
        result = await service.markRead(
          body.id ? id.parse(body.id) : undefined,
        );
        break;
      case "deleteAttachment":
        result = await service.deleteAttachment(id.parse(body.id));
        break;
      case "setAdmin": {
        const d = z
          .object({ userId: z.string(), enabled: z.boolean() })
          .parse(body.data);
        result = await service.setAdmin(d.userId, d.enabled);
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return respondError(error);
  }
}
