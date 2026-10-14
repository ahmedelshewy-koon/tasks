import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../db";
import * as s from "../../db/schema";
import type { Actor } from "../shared/types";
import { AppError, requireAccess } from "../shared/types";
import { z } from "zod";
import { calculateCpm } from "../scheduling/cpm";

const id = z.uuid();
const code = z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const name = z.string().trim().min(1).max(150);
const day = z.iso.date();
const wbsInput = z.object({ id: id.optional(), parentId: id.nullable().default(null), code, name, position: z.number().int().min(0).max(100000).default(0) }).strict();
const calendarInput = z.object({
  id: id.optional(), name, timeZone: z.string().min(1).max(100).refine(v => {
    try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; }
  }, "Invalid IANA time zone."),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(a => new Set(a).size === a.length, "Duplicate weekday."),
  minutesPerDay: z.number().int().min(1).max(1440),
}).strict();
const exceptionInput = z.object({ day, isWorking: z.boolean(), note: z.string().max(500).default("") }).strict();
const activityInput = z.object({
  id: id.optional(), code, name, type: z.enum(["task","milestone"]).default("task"),
  wbsId: id.nullable().default(null), taskId: id.nullable().default(null),
  calendarId: id.nullable().default(null), durationDays: z.number().int().min(0).max(36500).default(1),
  plannedStart: day.nullable().default(null), plannedFinish: day.nullable().default(null),
  constraintType: z.enum(["snet"]).nullable().default(null), constraintDate: day.nullable().default(null),
}).strict().superRefine((v, ctx) => {
  if (v.type === "milestone" && v.durationDays !== 0) ctx.addIssue({ code:"custom", path:["durationDays"], message:"Milestone duration must be zero." });
  if (v.type === "task" && v.durationDays === 0) ctx.addIssue({ code:"custom", path:["durationDays"], message:"Task duration must be positive." });
  if (v.plannedStart && v.plannedFinish && v.plannedStart > v.plannedFinish) ctx.addIssue({ code:"custom", path:["plannedFinish"], message:"Finish cannot precede start." });
  if (!!v.constraintType !== !!v.constraintDate) ctx.addIssue({code:"custom",path:["constraintDate"],message:"Constraint date and type are required together."});
});

const relationshipInput = z.object({
  id: id.optional(),
  predecessorId: id,
  successorId: id,
  type: z.enum(["FS","SS","FF","SF"]),
  lagDays: z.number().int().min(-36500).max(36500).default(0),
}).strict();

