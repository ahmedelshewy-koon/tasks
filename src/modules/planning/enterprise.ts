import {and,eq,isNull,sql} from "drizzle-orm";
import {z} from "zod";
import * as s from "../../db/schema";
import type {Database} from "../../db";
import type {Actor} from "../shared/types";
import {AppError,requireAccess} from "../shared/types";

const id=z.uuid(),title=z.string().trim().min(1).max(150);
const nonneg=z.number().int().min(0).max(2147483647);
const currency=z.string().regex(/^[A-Z]{3}$/);
const resourceInput=z.object({
 id:id.optional(),name:title,kind:z.enum(["labor","equipment","material"]),
 hrUserId:z.string().trim().min(1).max(100).nullable().default(null),
 capacityHoursWeek:z.number().int().min(0).max(168).default(40),
 rateMinor:nonneg.default(0),currency:currency.default("SAR"),
}).strict();
const assignInput=z.object({
 id:id.optional(),activityId:id,resourceId:id,
 plannedHours:z.number().int().min(0).max(1000000),allocationPercent:z.number().int().min(0).max(200),
}).strict();
const costInput=z.object({
 id:id.optional(),activityId:id.nullable().default(null),name:title,currency,
 budgetMinor:nonneg,actualMinor:nonneg,
}).strict();
const riskInput=z.object({
 id:id.optional(),title,probability:z.number().int().min(1).max(5),
 impact:z.number().int().min(1).max(5),
 status:z.enum(["open","mitigating","closed"]).default("open"),
 response:z.string().max(2000).default(""),
}).strict();
export function createEnterprisePlanning(db:Database,actor:Actor){
 async function access(tx:Database,projectId:string,write=false){
  const [p]=await tx.select().from(s.projects).where(and(eq(s.projects.id,projectId),isNull(s.projects.deletedAt)));
  if(!p)throw new AppError(404,"Project not found.");
  const [m]=await tx.select().from(s.members).where(and(eq(s.members.projectId,projectId),eq(s.members.userId,actor.userId)));
  const role=actor.isAdmin?"admin":p.ownerId===actor.userId?"owner":m?.role??null;
  requireAccess(write?["admin","owner","project_manager"].includes(role??""):role!==null);
  if(write&&p.archivedAt)throw new AppError(409,"Archived project is read-only.");
  return p;
 }
 const locked=<T>(projectId:string,fn:(tx:Database)=>Promise<T>)=>db.transaction(async tx=>{
  await tx.execute(sql`select id from projects where id=${projectId} for update`);
  await access(tx as Database,projectId,true);
  return fn(tx as Database);
 });
 async function ensureActivity(tx:Database,projectId:string,activityId:string){
  const [row]=await tx.select({id:s.planningActivities.id}).from(s.planningActivities).where(and(eq(s.planningActivities.projectId,projectId),eq(s.planningActivities.id,activityId)));
  if(!row)throw new AppError(400,"Activity must belong to this project.");
 }
 async function record(tx:Database,projectId:string,action:string,before:unknown,after:unknown){
  await tx.insert(s.activity).values({projectId,userId:actor.userId,action,before,after});
 }
 return {
  async snapshot(projectId:string){
   const project=await access(db,projectId);
   const [member]=await db.select().from(s.members).where(and(eq(s.members.projectId,projectId),eq(s.members.userId,actor.userId)));
   const financeAllowed=actor.isAdmin||project.ownerId===actor.userId||member?.role==="project_manager";
   const [resources,assignments,costs,risks,progress,baselines,activities]=await Promise.all([
    db.select().from(s.planningResources).where(eq(s.planningResources.projectId,projectId)),
    db.select().from(s.planningResourceAssignments).where(eq(s.planningResourceAssignments.projectId,projectId)),
    db.select().from(s.planningCostItems).where(eq(s.planningCostItems.projectId,projectId)),
    db.select().from(s.planningRisks).where(eq(s.planningRisks.projectId,projectId)),
    db.select().from(s.planningProgress).where(eq(s.planningProgress.projectId,projectId)),
    db.select().from(s.planningBaselines).where(eq(s.planningBaselines.projectId,projectId)),
    db.select().from(s.planningActivities).where(eq(s.planningActivities.projectId,projectId)),
   ]);
   return {resources:financeAllowed?resources:resources.map(r=>({...r,rateMinor:0})),assignments,costs:financeAllowed?costs:[],risks,progress,baselines,activities,financeAllowed};
  },
  async saveResource(projectId:string,payload:unknown){
   const v=resourceInput.parse(payload);
   return locked(projectId,async tx=>{
    const [before]=v.id?await tx.select().from(s.planningResources).where(and(eq(s.planningResources.projectId,projectId),eq(s.planningResources.id,v.id))):[];
    if(v.id&&!before)throw new AppError(404,"Resource not found.");
    const [row]=before?await tx.update(s.planningResources).set(v).where(eq(s.planningResources.id,before.id)).returning():
      await tx.insert(s.planningResources).values({...v,projectId}).returning();
    await record(tx,projectId,"planning_resource_saved",before??null,row);return row;
   });
  },
  async saveAssignment(projectId:string,payload:unknown){
   const v=assignInput.parse(payload);
   return locked(projectId,async tx=>{
    await ensureActivity(tx,projectId,v.activityId);
    const [resource]=await tx.select({id:s.planningResources.id}).from(s.planningResources).where(and(eq(s.planningResources.id,v.resourceId),eq(s.planningResources.projectId,projectId)));
    if(!resource)throw new AppError(400,"Resource must belong to this project.");
    const [before]=v.id?await tx.select().from(s.planningResourceAssignments).where(and(eq(s.planningResourceAssignments.projectId,projectId),eq(s.planningResourceAssignments.id,v.id))):[];
    if(v.id&&!before)throw new AppError(404,"Assignment not found.");
    const [row]=before?await tx.update(s.planningResourceAssignments).set(v).where(eq(s.planningResourceAssignments.id,before.id)).returning():
      await tx.insert(s.planningResourceAssignments).values({...v,projectId}).returning();
    await record(tx,projectId,"planning_assignment_saved",before??null,row);return row;
   });
  },
  async saveCost(projectId:string,payload:unknown){
   const v=costInput.parse(payload);
   return locked(projectId,async tx=>{
    if(v.activityId)await ensureActivity(tx,projectId,v.activityId);
    const [before]=v.id?await tx.select().from(s.planningCostItems).where(and(eq(s.planningCostItems.projectId,projectId),eq(s.planningCostItems.id,v.id))):[];
    if(v.id&&!before)throw new AppError(404,"Cost item not found.");
    const [row]=before?await tx.update(s.planningCostItems).set(v).where(eq(s.planningCostItems.id,before.id)).returning():
      await tx.insert(s.planningCostItems).values({...v,projectId}).returning();
    await record(tx,projectId,"planning_cost_saved",before??null,row);return row;
   });
  },
  async saveRisk(projectId:string,payload:unknown){
   const v=riskInput.parse(payload);
   return locked(projectId,async tx=>{
    const [before]=v.id?await tx.select().from(s.planningRisks).where(and(eq(s.planningRisks.projectId,projectId),eq(s.planningRisks.id,v.id))):[];
    if(v.id&&!before)throw new AppError(404,"Risk not found.");
    const [row]=before?await tx.update(s.planningRisks).set(v).where(eq(s.planningRisks.id,before.id)).returning():
      await tx.insert(s.planningRisks).values({...v,projectId}).returning();
    await record(tx,projectId,"planning_risk_saved",before??null,row);return row;
   });
  },
 };
}
