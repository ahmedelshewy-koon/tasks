import {and,eq,inArray,isNull} from "drizzle-orm";
import type {Database} from "../../db";
import * as s from "../../db/schema";
import type {Actor,Employee} from "../shared/types";
import {requireAccess,AppError} from "../shared/types";
import {canAssignTo,canManageProject} from "../tasks/policy";

export type SiteWorker={
 userId:string;name:string;jobTitle:string;department:string;
 busy:boolean;activeJobs:number;queuedJobs:number;
 expectedAvailableAt:string|null;etaUnknown:boolean;overdue:boolean;
 currentJobs:{taskId:string|null;title:string;expectedEndAt:string|null}[];
};
/** Availability uses ALL active assignments for eligible workers, even outside selected project.
 * Cross-project task titles and IDs are hidden to avoid disclosing unrelated work.
 * An overdue job remains BUSY until completion; ETA is an estimate, not automatic release.
 */
export async function listSiteWorkers(db:Database,actor:Actor,directory:Employee[],projectId:string,now=new Date()):Promise<SiteWorker[]>{
 const [project]=await db.select().from(s.projects)
   .where(and(eq(s.projects.id,projectId),isNull(s.projects.deletedAt)));
 if(!project)throw new AppError(404,"Project not found.");
 const membership=await db.select().from(s.members).where(eq(s.members.projectId,projectId));
 const accessible={ownerId:project.ownerId,memberIds:membership.map(m=>m.userId),
   roles:Object.fromEntries(membership.map(m=>[m.userId,m.role]))};
 requireAccess(canManageProject(actor,accessible),"Only project managers can view site dispatch.");
 if(project.archivedAt)throw new AppError(409,"Archived project cannot dispatch workers.");
 const eligible=directory.filter(p=>canAssignTo(actor,p.userId,accessible));
 if(!eligible.length)return [];
 const ids=eligible.map(p=>p.userId);
 const rows=await db.select({
   userId:s.assignees.userId,completed:s.assignees.completed,
   taskId:s.tasks.id,projectId:s.tasks.projectId,title:s.tasks.title,
   status:s.tasks.status,expectedEnd:s.tasks.siteExpectedEndAt,
 }).from(s.assignees).innerJoin(s.tasks,eq(s.assignees.taskId,s.tasks.id))
   .where(and(inArray(s.assignees.userId,ids),eq(s.assignees.completed,false),
     isNull(s.tasks.archivedAt),isNull(s.tasks.deletedAt),
     inArray(s.tasks.status,["in_progress","todo"])));
 return eligible.map(person=>{
   const assigned=rows.filter(r=>r.userId===person.userId);
   const active=assigned.filter(r=>r.status==="in_progress");
   const etaUnknown=active.some(r=>!r.expectedEnd);
   const end=!etaUnknown&&active.length
     ?new Date(Math.max(...active.map(r=>r.expectedEnd!.getTime()))).toISOString():null;
   return {
     userId:person.userId,name:person.name,jobTitle:person.jobTitle||"Unspecified",department:person.department||"",
     busy:active.length>0,activeJobs:active.length,queuedJobs:assigned.filter(r=>r.status==="todo").length,
     expectedAvailableAt:end,etaUnknown,
     overdue:active.some(r=>!!r.expectedEnd&&r.expectedEnd.getTime()<now.getTime()),
     currentJobs:active.map(r=>({
       taskId:r.projectId===projectId?r.taskId:null,
       title:r.projectId===projectId?r.title:"Other assignment",
       expectedEndAt:r.expectedEnd?.toISOString()??null,
     })),
   };
 });
}
