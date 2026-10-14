import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import {migrateDatabase} from "../src/db/migrate";
import {createEnterprisePlanning} from "../src/modules/planning/enterprise";
import type {Actor} from "../src/modules/shared/types";
const client=new PGlite(),db=drizzle(client,{schema});
const actor=(userId:string):Actor=>({userId,employeeId:userId,isAdmin:false,directReportIds:[]});
const directory=[{userId:"owner",employeeId:"owner",name:"Owner",email:"owner@test.invalid",company:"Test",branch:"",department:"",jobTitle:"",managerId:null},{userId:"viewer",employeeId:"viewer",name:"Viewer",email:"viewer@test.invalid",company:"Test",branch:"",department:"",jobTitle:"",managerId:null}];
const svc=(id:string)=>createEnterprisePlanning(db,actor(id),directory);
let projectId:string,otherId:string,activityId:string;
beforeAll(async()=>{
 await migrateDatabase(client);
 await db.insert(schema.users).values(["owner","viewer","outsider"].map(id=>({id,employeeId:id})));
 const [p,o]=await db.insert(schema.projects).values([{name:"P",ownerId:"owner"},{name:"O",ownerId:"owner"}]).returning();
 projectId=p.id;otherId=o.id;
 await db.insert(schema.members).values({projectId,userId:"viewer",role:"viewer"});
 activityId=(await db.insert(schema.planningActivities).values({projectId,code:"A1",name:"Build",durationDays:3}).returning())[0].id;
});afterAll(async()=>client.close());
describe("enterprise resource cost and risk controls",()=>{
 it("stores resources and assignments with strict project references",async()=>{
  const resource=await svc("owner").saveResource(projectId,{name:"Engineer",kind:"labor",hrUserId:"viewer",capacityHoursWeek:40,rateMinor:7500,currency:"SAR"});
  await svc("owner").saveAssignment(projectId,{activityId,resourceId:resource.id,plannedHours:24,allocationPercent:100});
  expect((await svc("viewer").snapshot(projectId)).assignments).toHaveLength(1);
  await expect(svc("owner").saveResource(projectId,{name:"Invalid HR",kind:"labor",hrUserId:"not-a-member"})).rejects.toThrow("verified member");
  await expect(svc("owner").saveAssignment(otherId,{activityId,resourceId:resource.id,plannedHours:2,allocationPercent:100})).rejects.toThrow("project");
  await expect(svc("viewer").saveResource(projectId,{name:"Denied",kind:"labor"})).rejects.toThrow();
 });
 it("records manual costs with fixed minor currency units",async()=>{
  const cost=await svc("owner").saveCost(projectId,{name:"Contract",activityId,budgetMinor:100000,actualMinor:60000,currency:"SAR"});
  expect(cost.budgetMinor).toBe(100000);
  expect((await svc("viewer").snapshot(projectId)).costs).toHaveLength(0);
  expect((await svc("owner").snapshot(projectId)).costs).toHaveLength(1);
  await expect(svc("owner").saveCost(projectId,{name:"Invalid",budgetMinor:-1,actualMinor:0,currency:"SAR"})).rejects.toThrow();
  await expect(svc("owner").saveCost(projectId,{name:"Wrong",activityId,budgetMinor:10,actualMinor:0,currency:"usd"})).rejects.toThrow();
  await expect(svc("owner").saveCost(otherId,{name:"Wrong",activityId,budgetMinor:10,actualMinor:0,currency:"SAR"})).rejects.toThrow();
 });
 it("registers risk scoring and role visibility",async()=>{
  await svc("owner").saveRisk(projectId,{title:"Vendor delay",probability:4,impact:5,status:"mitigating",response:"Second supplier"});
  const snapshot=await svc("viewer").snapshot(projectId);
  expect(snapshot.risks[0].probability*snapshot.risks[0].impact).toBe(20);
  await expect(svc("outsider").snapshot(projectId)).rejects.toThrow();
 });
});
