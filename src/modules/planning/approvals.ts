import {and,eq,isNull,sql} from "drizzle-orm";
import {z} from "zod";
import * as s from "../../db/schema";
import type {Database} from "../../db";
import type {Actor} from "../shared/types";
import {AppError,requireAccess} from "../shared/types";

const uuid=z.uuid();
const submit=z.object({
  kind:z.enum(["scope","schedule","budget","resource"]),
  title:z.string().trim().min(3).max(150),
  description:z.string().trim().min(10).max(4000),
  impactDays:z.number().int().min(-36500).max(36500).default(0),
  impactMinor:z.number().int().min(-2147483647).max(2147483647).default(0),
  currency:z.string().regex(/^[A-Z]{3}$/).default("SAR"),
}).strict();
const decision=z.object({
  status:z.enum(["approved","rejected"]),
  note:z.string().trim().max(2000).default(""),
}).strict().superRefine((v,ctx)=>{
  if(v.status==="rejected"&&v.note.length<3)ctx.addIssue({code:"custom",path:["note"],message:"A rejection requires a reason."});
});

export function createPlanningApprovals(db:Database,actor:Actor){
 async function access(tx:Database,projectId:string,write=false){
  const [project]=await tx.select().from(s.projects).where(and(eq(s.projects.id,projectId),isNull(s.projects.deletedAt)));
  if(!project)throw new AppError(404,"Project not found.");
  const [member]=await tx.select().from(s.members).where(and(eq(s.members.projectId,projectId),eq(s.members.userId,actor.userId)));
  const role=actor.isAdmin?"admin":project.ownerId===actor.userId?"owner":member?.role??null;
  requireAccess(["admin","owner","project_manager"].includes(role??""),"Planning approvals are for project managers and owners.");
  if(write&&project.archivedAt)throw new AppError(409,"Archived projects are read-only.");
  return {canReview:actor.isAdmin||project.ownerId===actor.userId};
 }
 const transaction=<T>(projectId:string,fn:(tx:Database,reviewer:boolean)=>Promise<T>)=>db.transaction(async (inner)=>{
  const tx=inner as Database;
  await tx.execute(sql`select id from projects where id=${projectId} for update`);
  const accessInfo=await access(tx,projectId,true);
  return fn(tx,accessInfo.canReview);
 });
 async function log(tx:Database,projectId:string,action:string,before:unknown,after:unknown){
  await tx.insert(s.activity).values({projectId,userId:actor.userId,action,before,after});
 }
 return {
  async snapshot(projectId:string){
    const {canReview}=await access(db,projectId);
    const [changes,baselines]=await Promise.all([
      db.select().from(s.planningChangeRequests).where(eq(s.planningChangeRequests.projectId,projectId)),
      db.select().from(s.planningBaselineReviews).where(eq(s.planningBaselineReviews.projectId,projectId)),
    ]);
    return {changes,baselines,canReview,currentUserId:actor.userId};
  },
  async submitChange(projectId:string,data:unknown){
    const input=submit.parse(data);
    return transaction(projectId,async tx=>{
      const [row]=await tx.insert(s.planningChangeRequests).values({...input,projectId,requestedBy:actor.userId}).returning();
      await log(tx,projectId,"planning_change_requested",null,{id:row.id,title:row.title,kind:row.kind});
      return row;
    });
  },
  async reviewChange(projectId:string,changeId:string,payload:unknown){
    const input=decision.parse(payload);
    return transaction(projectId,async (tx,canReview)=>{
      requireAccess(canReview,"Only project owner or administrator can review changes.");
      const [before]=await tx.select().from(s.planningChangeRequests).where(and(eq(s.planningChangeRequests.id,changeId),eq(s.planningChangeRequests.projectId,projectId)));
      if(!before)throw new AppError(404,"Change request not found.");
      if(before.status!=="pending")throw new AppError(409,"This request already has a final decision.");
      if(before.requestedBy===actor.userId)throw new AppError(403,"A requester cannot approve or reject their own request.");
      const [row]=await tx.update(s.planningChangeRequests).set({status:input.status,decisionNote:input.note,reviewedBy:actor.userId,reviewedAt:new Date()}).where(eq(s.planningChangeRequests.id,changeId)).returning();
      await log(tx,projectId,"planning_change_reviewed",{id:before.id,status:before.status},{id:row.id,status:row.status,note:row.decisionNote});
      return row;
    });
  },
  async requestBaseline(projectId:string,baselineId:string){
    return transaction(projectId,async tx=>{
      const [baseline]=await tx.select().from(s.planningBaselines).where(and(eq(s.planningBaselines.id,baselineId),eq(s.planningBaselines.projectId,projectId)));
      if(!baseline)throw new AppError(404,"Baseline not found in this project.");
      const [existing]=await tx.select().from(s.planningBaselineReviews).where(eq(s.planningBaselineReviews.baselineId,baselineId));
      if(existing)throw new AppError(409,"This baseline already has an approval request.");
      const [row]=await tx.insert(s.planningBaselineReviews).values({projectId,baselineId,requestedBy:actor.userId}).returning();
      await log(tx,projectId,"planning_baseline_review_requested",null,{baselineId,id:row.id});
      return row;
    });
  },
  async reviewBaseline(projectId:string,reviewId:string,payload:unknown){
    const input=decision.parse(payload);
    return transaction(projectId,async (tx,canReview)=>{
      requireAccess(canReview,"Only project owner or administrator can review baselines.");
      const [before]=await tx.select().from(s.planningBaselineReviews).where(and(eq(s.planningBaselineReviews.id,reviewId),eq(s.planningBaselineReviews.projectId,projectId)));
      if(!before)throw new AppError(404,"Baseline approval not found.");
      if(before.status!=="pending")throw new AppError(409,"This baseline already has a final review.");
      const [baseline]=await tx.select().from(s.planningBaselines).where(and(eq(s.planningBaselines.id,before.baselineId),eq(s.planningBaselines.projectId,projectId)));
      if(!baseline)throw new AppError(409,"Baseline no longer exists.");
      if(before.requestedBy===actor.userId||baseline.createdBy===actor.userId)
        throw new AppError(403,"Baseline approval requires a different person from the requester and author.");
      const [row]=await tx.update(s.planningBaselineReviews).set({status:input.status,decisionNote:input.note,reviewedBy:actor.userId,reviewedAt:new Date()}).where(eq(s.planningBaselineReviews.id,reviewId)).returning();
      await log(tx,projectId,"planning_baseline_reviewed",{id:before.id,status:before.status},{id:row.id,status:row.status,note:row.decisionNote});
      return row;
    });
  },
 };
}
