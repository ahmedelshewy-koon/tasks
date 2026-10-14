/** Pure schedule checks. Warnings do not change execution task rules. */
export type QualityInput={
 activities:{id:string;code:string;name:string;plannedStart:string|null;plannedFinish:string|null;durationDays:number;calendarId:string|null;wbsId:string|null}[];
 wbs:{id:string;parentId:string|null;code:string}[];
 relationships:{predecessorId:string;successorId:string;type:string;lagDays:number}[];
 calendars:{id:string}[];
 baselinesCount:number;
};
export type QualityIssue={kind:"warning"|"error";code:string;message:string;activityId?:string};
export function checkScheduleQuality(input:QualityInput):QualityIssue[]{
 const issues:QualityIssue[]=[];
 const activityIds=new Set(input.activities.map(a=>a.id)),wbsIds=new Set(input.wbs.map(w=>w.id)),calendarIds=new Set(input.calendars.map(c=>c.id));
 if(!input.activities.length)issues.push({kind:"error",code:"NO_ACTIVITIES",message:"The project has no planning activities."});
 if(!input.baselinesCount)issues.push({kind:"warning",code:"NO_BASELINE",message:"No approved schedule baseline has been captured."});
 for(const a of input.activities){
  if(!a.plannedStart||!a.plannedFinish)issues.push({kind:"warning",code:"UNDATED",message:"Manual planned dates are missing.",activityId:a.id});
  if(a.calendarId&&!calendarIds.has(a.calendarId))issues.push({kind:"error",code:"MISSING_CALENDAR",message:"Calendar reference is missing.",activityId:a.id});
  if(a.wbsId&&!wbsIds.has(a.wbsId))issues.push({kind:"error",code:"MISSING_WBS",message:"WBS reference is missing.",activityId:a.id});
 }
 for(const l of input.relationships){
  if(!activityIds.has(l.predecessorId)||!activityIds.has(l.successorId))issues.push({kind:"error",code:"BROKEN_LINK",message:"An activity dependency references missing work."});
  if(Math.abs(l.lagDays)>20)issues.push({kind:"warning",code:"LONG_LAG",message:"A relationship has a lag/lead over 20 workdays."});
 }
 for(const a of input.activities)if(input.activities.length>1&&!input.relationships.some(l=>l.predecessorId===a.id||l.successorId===a.id))
  issues.push({kind:"warning",code:"OPEN_END",message:"Activity has no scheduling relationships.",activityId:a.id});
 return issues;
}
