import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
import {mkdir} from "node:fs/promises";
const base=process.env.TASK_TEST_URL;
if(process.env.CI!=="true"||base!=="http://127.0.0.1:3107")throw Error("Dedicated browser CI required.");
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1360,height:900}});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
let projectId;
const command=async(action,data,id)=>{
 const response=await context.request.post(base+"/api/work",{headers:{origin:base},data:{action,data,id}});
 assert.equal(response.status(),200,JSON.stringify(await response.json()));
 return response.json();
};
const planning=async(action,data,extra={})=>{
 const response=await context.request.post(base+"/api/planning",{headers:{origin:base},data:{action,projectId,...extra,data}});
 const json=await response.json();
 assert.equal(response.status(),200,JSON.stringify(json));
 return json;
};
try{
 const login=await context.request.post(base+"/api/auth",{headers:{origin:base},data:{token:"local-admin"}});
 assert.equal(login.status(),200,"local development sign-in");
 const project=await command("createProject",{name:"Planning browser CI",startDate:"2026-10-18",memberIds:[]});
 projectId=project.id;
 const root=await planning("saveWbs",{code:"1",name:"Engineering"});
 const calendar=await planning("saveCalendar",{name:"Cairo standard",timeZone:"Africa/Cairo",workingDays:[0,1,2,3,4],minutesPerDay:480});
 const a=await planning("saveActivity",{code:"A",name:"Design",type:"task",wbsId:root.id,calendarId:calendar.id,durationDays:2,plannedStart:"2026-10-18",plannedFinish:"2026-10-19"});
 const b=await planning("saveActivity",{code:"B",name:"Build",type:"task",wbsId:root.id,calendarId:calendar.id,durationDays:4,plannedStart:"2026-10-20",plannedFinish:"2026-10-25"});
 await planning("saveRelationship",{predecessorId:a.id,successorId:b.id,type:"FS",lagDays:0});
 await page.addInitScript(()=>localStorage.setItem("task-language","en"));
 await page.goto(base+`/?page=projects&project=${projectId}&view=planning`);
 await page.getByRole("heading",{name:"Project planning"}).waitFor({timeout:25000});
 await page.getByRole("tab",{name:"WBS"}).click();
 await page.getByText("Engineering",{exact:true}).first().waitFor();
 await page.getByRole("tab",{name:"Activities"}).click();
 await page.getByText("Build",{exact:true}).first().waitFor();
 await page.getByRole("tab",{name:"Dependencies"}).click();
 await page.getByRole("button",{name:"Calculate CPM preview"}).waitFor();
 await page.getByRole("combobox",{name:"Calendar"}).first().selectOption(calendar.id);
 await page.getByRole("button",{name:"Calculate CPM preview"}).click();
 await page.getByText("Calculated Gantt — preview only").waitFor();
 await page.getByRole("tab",{name:"Baselines & Progress"}).click();
 await page.getByRole("heading",{name:"Approved baselines"}).waitFor();
 await page.getByRole("tab",{name:"Resources"}).click();
 await page.getByRole("heading",{name:"Resources",exact:false}).first().waitFor();
 await page.getByRole("tab",{name:"Costs"}).click();
 await page.getByRole("heading",{name:"Earned value metrics"}).waitFor();
 await page.getByRole("tab",{name:"Risks"}).click();
 await page.getByRole("heading",{name:"Risks",exact:false}).first().waitFor();
 await page.goto(base+"/?page=portfolio");
 await page.getByRole("heading",{name:"Project Portfolio"}).waitFor();
 await mkdir(".data/verification",{recursive:true});
 await page.screenshot({path:".data/verification/planning-portfolio-en.png",fullPage:true});
 const mobile=await browser.newContext({viewport:{width:390,height:844}});
 await mobile.addCookies(await context.cookies());
 await mobile.addInitScript(()=>localStorage.setItem("task-language","ar"));
 const ar=await mobile.newPage();
 ar.on("pageerror",e=>errors.push(e.message));
 await ar.goto(base+`/?page=projects&project=${projectId}&view=planning`);
 await ar.getByRole("heading",{name:"تخطيط المشروع"}).waitFor();
 assert.equal(await ar.locator("html").getAttribute("dir"),"rtl");
 await ar.screenshot({path:".data/verification/planning-mobile-ar.png",fullPage:true});
 await mobile.close();
 assert.deepEqual(errors,[]);
 console.info("Planning browser smoke passed in English desktop and Arabic mobile RTL.");
}finally{
 if(projectId){
  try{await command("archiveProject",undefined,projectId);await command("purgeProject",undefined,projectId);}catch(e){console.error("CI cleanup error",e);}
 }
 await browser.close();
}
