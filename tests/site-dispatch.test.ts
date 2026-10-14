import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import * as s from "../src/db/schema";
import {migrateDatabase} from "../src/db/migrate";
import {createService} from "../src/modules/work/service";
import {listSiteWorkers} from "../src/modules/site/availability";
import type {Actor,Employee} from "../src/modules/shared/types";
const client=new PGlite(),db=drizzle(client,{schema:s});
const actor=(userId:string):Actor=>({userId,employeeId:userId,isAdmin:false,directReportIds:[]});
const directory:Employee[]=[
 {userId:"manager",employeeId:"manager",name:"Supervisor",email:"m@dev.test",company:"Test",branch:"",department:"Site",jobTitle:"Site Manager",managerId:null},
 {userId:"electric1",employeeId:"electric1",name:"Electrician A",email:"a@dev.test",company:"Test",branch:"",department:"Site",jobTitle:"Electrician",managerId:"manager"},
 {userId:"electric2",employeeId:"electric2",name:"Electrician B",email:"b@dev.test",company:"Test",branch:"",department:"Site",jobTitle:"Electrician",managerId:"manager"},
 {userId:"viewer",employeeId:"viewer",name:"Read only",email:"v@dev.test",company:"Test",branch:"",department:"Site",jobTitle:"Engineer",managerId:null},
];
const service=(userId:string)=>createService(db,actor(userId),directory);
let project1:string,project2:string,firstId:string;
beforeAll(async()=>{
 await migrateDatabase(client);
 await db.insert(s.users).values(directory.map(p=>({id:p.userId,employeeId:p.employeeId})));
 const [a,b]=await db.insert(s.projects).values([{name:"Tower",ownerId:"manager"},{name:"Workshop",ownerId:"manager"}]).returning();
 project1=a.id;project2=b.id;
 await db.insert(s.members).values([
  {projectId:project1,userId:"electric1",role:"member"},{projectId:project1,userId:"electric2",role:"member"},
  {projectId:project1,userId:"viewer",role:"viewer"},
  {projectId:project2,userId:"electric1",role:"member"},{projectId:project2,userId:"electric2",role:"member"}
 ]);
});afterAll(async()=>client.close());
const dispatch=(projectId:string,userId:string)=>service("manager").createTask({
 title:"Fix faulty wiring",description:"Ground-floor distribution panel",projectId,assigneeIds:[userId],
 status:"in_progress",siteDispatch:true,siteEstimateMinutes:90,
});
describe("construction site technician dispatch",()=>{
 it("starts an active task with a fixed ETA and shows other eligible workers as available",async()=>{
  const first=await dispatch(project1,"electric1");firstId=first.id;
  expect(first.siteEstimateMinutes).toBe(90);
  expect(first.siteStartedAt).toBeTruthy();
  expect(Math.round((first.siteExpectedEndAt!.getTime()-first.siteStartedAt!.getTime())/60000)).toBe(90);
  const people=await listSiteWorkers(db,actor("manager"),directory,project1);
  expect(people.find(w=>w.userId==="electric1")?.busy).toBe(true);
  expect(people.find(w=>w.userId==="electric1")?.currentJobs[0]?.title).toBe("Fix faulty wiring");
  expect(people.find(w=>w.userId==="electric2")?.busy).toBe(false);
  expect(people.find(w=>w.userId==="viewer")).toBeUndefined();
  await expect(dispatch(project2,"electric1")).rejects.toThrow("busy");
  const separate=await dispatch(project2,"electric2");
  expect(separate.siteStartedAt).toBeTruthy();
 });
 it("hides cross-project task details but blocks assignments across both projects",async()=>{
  const status=await listSiteWorkers(db,actor("manager"),directory,project2);
  const worker=status.find(w=>w.userId==="electric1")!;
  expect(worker.busy).toBe(true);
  expect(worker.currentJobs[0].taskId).toBeNull();
  expect(worker.currentJobs[0].title).toBe("Other assignment");
  expect(status.find(w=>w.userId==="electric2")?.busy).toBe(true);
 });
 it("does not free late workers solely because ETA passed",async()=>{
  const future=new Date(Date.now()+3*60*60*1000);
  const status=await listSiteWorkers(db,actor("manager"),directory,project1,future);
  const worker=status.find(w=>w.userId==="electric1")!;
  expect(worker.busy).toBe(true);
  expect(worker.overdue).toBe(true);
 });
 it("frees a worker after their task assignment is completed",async()=>{
  await service("electric1").completePart(firstId,"electric1",true);
  const worker=(await listSiteWorkers(db,actor("manager"),directory,project2)).find(w=>w.userId==="electric1")!;
  expect(worker.busy).toBe(false);
  await expect(dispatch(project2,"electric1")).resolves.toHaveProperty("id");
 });
 it("keeps legacy task creation optional and enforces manager permissions",async()=>{
  await expect(service("electric2").createTask({title:"Unauthorized dispatch",projectId:project1,assigneeIds:["electric2"],status:"in_progress",siteEstimateMinutes:30,siteDispatch:true})).rejects.toThrow();
  await expect(service("manager").createTask({title:"Bad duration",projectId:project1,assigneeIds:["electric1"],status:"in_progress",siteDispatch:true,siteEstimateMinutes:5})).rejects.toThrow();
  await expect(listSiteWorkers(db,actor("viewer"),directory,project1)).rejects.toThrow();
  const ordinary=await service("manager").createTask({title:"Existing standard task",projectId:project1,assigneeIds:["electric2"]});
  expect(ordinary.siteEstimateMinutes).toBeNull();
 });
});
