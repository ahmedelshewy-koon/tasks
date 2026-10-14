import {NextResponse} from "next/server";
import {z} from "zod";
import {context} from "@/modules/auth/session";
import {getDb} from "@/db";
import {createEnterprisePlanning} from "@/modules/planning/enterprise";
import {sameOrigin,respondError} from "@/modules/shared/http";
const uuid=z.uuid();
export async function GET(request:Request){
 try{const {actor}=await context(),projectId=uuid.parse(new URL(request.url).searchParams.get("projectId"));
  return NextResponse.json(await createEnterprisePlanning(await getDb(),actor).snapshot(projectId));
 }catch(e){return respondError(e);}
}
export async function POST(request:Request){
 try{
  sameOrigin(request);
  if(Number(request.headers.get("content-length")||0)>200000)return NextResponse.json({error:"Request is too large."},{status:413});
  const body=z.object({projectId:uuid,action:z.enum(["saveResource","saveAssignment","saveCost","saveRisk"]),data:z.unknown()}).parse(await request.json());
  const {actor,directory}=await context(),svc=createEnterprisePlanning(await getDb(),actor,directory);
  switch(body.action){
   case "saveResource":return NextResponse.json(await svc.saveResource(body.projectId,body.data));
   case "saveAssignment":return NextResponse.json(await svc.saveAssignment(body.projectId,body.data));
   case "saveCost":return NextResponse.json(await svc.saveCost(body.projectId,body.data));
   case "saveRisk":return NextResponse.json(await svc.saveRisk(body.projectId,body.data));
  }
 }catch(e){return respondError(e);}
}
