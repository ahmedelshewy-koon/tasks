import { NextResponse } from "next/server";
import { z } from "zod";
import { context } from "@/modules/auth/session";
import { getDb } from "@/db";
import { createPlanningService } from "@/modules/planning/service";
import { sameOrigin, respondError } from "@/modules/shared/http";

const uuid = z.uuid();

export async function GET(request:Request) {
  try {
    const {actor}=await context();
    const projectId=uuid.parse(new URL(request.url).searchParams.get("projectId"));
    return NextResponse.json(await createPlanningService(await getDb(),actor).snapshot(projectId));
  } catch(error) { return respondError(error); }
}
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get("content-length") || 0)>200000)
      return NextResponse.json({error:"Request is too large."},{status:413});
    const {actor}=await context();
    const body=z.object({
      action:z.enum(["saveWbs","saveCalendar","saveException","saveActivity"]),
      projectId:uuid,calendarId:uuid.optional(),data:z.unknown(),
    }).strict().parse(await request.json());
    const service=createPlanningService(await getDb(),actor);
    switch(body.action) {
      case "saveWbs": return NextResponse.json(await service.saveWbs(body.projectId,body.data));
      case "saveCalendar": return NextResponse.json(await service.saveCalendar(body.projectId,body.data));
      case "saveActivity": return NextResponse.json(await service.saveActivity(body.projectId,body.data));
      case "saveException":
        return NextResponse.json(await service.saveException(body.projectId,uuid.parse(body.calendarId),body.data));
    }
  } catch(error) { return respondError(error); }
}
