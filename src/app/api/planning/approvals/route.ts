import {NextResponse} from "next/server";
import {z} from "zod";
import {context} from "@/modules/auth/session";
import {getDb} from "@/db";
import {createPlanningApprovals} from "@/modules/planning/approvals";
import {sameOrigin,respondError} from "@/modules/shared/http";
const uuid=z.uuid();
const actions=z.discriminatedUnion("action",[
 z.object({action:z.literal("submitChange"),projectId:uuid,data:z.unknown()}).strict(),
 z.object({action:z.literal("reviewChange"),projectId:uuid,changeId:uuid,data:z.unknown()}).strict(),
 z.object({action:z.literal("requestBaseline"),projectId:uuid,baselineId:uuid}).strict(),
 z.object({action:z.literal("reviewBaseline"),projectId:uuid,reviewId:uuid,data:z.unknown()}).strict(),
]);
export async function GET(request:Request){
 try{
  const {actor}=await context();
  const projectId=uuid.parse(new URL(request.url).searchParams.get("projectId"));
  return NextResponse.json(await createPlanningApprovals(await getDb(),actor).snapshot(projectId));
 }catch(e){return respondError(e);}
}
export async function POST(request:Request){
 try{
  sameOrigin(request);
  if(Number(request.headers.get("content-length")||0)>200000)return NextResponse.json({error:"Request is too large."},{status:413});
  const {actor}=await context(),v=actions.parse(await request.json());
  const api=createPlanningApprovals(await getDb(),actor);
  switch(v.action){
   case "submitChange":return NextResponse.json(await api.submitChange(v.projectId,v.data));
   case "reviewChange":return NextResponse.json(await api.reviewChange(v.projectId,v.changeId,v.data));
   case "requestBaseline":return NextResponse.json(await api.requestBaseline(v.projectId,v.baselineId));
   case "reviewBaseline":return NextResponse.json(await api.reviewBaseline(v.projectId,v.reviewId,v.data));
  }
 }catch(e){return respondError(e);}
}
