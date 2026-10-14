"use client";
import {useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Hammer,Clock3,UserCheck,Users,AlertTriangle,Search} from "lucide-react";
import {request,type Workspace} from "./api";
import type {Language} from "./i18n";
import "./site-dispatch.css";
type Worker={userId:string;name:string;jobTitle:string;department:string;busy:boolean;activeJobs:number;queuedJobs:number;expectedAvailableAt:string|null;etaUnknown:boolean;overdue:boolean;currentJobs:{taskId:string|null;title:string;expectedEndAt:string|null}[]};
const L={
 ar:{title:"توزيع مهام الموقع",intro:"اعرف المتاح والمشغول حسب المسمى الوظيفي في HR. الحالة تشمل المهام النشطة المسندة للموظف حتى لو كانت في مشروع آخر.",project:"المشروع",trade:"الوظيفة / التخصص",all:"كل التخصصات",search:"ابحث باسم الموظف",status:"الحالة",any:"الكل",free:"متاح",busy:"مشغول",workers:"الموظفون",assign:"إسناد مهمة",until:"الانتهاء المتوقع",remaining:"متبقي تقريبًا",late:"تجاوز الموعد المتوقع؛ يظل مشغولًا حتى إنهاء المهمة",unknown:"موعد الانتهاء غير محدد",other:"مهمة في مشروع آخر",queued:"مهام منتظرة",noWorkers:"لا يوجد موظفون مطابقون للفلتر",noProject:"لا توجد مشاريع يحق لك إدارة فريقها",disclaimer:"توافر الموظف يعتمد على المهام النشطة المسجلة في سنع؛ لا يتضمن الإجازات أو الأعمال خارج النظام.",active:"مهمة نشطة"},
 en:{title:"Site Dispatch",intro:"See worker availability by HR job title. Active jobs from other projects also count as busy.",project:"Project",trade:"Trade / job title",all:"All trades",search:"Search people",status:"Availability",any:"All",free:"Available",busy:"Busy",workers:"Workers",assign:"Assign job",until:"Expected finish",remaining:"Estimated remaining",late:"Past estimated finish; busy until task completion",unknown:"No estimated finish",other:"Other assignment",queued:"Queued tasks",noWorkers:"No matching workers",noProject:"No projects you can manage",disclaimer:"Availability reflects active tasks recorded in Sanaa; external assignments and leave are not included.",active:"Active job"},
} as const;
function remaining(iso:string,now:number,ar:boolean){
 const min=Math.ceil((Date.parse(iso)-now)/60000);
 if(min<=0)return ar?"المدة تجاوزت التقدير":"Past estimate";
 const hours=Math.floor(min/60),mins=min%60;
 return ar?`${hours?" "+hours+" س":""}${mins?" "+mins+" د":""}`:`${hours?hours+"h ":""}${mins?mins+"m":""}`;
}
export function SiteDispatch({data,lang,onAssign,onOpenTask}:{data:Workspace;lang:Language;onAssign:(projectId:string,userId:string)=>void;onOpenTask:(id:string)=>void}){
 const t=L[lang],ar=lang==="ar";
 const projects=data.projects.filter(p=>p.canManage&&!p.archivedAt);
 const [selected,setSelected]=useState(projects[0]?.id??"");
 const [trade,setTrade]=useState("all"),[filter,setFilter]=useState("all"),[search,setSearch]=useState("");
 const projectId=projects.some(p=>p.id===selected)?selected:projects[0]?.id??"";
 const query=useQuery({queryKey:["site-dispatch",projectId],queryFn:()=>request<{workers:Worker[]}>(`/api/site-dispatch?projectId=${encodeURIComponent(projectId)}`),enabled:!!projectId,refetchInterval:30000,retry:false});
 const workers=query.data?.workers??[],now=Date.now();
 const trades=useMemo(()=>[...new Set(workers.map(x=>x.jobTitle))].sort((a,b)=>a.localeCompare(b)),[workers]);
 const displayed=workers.filter(w=>(trade==="all"||w.jobTitle===trade)&&(filter==="all"||(filter==="busy"?w.busy:!w.busy))&&(`${w.name} ${w.jobTitle} ${w.department}`).toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b)=>Number(a.busy)-Number(b.busy)||a.name.localeCompare(b.name));
 return <section className="site-dispatch">
 <header className="site-heading"><Hammer size={22}/><div><h2>{t.title}</h2><p>{t.intro}</p></div></header>
 {!projects.length?<p className="panel site-empty">{t.noProject}</p>:<>
 <div className="site-filters panel">
 <label>{t.project}<select value={projectId} onChange={e=>{setSelected(e.target.value);setTrade("all");}}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>{t.trade}<select value={trade} onChange={e=>setTrade(e.target.value)}><option value="all">{t.all}</option>{trades.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
 <label>{t.status}<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t.any}</option><option value="free">{t.free}</option><option value="busy">{t.busy}</option></select></label>
 <label>{t.search}<span className="site-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search}/></span></label>
 </div>
 <div className="site-summary">
  <div className="panel"><Users size={17}/><strong>{workers.length}</strong><span>{t.workers}</span></div>
  <div className="panel"><UserCheck size={17}/><strong>{workers.filter(w=>!w.busy).length}</strong><span>{t.free}</span></div>
  <div className="panel"><Clock3 size={17}/><strong>{workers.filter(w=>w.busy).length}</strong><span>{t.busy}</span></div>
 </div>
 {query.isPending?<p className="panel site-empty">…</p>:query.isError?<p role="alert" className="panel site-empty">{String(query.error)}</p>:
 displayed.length===0?<p className="panel site-empty">{t.noWorkers}</p>:<div className="site-cards">{displayed.map(w=><article className="panel site-worker" key={w.userId}>
   <div className="site-worker-head"><div><strong>{w.name}</strong><p>{w.jobTitle}{w.department?" · "+w.department:""}</p></div><span className={w.busy?"site-state busy":"site-state free"}>{w.busy?t.busy:t.free}</span></div>
   {w.busy&&<div className="site-occupied">
     {w.currentJobs.map((task,index)=><div key={task.taskId??String(index)}>
       {task.taskId?<button className="site-link" type="button" onClick={()=>onOpenTask(task.taskId!)}>{task.title}</button>:<span>{t.other}</span>}
       {task.expectedEndAt&&<p>{t.until}: {new Intl.DateTimeFormat(ar?"ar-EG":"en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(task.expectedEndAt))}</p>}
     </div>)}
     {w.etaUnknown?<p><AlertTriangle size={14}/>{t.unknown}</p>:w.expectedAvailableAt&&<p><Clock3 size={14}/>{t.remaining}: {remaining(w.expectedAvailableAt,now,ar)}</p>}
     {w.overdue&&<p className="site-late"><AlertTriangle size={14}/>{t.late}</p>}
   </div>}
   {w.queuedJobs>0&&<p className="site-queued">{t.queued}: {w.queuedJobs}</p>}
   <button type="button" className="button primary" disabled={w.busy} onClick={()=>onAssign(projectId,w.userId)}>{t.assign}</button>
 </article>)}</div>}
 <p className="site-footnote">{t.disclaimer}</p>
 </>}
 </section>;
}
