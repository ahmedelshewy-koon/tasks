import {describe,it,expect} from "vitest";
import {checkScheduleQuality} from "../src/modules/planning/quality";
import {weeklyResourceLoad} from "../src/modules/planning/resource-load";
describe("schedule quality gates",()=>{
 it("reports undated, disconnected and missing-baseline issues without changing inputs",()=>{
  const issues=checkScheduleQuality({activities:[{id:"a",code:"1",name:"Design",plannedStart:null,plannedFinish:null,durationDays:2,wbsId:null,calendarId:null}],wbs:[],relationships:[],calendars:[],baselinesCount:0});
  expect(issues.map(x=>x.code)).toEqual(expect.arrayContaining(["NO_BASELINE","UNDATED"]));
 });
 it("reports broken link as error",()=>{
  const issues=checkScheduleQuality({activities:[{id:"a",code:"A",name:"A",plannedStart:"2026-10-18",plannedFinish:"2026-10-19",durationDays:2,wbsId:null,calendarId:null}],wbs:[],relationships:[{predecessorId:"a",successorId:"missing",type:"FS",lagDays:1}],calendars:[],baselinesCount:1});
  expect(issues.some(x=>x.kind==="error"&&x.code==="BROKEN_LINK")).toBe(true);
 });
});
describe("week by week capacity overview",()=>{
 it("flags overlapping assignment hours over weekly capacity",()=>{
  const result=weeklyResourceLoad({resources:[{id:"r",name:"Engineer",capacityHoursWeek:40}],assignments:[{activityId:"a",resourceId:"r",plannedHours:30},{activityId:"b",resourceId:"r",plannedHours:25}],activities:[{id:"a",plannedStart:"2026-10-18",plannedFinish:"2026-10-22"},{id:"b",plannedStart:"2026-10-18",plannedFinish:"2026-10-22"}]});
  expect(result.weeks[0].scheduledHours).toBe(55);
  expect(result.weeks[0].overloaded).toBe(true);
 });
 it("does not fabricate utilization for undated activities",()=>{
  const result=weeklyResourceLoad({resources:[{id:"r",name:"R",capacityHoursWeek:40}],assignments:[{activityId:"a",resourceId:"r",plannedHours:10}],activities:[{id:"a",plannedStart:null,plannedFinish:null}]});
  expect(result.weeks).toEqual([]);expect(result.unplannedActivityIds).toEqual(["a"]);
 });
});
