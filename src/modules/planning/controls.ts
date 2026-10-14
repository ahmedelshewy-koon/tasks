import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "../../db/schema";
import type { Database } from "../../db";
import type { Actor } from "../shared/types";
import { AppError, requireAccess } from "../shared/types";

const uuid=z.uuid();
const date=z.iso.date();
const input=z.object({
  activityId:uuid,percentComplete:z.number().int().min(0).max(100),
  actualStart:date.nullable(),actualFinish:date.nullable(),
  remainingDays:z.number().int().min(0).max(36500),
  note:z.string().max(2000).default(""),
}).strict().superRefine((v,ctx)=>{
  if(v.actualFinish&&!v.actualStart)ctx.addIssue({code:"custom",message:"Finish requires actual start.",path:["actualFinish"]});
  if(v.actualFinish&&v.percentComplete!==100)ctx.addIssue({code:"custom",message:"Finish requires 100% progress.",path:["percentComplete"]});
  if(v.actualStart&&v.actualFinish&&v.actualFinish<v.actualStart)ctx.addIssue({code:"custom",message:"Finish precedes start.",path:["actualFinish"]});
});

export function createPlanningControls(db:Database,actor:Actor){
  async function access(tx:Database,projectId:string,write=false){
    const [p]=await tx.select().from(s.projects).where(and(eq(s.projects.id,projectId),isNull(s.projects.deletedAt)));
    if(!p)throw new AppError(404,"Project not found.");
    const [m]=await tx.select().from(s.members).where(and(eq(s.members.projectId,projectId),eq(s.members.userId,actor.userId)));
    const role=actor.isAdmin?"admin":p.ownerId===actor.userId?"owner":m?.role??null;
    requireAccess(write?["admin","owner","project_manager"].includes(role??""):role!==null);
    if(write&&p.archivedAt)throw new AppError(409,"Archived projects are read-only.");
    return p;
  }
  const locked=<T>(projectId:string,fn:(tx:Database)=>Promise<T>)=>db.transaction(async tx=>{
    await tx.execute(sql`select id from projects where id=${projectId} for update`);
    await access(tx as Database,projectId,true);
    return fn(tx as Database);
  });
  return {
    async snapshot(projectId:string){
      await access(db,projectId);
      const [baselines,progress]=await Promise.all([
        db.select().from(s.planningBaselines).where(eq(s.planningBaselines.projectId,projectId)),
        db.select().from(s.planningProgress).where(eq(s.planningProgress.projectId,projectId)),
      ]);
      return {baselines,progress};
    },
    async captureBaseline(projectId:string,label:unknown){
      const valid=z.string().trim().min(1).max(100).parse(label);
      return locked(projectId,async tx=>{
        const [wbs,activities,relationships,calendars,exceptions]=await Promise.all([
          tx.select().from(s.planningWbs).where(eq(s.planningWbs.projectId,projectId)),
          tx.select().from(s.planningActivities).where(eq(s.planningActivities.projectId,projectId)),
          tx.select().from(s.planningRelationships).where(eq(s.planningRelationships.projectId,projectId)),
          tx.select().from(s.planningCalendars).where(eq(s.planningCalendars.projectId,projectId)),
          tx.select({id:s.planningCalendarExceptions.id,calendarId:s.planningCalendarExceptions.calendarId,day:s.planningCalendarExceptions.day,isWorking:s.planningCalendarExceptions.isWorking,note:s.planningCalendarExceptions.note})
            .from(s.planningCalendarExceptions).innerJoin(s.planningCalendars,eq(s.planningCalendarExceptions.calendarId,s.planningCalendars.id))
            .where(eq(s.planningCalendars.projectId,projectId)),
        ]);
        if(!activities.length)throw new AppError(409,"Create schedule activities before capturing a baseline.");
        const snapshot={schemaVersion:1,wbs,activities,relationships,calendars,exceptions};
        const [row]=await tx.insert(s.planningBaselines).values({projectId,label:valid,snapshot,createdBy:actor.userId}).returning();
        await tx.insert(s.activity).values({projectId,userId:actor.userId,action:"planning_baseline_captured",after:{id:row.id,label:valid,activityCount:activities.length}});
        return row;
      });
    },
    async updateProgress(projectId:string,payload:unknown){
      const v=input.parse(payload);
      return locked(projectId,async tx=>{
        const [activity]=await tx.select().from(s.planningActivities).where(and(eq(s.planningActivities.id,v.activityId),eq(s.planningActivities.projectId,projectId)));
        if(!activity)throw new AppError(404,"Activity not found in this project.");
        const [before]=await tx.select().from(s.planningProgress).where(eq(s.planningProgress.activityId,v.activityId));
        const value={...v,projectId,updatedBy:actor.userId,updatedAt:new Date()};
        const [row]=await tx.insert(s.planningProgress).values(value).onConflictDoUpdate({
          target:s.planningProgress.activityId,set:value
        }).returning();
        await tx.insert(s.activity).values({projectId,userId:actor.userId,action:"planning_progress_updated",before:before??null,after:row});
        return row;
      });
    },
  };
}
