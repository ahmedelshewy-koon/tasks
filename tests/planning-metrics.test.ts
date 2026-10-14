import {describe,it,expect} from "vitest";
import {calculateEarnedValue} from "../src/modules/planning/metrics";
const cost={activityId:"a",currency:"SAR",budgetMinor:10000,actualMinor:5000};
const baseline=[{id:"a",plannedStart:"2026-10-18",plannedFinish:"2026-10-21"}];
describe("earned value currency-safe calculations",()=>{
 it("calculates BAC AC EV CPI PV SPI from baseline and progress",()=>{
  const v=calculateEarnedValue({costs:[cost],progress:[{activityId:"a",percentComplete:50}],currency:"SAR",baseline,dataDate:"2026-10-19"});
  expect([v.BAC,v.AC,v.EV,v.PV,v.CV,v.SV]).toEqual([10000,5000,5000,5000,0,0]);
  expect(v.CPI).toBe(1);expect(v.SPI).toBe(1);
 });
 it("refuses to fabricate PV and SPI with no baseline",()=>{
  const v=calculateEarnedValue({costs:[cost],progress:[],currency:"SAR",dataDate:"2026-10-19"});
  expect(v.PV).toBeNull();expect(v.SPI).toBeNull();
 });
 it("never combines currencies and guards money precision",()=>{
  const v=calculateEarnedValue({costs:[cost,{activityId:"a",currency:"USD",budgetMinor:500000,actualMinor:300000}],progress:[],currency:"SAR",dataDate:"2026-10-19"});
  expect(v.BAC).toBe(10000);
  expect(()=>calculateEarnedValue({costs:[{...cost,budgetMinor:Number.MAX_SAFE_INTEGER+1}],progress:[],currency:"SAR",dataDate:"2026-10-19"})).toThrow();
 });
 it("does not time-phase costs without baseline dates",()=>{
  const v=calculateEarnedValue({costs:[{...cost,activityId:null}],progress:[],baseline,dataDate:"2026-10-19",currency:"SAR"});
  expect(v.PV).toBeNull();
 });
});
