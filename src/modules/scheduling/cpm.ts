/**
 * Read-only CPM preview (Phase 2 foundation).
 * One shared project working-day calendar, integer workday durations and lags.
 * Dates are civil dates, not timestamps, so DST and locale offsets cannot move days.
 * No side effects, task mutations, database writes or resource leveling.
 */
export type RelationshipType = "FS" | "SS" | "FF" | "SF";
export type ScheduleActivity = { id: string; durationDays: number; notBeforeDate?: string | null };
export type ScheduleLink = { predecessorId: string; successorId: string; type: RelationshipType; lagDays: number };
export type ScheduleCalendar = {
  workingDays: number[];
  exceptions?: { day: string; isWorking: boolean }[];
};
export type ScheduledActivity = {
  id: string;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloatDays: number;
  critical: boolean;
  earlyStartDate: string;
  earlyFinishDate: string;
  lateStartDate: string;
  lateFinishDate: string;
};
export type CpmPreview = { projectFinishDate: string | null; activities: ScheduledActivity[] };

const DAY = 86_400_000;
function toDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid project start date.");
  const [year, month, date] = value.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, date);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== value)
    throw new Error("Invalid project start date.");
  return Math.floor(utc / DAY);
}
const toIso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
function prepareCalendar(calendar: ScheduleCalendar) {
  const days = calendar.workingDays;
  if (!days.length || new Set(days).size !== days.length || days.some(d=>!Number.isInteger(d)||d<0||d>6))
    throw new Error("Calendar needs at least one unique working weekday.");
  const exceptions = new Map<string, boolean>();
  for (const e of calendar.exceptions ?? []) {
    toDay(e.day);
    if (exceptions.has(e.day)) throw new Error("Duplicate calendar exception.");
    exceptions.set(e.day, e.isWorking);
  }
  return (n: number) => {
    const date = toIso(n);
    return exceptions.get(date) ?? days.includes(new Date(n * DAY).getUTCDay());
  };
}
function workDates(start: string, maxSlot: number, calendar: ScheduleCalendar) {
  if (maxSlot > 365000) throw new Error("Schedule exceeds the supported horizon.");
  const isWorking = prepareCalendar(calendar);
  const days: string[] = [];
  for (let d = toDay(start); days.length <= maxSlot; d++) {
    if (isWorking(d)) days.push(toIso(d));
    if (d - toDay(start) > maxSlot * 8 + 365000) throw new Error("No working days available.");
  }
  return days;
}
function offset(link: ScheduleLink, before: number, after: number) {
  switch (link.type) {
    case "FS": return before + link.lagDays;
    case "SS": return link.lagDays;
    case "FF": return before + link.lagDays - after;
    case "SF": return link.lagDays - after;
    default: throw new Error("Unknown relationship type.");
  }
}

function minimumWorkSlot(start: string, minDate: string, calendar: ScheduleCalendar) {
  const isWorking=prepareCalendar(calendar);
  const startDay=toDay(start),target=toDay(minDate);
  if(target<=startDay)return 0;
  let slot=0;
  for(let d=startDay;d<startDay+365000;d++){
    if(isWorking(d)){
      if(d>=target)return slot;
      slot++;
    }
  }
  throw new Error("Start constraint exceeds the supported horizon.");
}

/** Forward/backward longest-path calculation over start-to-start constraints. */
export function calculateCpm(input: {
  activities: ScheduleActivity[];
  relationships: ScheduleLink[];
  startDate: string;
  calendar: ScheduleCalendar;
}): CpmPreview {
  toDay(input.startDate);
  prepareCalendar(input.calendar);
  const { activities, relationships } = input;
  const map = new Map(activities.map(a=>[a.id,a]));
  if (map.size !== activities.length || activities.some(a=>!a.id || !Number.isInteger(a.durationDays)||a.durationDays<0||a.durationDays>36500))
    throw new Error("Invalid or duplicate activities.");
  const outgoing = new Map<string, {target:string;offset:number}[]>();
  const incoming = new Map<string, {source:string;offset:number}[]>();
  const degree = new Map<string, number>();
  for(const a of activities){outgoing.set(a.id,[]);incoming.set(a.id,[]);degree.set(a.id,0);}
  const links = new Set<string>();
  for (const l of relationships) {
    const p=map.get(l.predecessorId), s=map.get(l.successorId);
    if(!p || !s || p.id===s.id) throw new Error("Relationship must reference two distinct activities.");
    if(!Number.isInteger(l.lagDays)||Math.abs(l.lagDays)>36500) throw new Error("Invalid relationship lag.");
    const key=`${p.id}/${s.id}/${l.type}`;
    if(links.has(key)) throw new Error("Duplicate relationship.");
    links.add(key);
    const delta=offset(l,p.durationDays,s.durationDays);
    outgoing.get(p.id)!.push({target:s.id,offset:delta});
    incoming.get(s.id)!.push({source:p.id,offset:delta});
    degree.set(s.id,degree.get(s.id)!+1);
  }
  const ready=activities.filter(a=>degree.get(a.id)===0).map(a=>a.id);
  const order:string[]=[];
  for(let i=0;i<ready.length;i++){
    const id=ready[i];order.push(id);
    for(const edge of outgoing.get(id)!){
      const next=degree.get(edge.target)!-1;
      degree.set(edge.target,next);
      if(next===0)ready.push(edge.target);
    }
  }
  if(order.length!==activities.length)throw new Error("Circular schedule relationships are not allowed.");
  const early=new Map<string,number>();
  for(const id of order) {
    const notBefore=map.get(id)!.notBeforeDate;
    const constraint=notBefore?minimumWorkSlot(input.startDate,notBefore,input.calendar):0;
    const es=Math.max(0,constraint,...incoming.get(id)!.map(e=>early.get(e.source)!+e.offset));
    early.set(id,es);
  }
  const horizon=Math.max(0,...activities.map(a=>early.get(a.id)!+a.durationDays));
  const late=new Map<string,number>();
  for(const id of order.slice().reverse()){
    const duration=map.get(id)!.durationDays;
    const ls=Math.min(horizon-duration,...outgoing.get(id)!.map(e=>late.get(e.target)!-e.offset));
    late.set(id,ls);
  }
  const maxSlot=Math.max(horizon,...early.values(),...late.values(),0);
  const dates=activities.length?workDates(input.startDate,maxSlot,input.calendar):[];
  const rows=activities.map(a=>{
    const es=early.get(a.id)!,ls=late.get(a.id)!,ef=es+a.durationDays,lf=ls+a.durationDays;
    const finishSlot=(start:number)=>start+Math.max(a.durationDays-1,0);
    const float=ls-es;
    return {
      id:a.id,earliestStart:es,earliestFinish:ef,latestStart:ls,latestFinish:lf,
      totalFloatDays:float,critical:float===0,
      earlyStartDate:dates[es],earlyFinishDate:dates[finishSlot(es)],
      lateStartDate:dates[ls],lateFinishDate:dates[finishSlot(ls)],
    };
  });
  return { projectFinishDate: rows.length ? rows.map(r=>r.earlyFinishDate).sort().at(-1)! : null, activities: rows };
}
