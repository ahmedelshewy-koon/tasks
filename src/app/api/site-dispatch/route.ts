import {NextResponse} from "next/server";
import {z} from "zod";
import {context} from "@/modules/auth/session";
import {getDb} from "@/db";
import {listSiteWorkers} from "@/modules/site/availability";
import {respondError} from "@/modules/shared/http";
export async function GET(request:Request){
 try{
  const projectId=z.uuid().parse(new URL(request.url).searchParams.get("projectId"));
  const {actor,directory}=await context();
  return NextResponse.json({workers:await listSiteWorkers(await getDb(),actor,directory,projectId)});
 }catch(e){return respondError(e);}
}