export function createPlanningService(db: Database, actor: Actor) {
  async function access(database: Database, projectId: string, write = false) {
    const [project] = await database.select().from(s.projects).where(and(eq(s.projects.id, projectId), sql`${s.projects.deletedAt} is null`));
    if (!project) throw new AppError(404, "Project not found.");
    const [membership] = await database.select().from(s.members).where(and(eq(s.members.projectId, projectId), eq(s.members.userId, actor.userId)));
    const role = actor.isAdmin ? "admin" : project.ownerId === actor.userId ? "owner" : membership?.role ?? null;
    requireAccess(write ? ["admin","owner","project_manager"].includes(role ?? "") : role !== null);
    if (write && project.archivedAt) throw new AppError(409, "Archived projects are read-only.");
    return project;
  }
  async function log(tx: Database, projectId: string, action: string, before: unknown, after: unknown) {
    await tx.insert(s.activity).values({ projectId, userId: actor.userId, action, before, after });
  }
  async function locked<T>(projectId: string, fn: (tx: Database) => Promise<T>) {
    return db.transaction(async (tx) => {
      // Lock before reading permissions to serialize archive and scheduling writes.
      await tx.execute(sql`select id from projects where id = ${projectId} for update`);
      await access(tx as Database, projectId, true);
      return fn(tx as Database);
    });
  }
  async function sameProject(tx: Database, kind: "wbs" | "calendar", projectId: string, refId: string) {
    const [item] = kind === "wbs"
      ? await tx.select({ projectId:s.planningWbs.projectId }).from(s.planningWbs).where(eq(s.planningWbs.id,refId))
      : await tx.select({ projectId:s.planningCalendars.projectId }).from(s.planningCalendars).where(eq(s.planningCalendars.id,refId));
    if (!item || item.projectId !== projectId) throw new AppError(400, "Reference must belong to this project.");
  }
  return {
    async snapshot(projectId: string) {
      await access(db, projectId);
      const [wbs, calendars, exceptions, activities, relationships] = await Promise.all([
        db.select().from(s.planningWbs).where(eq(s.planningWbs.projectId, projectId)),
        db.select().from(s.planningCalendars).where(eq(s.planningCalendars.projectId, projectId)),
        db.select({ id:s.planningCalendarExceptions.id, calendarId:s.planningCalendarExceptions.calendarId, day:s.planningCalendarExceptions.day, isWorking:s.planningCalendarExceptions.isWorking, note:s.planningCalendarExceptions.note })
          .from(s.planningCalendarExceptions).innerJoin(s.planningCalendars, eq(s.planningCalendarExceptions.calendarId,s.planningCalendars.id))
          .where(eq(s.planningCalendars.projectId,projectId)),
        db.select().from(s.planningActivities).where(eq(s.planningActivities.projectId,projectId)),
        db.select().from(s.planningRelationships).where(eq(s.planningRelationships.projectId,projectId)),
      ]);
      return {wbs,calendars,exceptions,activities,relationships};
    },
    async saveWbs(projectId: string, payload: unknown) {
      const v = wbsInput.parse(payload);
      return locked(projectId, async tx => {
        const [existing] = v.id ? await tx.select().from(s.planningWbs).where(and(eq(s.planningWbs.id,v.id),eq(s.planningWbs.projectId,projectId))) : [];
        if (v.id && !existing) throw new AppError(404,"WBS node not found.");
        if (v.parentId) {
          await sameProject(tx,"wbs",projectId,v.parentId);
          if (v.parentId === v.id) throw new AppError(400,"Circular WBS.");
          const nodes=await tx.select().from(s.planningWbs).where(eq(s.planningWbs.projectId,projectId));
          let parent:string|null=v.parentId;
          const seen=new Set<string>();
          while(parent) {
            if(parent === v.id || seen.has(parent)) throw new AppError(400,"Circular WBS.");
            seen.add(parent);
            parent=nodes.find(n=>n.id===parent)?.parentId ?? null;
          }
        }
        const data={projectId,parentId:v.parentId,code:v.code,name:v.name,position:v.position};
        const [row]=existing
          ? await tx.update(s.planningWbs).set(data).where(eq(s.planningWbs.id,existing.id)).returning()
          : await tx.insert(s.planningWbs).values(data).returning();
        await log(tx,projectId,existing?"planning_wbs_updated":"planning_wbs_created",existing ?? null,row);
        return row;
      });
    },
    async saveCalendar(projectId:string,payload:unknown) {
      const v=calendarInput.parse(payload);
      return locked(projectId,async tx=>{
        const [existing]=v.id ? await tx.select().from(s.planningCalendars).where(and(eq(s.planningCalendars.id,v.id),eq(s.planningCalendars.projectId,projectId))) : [];
        if(v.id && !existing) throw new AppError(404,"Calendar not found.");
        const data={projectId,name:v.name,timeZone:v.timeZone,workingDays:v.workingDays,minutesPerDay:v.minutesPerDay};
        const [row]=existing
          ? await tx.update(s.planningCalendars).set(data).where(eq(s.planningCalendars.id,existing.id)).returning()
          : await tx.insert(s.planningCalendars).values(data).returning();
        await log(tx,projectId,existing?"planning_calendar_updated":"planning_calendar_created",existing??null,row);
        return row;
      });
    },
    async saveException(projectId:string,calendarId:string,payload:unknown) {
      const v=exceptionInput.parse(payload);
      return locked(projectId,async tx=>{
        await sameProject(tx,"calendar",projectId,calendarId);
        const [existing]=await tx.select().from(s.planningCalendarExceptions).where(and(eq(s.planningCalendarExceptions.calendarId,calendarId),eq(s.planningCalendarExceptions.day,v.day)));
        const [row]=existing
          ? await tx.update(s.planningCalendarExceptions).set({isWorking:v.isWorking,note:v.note}).where(eq(s.planningCalendarExceptions.id,existing.id)).returning()
          : await tx.insert(s.planningCalendarExceptions).values({calendarId,...v}).returning();
        await log(tx,projectId,"planning_calendar_exception_saved",existing??null,row);
        return row;
      });
    },
    async saveActivity(projectId:string,payload:unknown) {
      const v=activityInput.parse(payload);
      return locked(projectId,async tx=>{
        const [existing]=v.id ? await tx.select().from(s.planningActivities).where(and(eq(s.planningActivities.id,v.id),eq(s.planningActivities.projectId,projectId))) : [];
        if(v.id && !existing) throw new AppError(404,"Activity not found.");
        if(v.wbsId) await sameProject(tx,"wbs",projectId,v.wbsId);
        if(v.calendarId) await sameProject(tx,"calendar",projectId,v.calendarId);
        if(v.taskId) {
          const [task]=await tx.select().from(s.tasks).where(eq(s.tasks.id,v.taskId));
          if(!task || task.projectId!==projectId || task.deletedAt || task.archivedAt) throw new AppError(400,"Task must be active and in this project.");
        }
        const data={projectId,code:v.code,name:v.name,type:v.type,wbsId:v.wbsId,taskId:v.taskId,calendarId:v.calendarId,durationDays:v.durationDays,plannedStart:v.plannedStart,plannedFinish:v.plannedFinish,constraintType:v.constraintType,constraintDate:v.constraintDate};
        const [row]=existing
          ? await tx.update(s.planningActivities).set(data).where(eq(s.planningActivities.id,existing.id)).returning()
          : await tx.insert(s.planningActivities).values(data).returning();
        await log(tx,projectId,existing?"planning_activity_updated":"planning_activity_created",existing??null,row);
        return row;
      });
    },

    async saveRelationship(projectId: string, payload: unknown) {
      const v = relationshipInput.parse(payload);
      if (v.predecessorId === v.successorId) throw new AppError(400, "Circular relationship.");
      return locked(projectId, async tx => {
        const [existing] = v.id ? await tx.select().from(s.planningRelationships)
          .where(and(eq(s.planningRelationships.id,v.id),eq(s.planningRelationships.projectId,projectId))) : [];
        if (v.id && !existing) throw new AppError(404, "Relationship not found.");
        const activities = await tx.select({id:s.planningActivities.id}).from(s.planningActivities)
          .where(eq(s.planningActivities.projectId,projectId));
        const ids=new Set(activities.map(a=>a.id));
        if (!ids.has(v.predecessorId) || !ids.has(v.successorId))
          throw new AppError(400, "Both activities must belong to this project.");
        const links=await tx.select().from(s.planningRelationships)
          .where(eq(s.planningRelationships.projectId,projectId));
        // Project lock serializes concurrent graph modifications.
        const adjacency=new Map<string,string[]>();
        for(const link of links) {
          if (link.id===v.id) continue;
          const group=adjacency.get(link.predecessorId)??[];
          group.push(link.successorId);
          adjacency.set(link.predecessorId,group);
        }
        const stack=[v.successorId],seen=new Set<string>();
        while(stack.length){
          const next=stack.pop()!;
          if (next===v.predecessorId) throw new AppError(400, "Circular relationship.");
          if(seen.has(next))continue;
          seen.add(next);stack.push(...(adjacency.get(next)??[]));
        }
        const data={projectId,predecessorId:v.predecessorId,successorId:v.successorId,type:v.type,lagDays:v.lagDays};
        const [row]=existing
          ? await tx.update(s.planningRelationships).set(data).where(eq(s.planningRelationships.id,existing.id)).returning()
          : await tx.insert(s.planningRelationships).values(data).returning();
        await log(tx,projectId,existing?"planning_relationship_updated":"planning_relationship_created",existing??null,row);
        return row;
      });
    },
    async removeRelationship(projectId:string,relationshipId:string) {
      return locked(projectId,async tx=>{
        const [existing]=await tx.select().from(s.planningRelationships)
          .where(and(eq(s.planningRelationships.id,relationshipId),eq(s.planningRelationships.projectId,projectId)));
        if(!existing) throw new AppError(404, "Relationship not found.");
        await tx.delete(s.planningRelationships).where(eq(s.planningRelationships.id,relationshipId));
        await log(tx,projectId,"planning_relationship_removed",existing,null);
        return {deleted:true};
      });
    },
    async previewSchedule(projectId: string, calendarId: string) {
      const project=await access(db,projectId);
      if(!project.startDate) throw new AppError(409, "Set the project start date before scheduling.");
      const [calendar]=await db.select().from(s.planningCalendars)
        .where(and(eq(s.planningCalendars.id,calendarId),eq(s.planningCalendars.projectId,projectId)));
      if(!calendar) throw new AppError(404, "Calendar not found.");
      const [activities,links,exceptions]=await Promise.all([
        db.select().from(s.planningActivities).where(eq(s.planningActivities.projectId,projectId)),
        db.select().from(s.planningRelationships).where(eq(s.planningRelationships.projectId,projectId)),
        db.select().from(s.planningCalendarExceptions).where(eq(s.planningCalendarExceptions.calendarId,calendarId)),
      ]);
      if(activities.some(a=>a.calendarId && a.calendarId!==calendarId))
        throw new AppError(409, "This preview supports one shared calendar; another activity uses a different calendar.");
      return {
        projectId,calendarId,
        ...calculateCpm({
          activities:activities.map(a=>({id:a.id,durationDays:a.durationDays,notBeforeDate:a.constraintType==="snet"?a.constraintDate:null})),
          relationships:links.map(l=>({predecessorId:l.predecessorId,successorId:l.successorId,type:l.type,lagDays:l.lagDays})),
          startDate:project.startDate,
          calendar:{workingDays:calendar.workingDays,exceptions:exceptions.map(x=>({day:x.day,isWorking:x.isWorking}))},
        }),
      };
    },
  };
}
