import { describe, beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { createPlanningService } from "../src/modules/planning/service";
import type { Actor } from "../src/modules/shared/types";

const client=new PGlite(),db=drizzle(client,{schema});
const actor=(userId:string):Actor=>({userId,employeeId:userId,isAdmin:false,directReportIds:[]});
const svc=(id:string)=>createPlanningService(db,actor(id));
let projectId:string, otherProjectId:string,calendarId:string;
let a:string,b:string,c:string;
beforeAll(async()=>{
  await migrateDatabase(client);
  await db.insert(schema.users).values(["owner","viewer","outsider"].map(id=>({id,employeeId:id})));
  const [project,other]=await db.insert(schema.projects).values([
    {name:"Main schedule",ownerId:"owner",startDate:"2026-10-18"},
    {name:"Other",ownerId:"owner",startDate:"2026-10-18"},
  ]).returning();
  projectId=project.id;otherProjectId=other.id;
  await db.insert(schema.members).values({projectId,userId:"viewer",role:"viewer"});
  calendarId=(await svc("owner").saveCalendar(projectId,{name:"Standard",timeZone:"Africa/Cairo",workingDays:[0,1,2,3,4],minutesPerDay:480})).id;
  a=(await svc("owner").saveActivity(projectId,{code:"A",name:"Design",durationDays:2,calendarId})).id;
  b=(await svc("owner").saveActivity(projectId,{code:"B",name:"Build",durationDays:4,calendarId})).id;
  c=(await svc("owner").saveActivity(projectId,{code:"C",name:"Testing",durationDays:3,calendarId})).id;
});
afterAll(async()=>client.close());
describe("Phase 2 schedule relationships",()=>{
  it("creates separate FS dependencies and returns correct CPM floats",async()=>{
    await svc("owner").saveRelationship(projectId,{predecessorId:a,successorId:b,type:"FS",lagDays:0});
    await svc("owner").saveRelationship(projectId,{predecessorId:a,successorId:c,type:"FS",lagDays:0});
    const snap=await svc("viewer").snapshot(projectId);
    expect(snap.relationships).toHaveLength(2);
    const calc=await svc("viewer").previewSchedule(projectId,calendarId);
    expect(calc.projectFinishDate).toBe("2026-10-25");
    const by=Object.fromEntries(calc.activities.map(x=>[x.id,x]));
    expect([by[a].totalFloatDays,by[b].totalFloatDays,by[c].totalFloatDays]).toEqual([0,0,1]);
    expect((await db.select().from(schema.dependencies))).toEqual([]);
  });
  it("disallows cycles, cross-project references and viewer writes",async()=>{
    await expect(svc("owner").saveRelationship(projectId,{predecessorId:b,successorId:a,type:"FS"})).rejects.toThrow("Circular");
    await expect(svc("owner").saveRelationship(otherProjectId,{predecessorId:a,successorId:b,type:"FS"})).rejects.toThrow("project");
    await expect(svc("viewer").saveRelationship(projectId,{predecessorId:b,successorId:c,type:"SS"})).rejects.toThrow();
    await expect(svc("outsider").previewSchedule(projectId,calendarId)).rejects.toThrow();
  });
  it("handles updates and removal with an audit trail",async()=>{
    const link=(await svc("owner").snapshot(projectId)).relationships[0];
    const updated=await svc("owner").saveRelationship(projectId,{id:link.id,predecessorId:a,successorId:b,type:"SS",lagDays:1});
    expect(updated.id).toBe(link.id);
    await svc("owner").removeRelationship(projectId,link.id);
    expect((await svc("owner").snapshot(projectId)).relationships).toHaveLength(1);
    const actions=(await db.select().from(schema.activity)).map(x=>x.action);
    expect(actions).toContain("planning_relationship_removed");
  });
  it("rejects multiple calendars in the single-calendar CPM preview",async()=>{
    const different=(await svc("owner").saveCalendar(projectId,{name:"Alternate",timeZone:"Asia/Riyadh",workingDays:[0,1,2],minutesPerDay:360})).id;
    await svc("owner").saveActivity(projectId,{code:"D",name:"Other calendar",calendarId:different,durationDays:1});
    await expect(svc("owner").previewSchedule(projectId,calendarId)).rejects.toThrow("one shared calendar");
  });
});
