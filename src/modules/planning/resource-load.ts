/**
 * Capacity overview only: planned hours are spread evenly over calendar days.
 * Does not move activities or claim real resource leveling.
 */
export type ResourceLoadInput={
 resources:{id:string;name:string;capacityHoursWeek:number}[];
 assignments:{resourceId:string;activityId:string;plannedHours:number}[];
 activities:{id:string;plannedStart:string|null;plannedFinish:string|null}[];
};
const date=(iso:string)=>Date.parse(iso+"T00:00:00Z");
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const ONE=86400000;
export function weeklyResourceLoad(input:ResourceLoadInput){
 const activities=new Map(input.activities.map(a=>[a.id,a]));
 const loads=new Map<string,{resourceId:string;weekStart:string;scheduledHours:number;capacityHours:number;overloaded:boolean}>();
 const unplanned:string[]=[];
 for(const a of input.assignments){
  const activity=activities.get(a.activityId);
  if(!activity?.plannedStart||!activity.plannedFinish){unplanned.push(a.activityId);continue;}
  const start=date(activity.plannedStart),end=date(activity.plannedFinish);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw Error("Invalid resource planning dates.");
  const resource=input.resources.find(r=>r.id===a.resourceId);
  if(!resource)throw Error("Resource assignment has invalid resource.");
  const days=(end-start)/ONE+1;
  if(days>36500)throw Error("Resource assignment horizon exceeds limit.");
  for(let d=start;d<=end;d+=ONE){
   const weekday=new Date(d).getUTCDay();
   const week=iso(d-weekday*ONE); // Sunday-based project week.
   const key=a.resourceId+"/"+week;
   let row=loads.get(key);
   if(!row){row={resourceId:a.resourceId,weekStart:week,scheduledHours:0,capacityHours:resource.capacityHoursWeek,overloaded:false};loads.set(key,row);}
   row.scheduledHours+=a.plannedHours/days;
  }
 }
 return {weeks:[...loads.values()].map(r=>({...r,scheduledHours:Math.round(r.scheduledHours*100)/100,overloaded:r.scheduledHours>r.capacityHours})).sort((a,b)=>a.weekStart.localeCompare(b.weekStart)||a.resourceId.localeCompare(b.resourceId)),unplannedActivityIds:[...new Set(unplanned)]};
}
