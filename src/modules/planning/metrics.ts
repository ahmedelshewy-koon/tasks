/**
 * Budget-weighted earned value from approved manual cost entries.
 * All sums are in integer minor currency units, never across currencies.
 * PV requires a captured baseline with planned dates and an explicit data date.
 * This is a simple linear-duration forecast, not Primavera's distribution curves.
 */
export type CostEntry = { activityId:string|null; currency:string; budgetMinor:number; actualMinor:number };
export type ProgressEntry = { activityId:string; percentComplete:number };
export type BaselineActivity = { id:string; plannedStart:string|null; plannedFinish:string|null };
const day=(s:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new Error("Invalid date.");
 const n=Date.parse(s+"T00:00:00Z");
 if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==s)throw new Error("Invalid date.");
 return Math.floor(n/86400000);
};
export function calculateEarnedValue(args:{
 costs:CostEntry[];progress:ProgressEntry[];currency:string;
 dataDate:string;baseline?:BaselineActivity[];
}){
 const date=day(args.dataDate);
 const chosen=args.costs.filter(x=>x.currency===args.currency);
 for(const v of chosen){
  if(!Number.isSafeInteger(v.budgetMinor)||v.budgetMinor<0||!Number.isSafeInteger(v.actualMinor)||v.actualMinor<0)throw new Error("Invalid money minor unit.");
 }
 const total=(values:number[])=>{
  const result=values.reduce((a,b)=>a+b,0);
  if(!Number.isSafeInteger(result))throw new Error("Money total exceeds safe integer precision.");
  return result;
 };
 const BAC=total(chosen.map(c=>c.budgetMinor));
 const AC=total(chosen.map(c=>c.actualMinor));
 const actual=new Map(args.progress.map(p=>[p.activityId,p.percentComplete]));
 const earned=chosen.map(c=>{
  const percent=c.activityId?(actual.get(c.activityId)??0):0;
  if(!Number.isInteger(percent)||percent<0||percent>100)throw new Error("Invalid progress percent.");
  return Math.round(c.budgetMinor*percent/100);
 });
 const EV=total(earned);
 // Unassigned cost cannot be given a defensible time-phased PV/EV.
 const baseline=args.baseline&&new Map(args.baseline.map(a=>[a.id,a]));
 const canForecast=!!baseline&&chosen.every(c=>{
  if(!c.activityId)return c.budgetMinor===0;
  const a=baseline.get(c.activityId);
  return !!a?.plannedStart&&!!a.plannedFinish;
 });
 let PV:number|null=null;
 if(canForecast){
  PV=total(chosen.map(c=>{
   if(!c.activityId)return 0;
   const a=baseline!.get(c.activityId)!;
   const start=day(a.plannedStart!),finish=day(a.plannedFinish!);
   if(finish<start)throw new Error("Baseline finish precedes start.");
   const percentage=date<start?0:date>=finish?1:(date-start+1)/(finish-start+1);
   return Math.round(c.budgetMinor*percentage);
  }));
 }
 return {
  currency:args.currency,BAC,EV,AC,PV,
  CV:EV-AC,SV:PV===null?null:EV-PV,
  CPI:AC>0?EV/AC:null,SPI:PV!==null&&PV>0?EV/PV:null,
  EAC:AC>0&&EV>0?BAC/(EV/AC):null,
  percentEarned:BAC>0?Math.round(EV/BAC*10000)/100:null,
  limitation:"Manual cost entries and linear baseline distribution; not contract-grade forecasting.",
 };
}
