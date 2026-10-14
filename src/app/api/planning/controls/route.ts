import { NextResponse } from "next/server";
import { z } from "zod";
import { context } from "@/modules/auth/session";
import { getDb } from "@/db";
import { createPlanningControls } from "@/modules/planning/controls";
import { sameOrigin, respondError } from "@/modules/shared/http";
const uuid=z.uuid();
export async function GET(request:Request){
  try{
    const {actor}=await context();
    const id=uuid.parse(new URL(request.url).searchParams.get("projectId"));
    return NextResponse.json(await createPlanningControls(await getDb(),actor).snapshot(id));
  }catch(error){return respondError(error);}
}
export async function POST(request:Request){
  try{
    sameOrigin(request);
    if(Number(request.headers.get("content-length")||0)>200000)return NextResponse.json({error:"Request is too large."},{status:413});
    const {actor}=await context();
    const body=z.discriminatedUnion("action",[
      z.object({action:z.literal("captureBaseline"),projectId:uuid,label:z.string()}),
      z.object({action:z.literal("updateProgress"),projectId:uuid,data:z.unknown()}),
    ]).parse(await request.json());
    const service=createPlanningControls(await getDb(),actor);
    if(body.action==="captureBaseline")return NextResponse.json(await service.captureBaseline(body.projectId,body.label));
    return NextResponse.json(await service.updateProgress(body.projectId,body.data));
  }catch(error){return respondError(error);}
}
