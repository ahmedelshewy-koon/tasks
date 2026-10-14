import {describe,it,expect} from "vitest";
import {planningActivitiesCsv} from "../src/modules/planning/export";
describe("planning CSV export",()=>{
 it("exports Arabic safely without executable spreadsheet formulas",()=>{
  const csv=planningActivitiesCsv([{code:"A1",name:'=IMPORTDATA("x"), مشروع',type:"task",durationDays:4,wbsId:"w1",plannedStart:null,plannedFinish:"2026-11-01"}],[{id:"w1",code:"1.2"}]);
  expect(csv.charCodeAt(0)).toBe(65279);
  expect(csv).toContain("'=IMPORTDATA");
  expect(csv).toContain('""x""');
  expect(csv).toContain("مشروع");
  expect(csv).toContain("1.2");
 });
});
