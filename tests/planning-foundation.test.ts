import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { createPlanningService } from "../src/modules/planning/service";
import type { Actor } from "../src/modules/shared/types";
const client=new PGlite();
const db=drizzle(client,{schema});
const actor=(userId:string,isAdmin=false):Actor=>({userId,employeeId:userId,isAdmin,directReportIds:[]});
const svc=(id:string)=>createPlanningService(db,actor(id,id==="admin"));
let projectId:string, otherId:string;
beforeAll(async()=>{
  await migrateDatabase(client);
  await db.insert(schema.users).values(["admin","owner","manager","viewer","outsider"].map(id=>({id,employeeId:id})));
  const [project,other]=await db.insert(schema.projects).values([{name:"Main",ownerId:"owner"},{name:"Other",ownerId:"owner"}]).returning();
  projectId=project.id;otherId=other.id;
  await db.insert(schema.members).values([{projectId,userId:"manager",role:"project_manager"},{projectId,userId:"viewer",role:"viewer"}]);
});
afterAll(async()=>client.close());
describe("additive enterprise planning foundation",()=>{
  it("allows scoped reads and blocks unauthorized edits and outsiders",async()=>{
    expect((await svc("viewer").snapshot(projectId)).wbs).toEqual([]);
    await expect(svc("viewer").saveWbs(projectId,{code:"1",name:"Denied"})).rejects.toThrow();
    await expect(svc("outsider").snapshot(projectId)).rejects.toThrow();
  });
  it("creates nested WBS and blocks cycles",async()=>{
    const root=await svc("manager").saveWbs(projectId,{code:"1",name:"Engineering"});
    const child=await svc("manager").saveWbs(projectId,{code:"1.1",name:"Build",parentId:root.id});
    await expect(svc("manager").saveWbs(projectId,{id:root.id,code:"1",name:"Engineering",parentId:child.id})).rejects.toThrow("Circular");
    await expect(svc("manager").saveWbs(otherId,{code:"A",name:"Cross",parentId:child.id})).rejects.toThrow();
  });
  it("validates project-scoped calendar and dates",async()=>{
    const calendar=await svc("owner").saveCalendar(projectId,{name:"Riyadh",timeZone:"Asia/Riyadh",workingDays:[0,1,2,3,4],minutesPerDay:480});
    await svc("owner").saveException(projectId,calendar.id,{day:"2026-10-15",isWorking:false,note:"Holiday"});
    await expect(svc("manager").saveCalendar(projectId,{name:"Bad",timeZone:"Not/AZone",workingDays:[0],minutesPerDay:480})).rejects.toThrow();
    await expect(svc("manager").saveActivity(projectId,{code:"A100",name:"Wrong",type:"milestone"})).rejects.toThrow("Milestone");
    const row=await svc("manager").saveActivity(projectId,{code:"A100",name:"Design",type:"task",calendarId:calendar.id,durationDays:4,plannedStart:"2026-10-18",plannedFinish:"2026-10-21"});
    expect(row.plannedStart).toBe("2026-10-18");
    await expect(svc("manager").saveActivity(otherId,{code:"B100",name:"No cross project",calendarId:calendar.id})).rejects.toThrow();
  });
  it("retains original task dates and archives block edits",async()=>{
    const [task]=await db.insert(schema.tasks).values({title:"Existing",creatorId:"owner",projectId,dueDate:"2026-12-01"}).returning();
    await svc("owner").saveActivity(projectId,{code:"LINK",name:"Linked plan",taskId:task.id,plannedStart:"2026-10-20",plannedFinish:"2026-10-25"});
    const [current]=await db.select().from(schema.tasks);
    expect(current.dueDate).toBe("2026-12-01");
    await db.update(schema.projects).set({archivedAt:new Date()});
    // Archiving the test project must not affect unrelated projects.
    const {eq}=await import("drizzle-orm");
    await db.update(schema.projects).set({archivedAt:null}).where(eq(schema.projects.id,otherId));
    await expect(svc("owner").saveWbs(projectId,{code:"new",name:"Denied"})).rejects.toThrow("Archived");
  });
});
