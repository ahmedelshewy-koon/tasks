"use client";
import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {request} from "./api";
import type {Language} from "./i18n";
import "./planning-view.css";
import {checkScheduleQuality,type QualityInput} from "../modules/planning/quality";
type Activity={id:string;code:string;name:string;plannedStart:string|null;plannedFinish:string|null;durationDays:number};
type Baseline={id:string;label:string;createdAt:string;snapshot:{schemaVersion:number;activities:Activity[]}};
type Progress={activityId:string;percentComplete:number;actualStart:string|null;actualFinish:string|null;remainingDays:number;note:string};
type Snapshot={baselines:Baseline[];progress:Progress[]};
type Draft={activityId:string;percentComplete:number;actualStart:string;actualFinish:string;remainingDays:number;note:string};
const blank=(id:string,duration=0):Draft=>({activityId:id,percentComplete:0,actualStart:"",actualFinish:"",remainingDays:duration,note:""});
const words={
  ar:{title:"خط الأساس والتقدم", baseline:"خطوط الأساس المعتمدة",capture:"حفظ خط أساس",label:"اسم خط الأساس",history:"مقارنة الخطة بالتنفيذ",name:"النشاط",planned:"النهاية الأصلية",current:"النهاية الحالية",start:"البداية الفعلية",finish:"النهاية الفعلية",percent:"الإنجاز %",remaining:"الأيام المتبقية",note:"ملاحظة",save:"حفظ التقدم",select:"اختر",empty:"لم يتم تسجيل خط أساس بعد.",readonly:"الاطلاع متاح؛ التعديل لمدير المشروع فقط.",help:"الخطوط المعتمدة ثابتة، وتسجيل التقدم لا يغيّر حالة مهام Tasks."},
  en:{title:"Baselines & progress",baseline:"Approved baselines",capture:"Capture baseline",label:"Baseline label",history:"Original vs current plan",name:"Activity",planned:"Baseline finish",current:"Current finish",start:"Actual start",finish:"Actual finish",percent:"Complete %",remaining:"Remaining days",note:"Note",save:"Save progress",select:"Select",empty:"No baselines captured yet.",readonly:"Read-only; only managers may edit.",help:"Baselines are immutable. Actual progress does not change Tasks completion."}
};
export function ProjectControls({projectId,activities,lang,writable,planning}:{projectId:string;activities:Activity[];lang:Language;writable:boolean;planning:QualityInput}){
  const t=words[lang],client=useQueryClient();
  const [label,setLabel]=useState("Baseline 1"),[selected,setSelected]=useState(""),[draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const key=["planning-controls",projectId];
  const query=useQuery({queryKey:key,queryFn:()=>request<Snapshot>(`/api/planning/controls?projectId=${encodeURIComponent(projectId)}`),retry:false});
  const data=query.data;
  const issues=checkScheduleQuality({...planning,baselinesCount:data?.baselines.length??0});
  const chosen=data?.baselines.find(x=>x.id===selected)||data?.baselines[0];
  async function submit(payload:object){
    setBusy(true);setError("");
    try{await request("/api/planning/controls",{method:"POST",body:JSON.stringify({...payload,projectId})});await client.invalidateQueries({queryKey:key});setDraft(null);}
    catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
  }
  return <div className="ep-grid"><div className="panel ep-card">
    <h3>{t.baseline}</h3><p className="ep-muted">{t.help}</p>
    {query.isPending?<p className="ep-muted">…</p>:query.isError?<p role="alert" className="ep-error">{String(query.error)}</p>:data&&<>
    {!data.baselines.length?<p className="ep-muted">{t.empty}</p>:<>
    <label className="ep-control-label">{t.baseline}<select value={chosen?.id??""} onChange={e=>setSelected(e.target.value)}>{data.baselines.map(b=><option key={b.id} value={b.id}>{b.label} · {new Date(b.createdAt).toLocaleDateString(lang==="ar"?"ar-EG":"en-GB")}</option>)}</select></label>
    <h3>{t.history}</h3><div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.name}</th><th>{t.planned}</th><th>{t.current}</th><th>{t.percent}</th></tr></thead><tbody>
      {activities.map(a=>{const original=chosen?.snapshot.activities.find(x=>x.id===a.id);const p=data.progress.find(x=>x.activityId===a.id);return <tr key={a.id}><td>{a.code} · {a.name}</td><td dir="ltr">{original?.plannedFinish??"—"}</td><td dir="ltr">{a.plannedFinish??"—"}</td><td>{p?.percentComplete??0}%</td></tr>;})}
    </tbody></table></div></>}
    </>}
    {data&&<><h3>{lang==="ar"?"جودة الجدول الزمني":"Schedule quality checks"} ({issues.length})</h3>
     <div className="ep-stack">{issues.map((issue,i)=><p className={issue.kind==="error"?"ep-error":"ep-muted"} key={issue.code+"-"+i}>{issue.kind==="error"?"!":"•"} {issue.code}: {issue.message}</p>)}</div></>}
  </div><div className="ep-stack">{writable&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void submit({action:"captureBaseline",label});}}>
    <h3>{t.capture}</h3><label>{t.label}<input required maxLength={100} value={label} onChange={e=>setLabel(e.target.value)}/></label><button className="button primary" type="submit" disabled={busy||!activities.length}>{t.capture}</button></form>}
    {writable&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();if(!draft)return;void submit({action:"updateProgress",data:{...draft,actualStart:draft.actualStart||null,actualFinish:draft.actualFinish||null}});}}>
      <h3>{t.save}</h3>
      <label>{t.name}<select value={draft?.activityId??""} onChange={e=>{const a=activities.find(x=>x.id===e.target.value);const p=data?.progress.find(x=>x.activityId===e.target.value);setDraft(a?{activityId:a.id,percentComplete:p?.percentComplete??0,actualStart:p?.actualStart??"",actualFinish:p?.actualFinish??"",remainingDays:p?.remainingDays??a.durationDays,note:p?.note??""}:null);}}><option value="">{t.select}</option>{activities.map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
      {draft&&<>
      <label>{t.percent}<input type="number" min={0} max={100} value={draft.percentComplete} onChange={e=>setDraft({...draft,percentComplete:Number(e.target.value)})}/></label>
      <div className="ep-two"><label>{t.start}<input type="date" value={draft.actualStart} onChange={e=>setDraft({...draft,actualStart:e.target.value})}/></label><label>{t.finish}<input type="date" value={draft.actualFinish} onChange={e=>setDraft({...draft,actualFinish:e.target.value})}/></label></div>
      <label>{t.remaining}<input type="number" min={0} max={36500} value={draft.remainingDays} onChange={e=>setDraft({...draft,remainingDays:Number(e.target.value)})}/></label>
      <label>{t.note}<input maxLength={2000} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
      <button type="submit" className="button primary" disabled={busy}>{t.save}</button></>}
      </form>}
    {!writable&&<p className="ep-muted">{t.readonly}</p>}{error&&<p role="alert" className="ep-error">{error}</p>}
  </div></div>;
}
