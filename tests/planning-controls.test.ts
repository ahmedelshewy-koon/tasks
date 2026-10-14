import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import {migrateDatabase} from "../src/db/migrate";
import {createPlanningControls} from "../src/modules/planning/controls";
import type {Actor} from "../src/modules/shared/types";
const client=new PGlite(),db=drizzle(client,{schema});
const actor=(userId:string):Actor=>({userId,employeeId:userId,isAdmin:false,directReportIds:[]});
const service=(id:string)=>createPlanningControls(db,actor(id));
let projectId:string,activityId:string,otherId:string;
beforeAll(async()=>{
  await migrateDatabase(client);
  await db.insert(schema.users).values(["owner","manager","viewer","outsider"].map(id=>({id,employeeId:id})));
  const [p,other]=await db.insert(schema.projects).values([{name:"Main",ownerId:"owner"},{name:"Other",ownerId:"owner"}]).returning();
  projectId=p.id;otherId=other.id;
  await db.insert(schema.members).values([{projectId,userId:"manager",role:"project_manager"},{projectId,userId:"viewer",role:"viewer"}]);
  const [a]=await db.insert(schema.planningActivities).values({projectId,code:"A100",name:"Build",durationDays:3,plannedStart:"2026-10-19",plannedFinish:"2026-10-21"}).returning();
  activityId=a.id;
});afterAll(async()=>client.close());
describe("immutable baseline and progress control",()=>{
  it("captures plan once and does not rewrite snapshot after edits",async()=>{
    const baseline=await service("manager").captureBaseline(projectId,"Approved v1");
    const snap=baseline.snapshot as {activities:{name:string}[]};
    expect(snap.activities[0].name).toBe("Build");
    const {eq}=await import("drizzle-orm");
    await db.update(schema.planningActivities).set({name:"Revised"}).where(eq(schema.planningActivities.id,activityId));
    const row=(await service("owner").snapshot(projectId)).baselines[0];
    expect((row.snapshot as typeof snap).activities[0].name).toBe("Build");
    await expect(service("viewer").captureBaseline(projectId,"No")).rejects.toThrow();
  });
  it("updates progress separately and enforces actual dates",async()=>{
    const value={activityId,percentComplete:50,remainingDays:2,actualStart:"2026-10-19",actualFinish:null,note:"Started"};
    await service("manager").updateProgress(projectId,value);
    expect((await service("viewer").snapshot(projectId)).progress[0].percentComplete).toBe(50);
    await expect(service("manager").updateProgress(projectId,{...value,actualFinish:"2026-10-20"})).rejects.toThrow();
    await service("manager").updateProgress(projectId,{...value,percentComplete:100,actualFinish:"2026-10-20",remainingDays:0});
    expect((await service("viewer").snapshot(projectId)).progress[0].actualFinish).toBe("2026-10-20");
  });
  it("protects other projects and denies unlisted users",async()=>{
    await expect(service("owner").updateProgress(otherId,{activityId,percentComplete:20,actualStart:null,actualFinish:null,remainingDays:3})).rejects.toThrow();
    await expect(service("outsider").snapshot(projectId)).rejects.toThrow();
  });
});
