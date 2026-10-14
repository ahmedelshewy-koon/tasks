import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import * as s from "../src/db/schema";
import {migrateDatabase} from "../src/db/migrate";
import {createPlanningApprovals} from "../src/modules/planning/approvals";
import type {Actor} from "../src/modules/shared/types";
const client=new PGlite(),db=drizzle(client,{schema:s});
const actor=(userId:string):Actor=>({userId,employeeId:userId,isAdmin:userId==="admin",directReportIds:[]});
const api=(id:string)=>createPlanningApprovals(db,actor(id));
let p:string,other:string,baselineId:string;
const proposal={kind:"schedule",title:"Extend testing",description:"Additional quality assurance requested.",impactDays:3,impactMinor:0,currency:"SAR"};
beforeAll(async()=>{
 await migrateDatabase(client);
 await db.insert(s.users).values(["owner","manager","viewer","admin","outsider"].map(id=>({id,employeeId:id})));
 const [a,b]=await db.insert(s.projects).values([{name:"Delivery",ownerId:"owner"},{name:"Other",ownerId:"owner"}]).returning();
 p=a.id;other=b.id;
 await db.insert(s.members).values([{projectId:p,userId:"manager",role:"project_manager"},{projectId:p,userId:"viewer",role:"viewer"}]);
 baselineId=(await db.insert(s.planningBaselines).values({projectId:p,label:"Version 1",snapshot:{activities:[]},createdBy:"manager"}).returning())[0].id;
});afterAll(async()=>client.close());
describe("project approval and change control",()=>{
 it("submits a change, requires distinct owner decision, and never executes it",async()=>{
  const change=await api("manager").submitChange(p,proposal);
  expect(change.status).toBe("pending");
  await expect(api("manager").reviewChange(p,change.id,{status:"approved",note:"OK"})).rejects.toThrow();
  await expect(api("viewer").snapshot(p)).rejects.toThrow();
  await expect(api("outsider").submitChange(p,proposal)).rejects.toThrow();
  const approved=await api("owner").reviewChange(p,change.id,{status:"approved",note:"Approved for controlled implementation"});
  expect(approved.status).toBe("approved");
  await expect(api("owner").reviewChange(p,change.id,{status:"rejected",note:"Changed my mind"})).rejects.toThrow("final decision");
  // Approval is a decision record only, not a silent schedule or cost mutation.
  expect(await db.select().from(s.planningActivities)).toHaveLength(0);
  expect(await db.select().from(s.planningCostItems)).toHaveLength(0);
 });
 it("requires independent baseline approval and preserves immutable snapshot",async()=>{
  const requested=await api("manager").requestBaseline(p,baselineId);
  await expect(api("manager").requestBaseline(p,baselineId)).rejects.toThrow();
  await expect(api("manager").reviewBaseline(p,requested.id,{status:"approved"})).rejects.toThrow();
  const approved=await api("owner").reviewBaseline(p,requested.id,{status:"approved",note:"Reviewed"});
  expect(approved.reviewedBy).toBe("owner");
  expect((await api("manager").snapshot(p)).baselines[0].status).toBe("approved");
  expect((await db.select().from(s.planningBaselines))[0].label).toBe("Version 1");
 });
 it("rejects cross-project target, invalid rejected decision and self review",async()=>{
  await expect(api("owner").requestBaseline(other,baselineId)).rejects.toThrow();
  const own=await api("owner").submitChange(p,proposal);
  await expect(api("owner").reviewChange(p,own.id,{status:"approved"})).rejects.toThrow("requester");
  await expect(api("admin").reviewChange(p,own.id,{status:"rejected",note:""})).rejects.toThrow();
  const rejected=await api("admin").reviewChange(p,own.id,{status:"rejected",note:"Not in scope"});
  expect(rejected.status).toBe("rejected");
 });
});
