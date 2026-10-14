"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Layers3, ListChecks, GitBranch, Pencil, Plus, RotateCcw } from "lucide-react";
import { request, type Project, type Task } from "./api";
import type { Language } from "./i18n";
import "./planning-view.css";
import { ProjectControls } from "./project-controls";

type Wbs = { id:string;code:string;name:string;parentId:string|null;position:number };
type Calendar = { id:string;name:string;timeZone:string;workingDays:number[];minutesPerDay:number };
type Activity = { id:string;code:string;name:string;type:"task"|"milestone";wbsId:string|null;taskId:string|null;calendarId:string|null;durationDays:number;plannedStart:string|null;plannedFinish:string|null };
type Relationship = {id:string;predecessorId:string;successorId:string;type:"FS"|"SS"|"FF"|"SF";lagDays:number};
type Preview = {projectFinishDate:string|null;activities:{id:string;earlyStartDate:string;earlyFinishDate:string;totalFloatDays:number;critical:boolean}[]};
type Exception = { id:string;calendarId:string;day:string;isWorking:boolean;note:string };
type Snapshot = {wbs:Wbs[];calendars:Calendar[];activities:Activity[];relationships:Relationship[];exceptions:Exception[]};
type WbsForm = {id?:string;code:string;name:string;parentId:string;position:number};
type CalendarForm = {id?:string;name:string;timeZone:string;workingDays:number[];minutesPerDay:number};
type ActivityForm = {id?:string;code:string;name:string;type:"task"|"milestone";wbsId:string;taskId:string;calendarId:string;durationDays:number;plannedStart:string;plannedFinish:string};
const blankWbs=():WbsForm=>({code:"",name:"",parentId:"",position:0});
const blankCalendar=():CalendarForm=>({name:"",timeZone:"Africa/Cairo",workingDays:[0,1,2,3,4],minutesPerDay:480});
const blankActivity=():ActivityForm=>({code:"",name:"",type:"task",wbsId:"",taskId:"",calendarId:"",durationDays:1,plannedStart:"",plannedFinish:""});
const nullable=(s:string)=>s||null;
const text={
  en:{heading:"Project planning",explain:"Planning dates are independent of existing task dates.",wbs:"WBS",activities:"Activities",calendars:"Calendars",links:"Dependencies",preview:"Calculate CPM preview",finishDate:"Project finish",float:"Total float",critical:"Critical",remove:"Remove",code:"Code",name:"Name",parent:"Parent",none:"None",order:"Order",type:"Type",duration:"Duration in working days",start:"Planned start",finish:"Planned finish",linkedTask:"Linked task",calendar:"Calendar",timeZone:"IANA time zone",minutes:"Working minutes/day",days:"Working days",date:"Exception date",working:"Working day",nonworking:"Non-working day",note:"Note",addException:"Save exception",exception:"Calendar exceptions",save:"Save",edit:"Edit",reset:"Clear form",loading:"Loading planning data…",empty:"No planning records yet.",readonly:"Only project managers can edit planning data.",error:"Planning data unavailable. The additive migration must be verified in staging before rollout.",task:"Task",milestone:"Milestone",week:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]},
  ar:{heading:"تخطيط المشروع",explain:"تواريخ التخطيط مستقلة عن تواريخ المهام الموجودة.",wbs:"هيكل العمل WBS",activities:"الأنشطة",calendars:"التقاويم",links:"الاعتماديات",preview:"حساب المسار الحرج",finishDate:"نهاية المشروع",float:"السماح الزمني",critical:"حرج",remove:"حذف",code:"الكود",name:"الاسم",parent:"المستوى الأعلى",none:"بدون",order:"الترتيب",type:"النوع",duration:"المدة بأيام العمل",start:"البداية المخططة",finish:"النهاية المخططة",linkedTask:"المهمة المرتبطة",calendar:"التقويم",timeZone:"المنطقة الزمنية",minutes:"دقائق العمل اليومية",days:"أيام العمل",date:"تاريخ الاستثناء",working:"يوم عمل",nonworking:"إجازة",note:"ملاحظة",addException:"حفظ الاستثناء",exception:"استثناءات التقويم",save:"حفظ",edit:"تعديل",reset:"إفراغ النموذج",loading:"جاري تحميل بيانات التخطيط…",empty:"لا توجد بيانات تخطيط بعد.",readonly:"التعديل متاح لمدير المشروع فقط.",error:"بيانات التخطيط غير متاحة. يجب اعتماد Migration الإضافي في بيئة الاختبار أولًا.",task:"نشاط",milestone:"معلم",week:["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]},
} as const;
const errorMessage=(error:unknown)=>error instanceof Error?error.message:"Request failed";

function PreviewTimeline({ preview, activities, lang }: { preview: Preview; activities: Activity[]; lang: Language }) {
  if (!preview.activities.length) return null;
  const dates = preview.activities.flatMap(a => [a.earlyStartDate, a.earlyFinishDate]);
  const start = Math.min(...dates.map(d => Date.parse(d+"T00:00:00Z")));
  const end = Math.max(...dates.map(d => Date.parse(d+"T00:00:00Z")));
  const day = 86400000;
  const span = Math.max(1,Math.round((end-start)/day)+1);
  const pixels = Math.max(440,span*26);
  const x = (date:string) => Math.round((Date.parse(date+"T00:00:00Z")-start)/day)*26;
  const fmt=(date:string)=>new Intl.DateTimeFormat(lang==="ar"?"ar-EG":"en-GB",{day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(date+"T00:00:00Z"));
  const ordered=preview.activities.slice().sort((a,b)=>a.earlyStartDate.localeCompare(b.earlyStartDate));
  return <div className="ep-timeline" aria-label={lang==="ar"?"المخطط الزمني للمشروع":"Project schedule Gantt preview"}>
    <div className="ep-timeline-label">{lang==="ar"?"مخطط Gantt المحسوب — للمعاينة":"Calculated Gantt — preview only"}</div>
    <div className="ep-timeline-scroll"><div style={{minWidth:pixels+195}}>
      <div className="ep-timeline-head"><span>{lang==="ar"?"النشاط":"Activity"}</span><span>{fmt(new Date(start).toISOString().slice(0,10))} — {fmt(new Date(end).toISOString().slice(0,10))}</span></div>
      {ordered.map(row => {
        const activity=activities.find(a=>a.id===row.id);
        const offset=x(row.earlyStartDate), length=Math.max(8,x(row.earlyFinishDate)-offset+26);
        return <div className="ep-timeline-row" key={row.id}>
          <span className="ep-timeline-name" title={activity?.name??row.id}>{activity?.code??row.id} · {activity?.name}</span>
          <div className="ep-timeline-track" style={{width:pixels}}>
            <span className={row.critical?"ep-timeline-bar critical":"ep-timeline-bar"} style={{insetInlineStart:offset,width:length}} title={`${row.earlyStartDate} → ${row.earlyFinishDate} | Float: ${row.totalFloatDays}`}/>
          </div>
        </div>;
      })}
    </div></div>
    <p className="ep-muted">{lang==="ar"?"الأخضر الداكن = المسار الحرج. هذا العرض لا يغيّر التواريخ الحالية.":"Dark green = critical path. This preview does not change existing task dates."}</p>
  </div>;
}

export function ProjectPlanning({project,tasks,lang}:{project:Project;tasks:Task[];lang:Language}) {
  const t=text[lang], client=useQueryClient();
  const [tab,setTab]=useState<"wbs"|"activities"|"calendars"|"links"|"control">("wbs");
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const [wbs,setWbs]=useState<WbsForm>(blankWbs),[activity,setActivity]=useState<ActivityForm>(blankActivity),[calendar,setCalendar]=useState<CalendarForm>(blankCalendar);
  const [exception,setException]=useState({calendarId:"",day:"",isWorking:false,note:""});
  const [link,setLink]=useState({predecessorId:"",successorId:"",type:"FS" as Relationship["type"],lagDays:0});
  const [previewId,setPreviewId]=useState(""),[preview,setPreview]=useState<Preview|null>(null);
  const query=useQuery({queryKey:["project-planning",project.id],queryFn:()=>request<Snapshot>(`/api/planning?projectId=${encodeURIComponent(project.id)}`),retry:false});
  const data=query.data, writable=project.canManage&&!project.archivedAt;
  async function save(action:string, payload:object, calendarId?:string, relationshipId?:string) {
    setSaving(true);setError("");setPreview(null);
    try {
      await request("/api/planning",{method:"POST",body:JSON.stringify({action,projectId:project.id,calendarId,relationshipId,data:payload})});
      await client.invalidateQueries({queryKey:["project-planning",project.id]});
      if(action==="saveWbs")setWbs(blankWbs());
      if(action==="saveActivity")setActivity(blankActivity());
      if(action==="saveCalendar")setCalendar(blankCalendar());
      if(action==="saveException")setException({calendarId:"",day:"",isWorking:false,note:""});
      if(action==="saveRelationship")setLink({predecessorId:"",successorId:"",type:"FS",lagDays:0});
    } catch(e){setError(errorMessage(e));}
    finally{setSaving(false);}
  }
  async function calculate() {
    setSaving(true);setError("");setPreview(null);
    try {setPreview(await request<Preview>(`/api/planning?projectId=${encodeURIComponent(project.id)}&previewCalendar=${encodeURIComponent(previewId)}`));}
    catch(e){setError(errorMessage(e));}
    finally{setSaving(false);}
  }
  async function removeRelationship(id:string) {
    await save("removeRelationship",{},undefined,id);
  }
  return <section className="ep-workspace" aria-label={t.heading}>
    <div className="ep-heading"><div><h2>{t.heading}</h2><p>{t.explain}</p></div><button className="button secondary" type="button" onClick={()=>void query.refetch()} disabled={query.isFetching} aria-label="Refresh"><RotateCcw size={16}/></button></div>
    <div className="ep-tabs" role="tablist">
      <button role="tab" aria-selected={tab==="wbs"} className={tab==="wbs"?"active":""} onClick={()=>setTab("wbs")}><Layers3 size={15}/>{t.wbs}</button>
      <button role="tab" aria-selected={tab==="activities"} className={tab==="activities"?"active":""} onClick={()=>setTab("activities")}><ListChecks size={15}/>{t.activities}</button>
      <button role="tab" aria-selected={tab==="links"} className={tab==="links"?"active":""} onClick={()=>setTab("links")}><GitBranch size={15}/>{t.links}</button>
      <button role="tab" aria-selected={tab==="control"} className={tab==="control"?"active":""} onClick={()=>setTab("control")}>{lang==="ar"?"خط الأساس والتقدم":"Baselines & Progress"}</button>
      <button role="tab" aria-selected={tab==="calendars"} className={tab==="calendars"?"active":""} onClick={()=>setTab("calendars")}><CalendarDays size={15}/>{t.calendars}</button>
    </div>
    {query.isPending?<div className="panel ep-card">{t.loading}</div>:query.isError?<div className="panel ep-card ep-error" role="alert">{t.error}<p>{errorMessage(query.error)}</p></div>:data&&<>
      {!writable&&<p className="ep-muted">{t.readonly}</p>}{error&&<p role="alert" className="ep-error">{error}</p>}
      {tab==="wbs"&&<div className="ep-grid">
        <div className="panel ep-card"><h3>{t.wbs} ({data.wbs.length})</h3>{data.wbs.length===0?<p className="ep-muted">{t.empty}</p>:<div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.code}</th><th>{t.name}</th><th>{t.parent}</th>{writable&&<th>{t.edit}</th>}</tr></thead><tbody>
          {data.wbs.slice().sort((a,b)=>a.position-b.position||a.code.localeCompare(b.code)).map(w=><tr key={w.id}><td dir="ltr">{w.code}</td><td>{w.name}</td><td>{data.wbs.find(x=>x.id===w.parentId)?.code??"—"}</td>{writable&&<td><button className="ep-icon" type="button" aria-label={t.edit} onClick={()=>setWbs({id:w.id,code:w.code,name:w.name,parentId:w.parentId??"",position:w.position})}><Pencil size={15}/></button></td>}</tr>)}
        </tbody></table></div>}</div>
        {writable&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void save("saveWbs",{...wbs,parentId:nullable(wbs.parentId)});}}>
          <h3>{t.wbs} · {wbs.id?t.edit:t.save}</h3>
          <label>{t.code}<input required maxLength={50} value={wbs.code} onChange={e=>setWbs({...wbs,code:e.target.value})}/></label>
          <label>{t.name}<input required maxLength={150} value={wbs.name} onChange={e=>setWbs({...wbs,name:e.target.value})}/></label>
          <label>{t.parent}<select value={wbs.parentId} onChange={e=>setWbs({...wbs,parentId:e.target.value})}><option value="">{t.none}</option>{data.wbs.filter(x=>x.id!==wbs.id).map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></label>
          <label>{t.order}<input type="number" min={0} max={100000} value={wbs.position} onChange={e=>setWbs({...wbs,position:Number(e.target.value)})}/></label>
          <div className="ep-actions"><button className="button primary" type="submit" disabled={saving}><Plus size={14}/>{t.save}</button><button className="button secondary" type="button" onClick={()=>setWbs(blankWbs())}>{t.reset}</button></div>
        </form>}
      </div>}
      {tab==="activities"&&<div className="ep-grid">
        <div className="panel ep-card"><h3>{t.activities} ({data.activities.length})</h3>{data.activities.length===0?<p className="ep-muted">{t.empty}</p>:<div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.code}</th><th>{t.name}</th><th>WBS</th><th>{t.duration}</th><th>{t.start}</th><th>{t.finish}</th>{writable&&<th>{t.edit}</th>}</tr></thead><tbody>
          {data.activities.map(a=><tr key={a.id}><td dir="ltr">{a.code}</td><td>{a.name}</td><td>{data.wbs.find(w=>w.id===a.wbsId)?.code??"—"}</td><td>{a.durationDays}</td><td dir="ltr">{a.plannedStart??"—"}</td><td dir="ltr">{a.plannedFinish??"—"}</td>{writable&&<td><button type="button" className="ep-icon" aria-label={t.edit} onClick={()=>setActivity({id:a.id,code:a.code,name:a.name,type:a.type,wbsId:a.wbsId??"",taskId:a.taskId??"",calendarId:a.calendarId??"",durationDays:a.durationDays,plannedStart:a.plannedStart??"",plannedFinish:a.plannedFinish??""})}><Pencil size={15}/></button></td>}</tr>)}
        </tbody></table></div>}</div>
        {writable&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void save("saveActivity",{...activity,wbsId:nullable(activity.wbsId),taskId:nullable(activity.taskId),calendarId:nullable(activity.calendarId),plannedStart:nullable(activity.plannedStart),plannedFinish:nullable(activity.plannedFinish)});}}>
          <h3>{t.activities} · {activity.id?t.edit:t.save}</h3>
          <div className="ep-two"><label>{t.code}<input required value={activity.code} maxLength={50} onChange={e=>setActivity({...activity,code:e.target.value})}/></label><label>{t.name}<input required value={activity.name} maxLength={150} onChange={e=>setActivity({...activity,name:e.target.value})}/></label></div>
          <div className="ep-two"><label>{t.type}<select value={activity.type} onChange={e=>{const isMilestone=e.target.value==="milestone";setActivity({...activity,type:isMilestone?"milestone":"task",durationDays:isMilestone?0:Math.max(1,activity.durationDays)});}}><option value="task">{t.task}</option><option value="milestone">{t.milestone}</option></select></label><label>{t.duration}<input type="number" min={activity.type==="milestone"?0:1} max={36500} disabled={activity.type==="milestone"} value={activity.durationDays} onChange={e=>setActivity({...activity,durationDays:Number(e.target.value)})}/></label></div>
          <div className="ep-two"><label>WBS<select value={activity.wbsId} onChange={e=>setActivity({...activity,wbsId:e.target.value})}><option value="">{t.none}</option>{data.wbs.map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label><label>{t.calendar}<select value={activity.calendarId} onChange={e=>setActivity({...activity,calendarId:e.target.value})}><option value="">{t.none}</option>{data.calendars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
          <label>{t.linkedTask}<select value={activity.taskId} onChange={e=>setActivity({...activity,taskId:e.target.value})}><option value="">{t.none}</option>{tasks.filter(x=>!data.activities.some(a=>a.taskId===x.id&&a.id!==activity.id)).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
          <div className="ep-two"><label>{t.start}<input type="date" value={activity.plannedStart} onChange={e=>setActivity({...activity,plannedStart:e.target.value})}/></label><label>{t.finish}<input type="date" value={activity.plannedFinish} onChange={e=>setActivity({...activity,plannedFinish:e.target.value})}/></label></div>
          <div className="ep-actions"><button className="button primary" type="submit" disabled={saving}><Plus size={14}/>{t.save}</button><button className="button secondary" type="button" onClick={()=>setActivity(blankActivity())}>{t.reset}</button></div>
        </form>}
      </div>}
            {tab==="links"&&<div className="ep-grid">
        <div className="panel ep-card"><h3>{t.links} ({data.relationships.length})</h3>
          {data.relationships.length===0?<p className="ep-muted">{t.empty}</p>:<div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.parent}</th><th>{t.name}</th><th>{t.type}</th><th>Lag</th>{writable&&<th>{t.remove}</th>}</tr></thead><tbody>
          {data.relationships.map(r=><tr key={r.id}><td>{data.activities.find(a=>a.id===r.predecessorId)?.code??"—"}</td><td>{data.activities.find(a=>a.id===r.successorId)?.code??"—"}</td><td>{r.type}</td><td>{r.lagDays}</td>{writable&&<td><button type="button" className="ep-icon" aria-label={t.remove} onClick={()=>void removeRelationship(r.id)} disabled={saving}>{t.remove}</button></td>}</tr>)}
          </tbody></table></div>}
          <div className="ep-form">
            <label>{t.calendar}<select value={previewId} onChange={e=>setPreviewId(e.target.value)}><option value="">{t.none}</option>{data.calendars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <button type="button" className="button secondary" disabled={saving||!previewId} onClick={()=>void calculate()}>{t.preview}</button>
            {preview&&<><PreviewTimeline preview={preview} activities={data.activities} lang={lang}/><p><strong>{t.finishDate}:</strong> {preview.projectFinishDate??"—"}</p>
              <div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.name}</th><th>{t.start}</th><th>{t.finish}</th><th>{t.float}</th></tr></thead><tbody>
                {preview.activities.map(a=><tr key={a.id}><td>{data.activities.find(v=>v.id===a.id)?.name??a.id}{a.critical?" · "+t.critical:""}</td><td dir="ltr">{a.earlyStartDate}</td><td dir="ltr">{a.earlyFinishDate}</td><td>{a.totalFloatDays}</td></tr>)}
              </tbody></table></div>
            </>}
          </div>
        </div>
        {writable&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void save("saveRelationship",link);}}>
          <h3>{t.links}</h3>
          <label>{t.parent}<select required value={link.predecessorId} onChange={e=>setLink({...link,predecessorId:e.target.value})}><option value="">{t.none}</option>{data.activities.map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
          <label>{t.name}<select required value={link.successorId} onChange={e=>setLink({...link,successorId:e.target.value})}><option value="">{t.none}</option>{data.activities.filter(a=>a.id!==link.predecessorId).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
          <div className="ep-two"><label>{t.type}<select value={link.type} onChange={e=>setLink({...link,type:e.target.value as Relationship["type"]})}>{(["FS","SS","FF","SF"] as const).map(type=><option key={type}>{type}</option>)}</select></label>
          <label>Lag ({t.duration})<input type="number" min={-36500} max={36500} required value={link.lagDays} onChange={e=>setLink({...link,lagDays:Number(e.target.value)})}/></label></div>
          <button className="button primary" type="submit" disabled={saving}><Plus size={14}/>{t.save}</button>
        </form>}
      </div>}
      {tab==="control"&&<ProjectControls projectId={project.id} lang={lang} activities={data.activities} writable={writable}/>} 
      {tab==="calendars"&&<div className="ep-grid">
        <div className="panel ep-card"><h3>{t.calendars} ({data.calendars.length})</h3>{data.calendars.length===0?<p className="ep-muted">{t.empty}</p>:data.calendars.map(c=><div className="ep-calendar" key={c.id}><div><strong>{c.name}</strong><p>{c.timeZone} · {c.minutesPerDay} min</p><p>{c.workingDays.map(d=>t.week[d]).join("، ")}</p>{data.exceptions.filter(x=>x.calendarId===c.id).map(x=><p key={x.id}>{x.day}: {x.isWorking?t.working:t.nonworking} {x.note}</p>)}</div>{writable&&<button type="button" className="ep-icon" onClick={()=>setCalendar({id:c.id,name:c.name,timeZone:c.timeZone,workingDays:c.workingDays,minutesPerDay:c.minutesPerDay})} aria-label={t.edit}><Pencil size={15}/></button>}</div>)}</div>
        {writable&&<div className="ep-stack"><form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void save("saveCalendar",calendar);}}>
          <h3>{t.calendars} · {calendar.id?t.edit:t.save}</h3><label>{t.name}<input required value={calendar.name} onChange={e=>setCalendar({...calendar,name:e.target.value})}/></label>
          <label>{t.timeZone}<input required value={calendar.timeZone} onChange={e=>setCalendar({...calendar,timeZone:e.target.value})}/></label>
          <label>{t.minutes}<input type="number" min={1} max={1440} required value={calendar.minutesPerDay} onChange={e=>setCalendar({...calendar,minutesPerDay:Number(e.target.value)})}/></label>
          <fieldset><legend>{t.days}</legend><div className="ep-days">{t.week.map((label,i)=><label key={i}><input type="checkbox" checked={calendar.workingDays.includes(i)} onChange={e=>setCalendar({...calendar,workingDays:e.target.checked?[...calendar.workingDays,i].sort():calendar.workingDays.filter(d=>d!==i)})}/>{label}</label>)}</div></fieldset>
          <div className="ep-actions"><button type="submit" className="button primary" disabled={saving}><Plus size={14}/>{t.save}</button><button type="button" className="button secondary" onClick={()=>setCalendar(blankCalendar())}>{t.reset}</button></div>
        </form>
        {data.calendars.length>0&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();if(exception.calendarId)void save("saveException",{day:exception.day,isWorking:exception.isWorking,note:exception.note},exception.calendarId);}}>
          <h3>{t.exception}</h3><label>{t.calendar}<select required value={exception.calendarId} onChange={e=>setException({...exception,calendarId:e.target.value})}><option value="">{t.none}</option>{data.calendars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>{t.date}<input type="date" required value={exception.day} onChange={e=>setException({...exception,day:e.target.value})}/></label>
          <label>{t.type}<select value={exception.isWorking?"work":"off"} onChange={e=>setException({...exception,isWorking:e.target.value==="work"})}><option value="off">{t.nonworking}</option><option value="work">{t.working}</option></select></label>
          <label>{t.note}<input maxLength={500} value={exception.note} onChange={e=>setException({...exception,note:e.target.value})}/></label>
          <button className="button primary" type="submit" disabled={saving}>{t.addException}</button>
        </form>}</div>}
      </div>}
    </>}
  </section>;
}
