"use client";
import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {request} from "./api";
import type {Language} from "./i18n";
import "./planning-view.css";

type Status="pending"|"approved"|"rejected";
type Change={id:string;title:string;description:string;kind:"scope"|"schedule"|"budget"|"resource";impactDays:number;impactMinor:number;currency:string;status:Status;requestedBy:string;reviewedBy:string|null;decisionNote:string;createdAt:string};
type Review={id:string;baselineId:string;status:Status;requestedBy:string;reviewedBy:string|null;decisionNote:string;createdAt:string};
type ApprovalData={changes:Change[];baselines:Review[];canReview:boolean;currentUserId:string};
type Baseline={id:string;label:string;createdBy:string;createdAt:string};
const labels={
 ar:{title:"الموافقات وطلبات التغيير",intro:"الاعتماد يثبت القرار فقط؛ لا يغيّر الخطة أو التكاليف آليًا.",requests:"طلبات التغيير",submit:"إرسال طلب تغيير",kind:"النوع",scope:"نطاق العمل",schedule:"الجدول الزمني",budget:"الميزانية",resource:"الموارد",titleLabel:"عنوان الطلب",description:"وصف التغيير المقترح",days:"التأثير على الأيام (+/-)",impact:"التأثير المالي بأصغر وحدة نقدية (+/-)",currency:"العملة",review:"مراجعة الطلب",approve:"موافقة",reject:"رفض",reason:"ملاحظة القرار (سبب الرفض إلزامي)",pending:"بانتظار المراجعة",approved:"موافق عليه",rejected:"مرفوض",baseline:"اعتماد خط الأساس",requestBaseline:"طلب اعتماد",author:"مقدم الطلب",empty:"لا توجد طلبات حتى الآن",none:"بدون",readonly:"يمكن لمدير المشروع ومالكه فقط استخدام هذه الصفحة.",mine:"لا يمكنك مراجعة طلبك بنفسك",reviewed:"تم تسجيل القرار"},
 en:{title:"Approvals & change requests",intro:"An approval records a decision only; it does not automatically change the plan or budget.",requests:"Change requests",submit:"Submit change request",kind:"Type",scope:"Scope",schedule:"Schedule",budget:"Budget",resource:"Resources",titleLabel:"Request title",description:"Proposed change",days:"Schedule impact in days (+/-)",impact:"Cost impact in minor currency units (+/-)",currency:"Currency",review:"Review request",approve:"Approve",reject:"Reject",reason:"Review note (required for rejection)",pending:"Pending",approved:"Approved",rejected:"Rejected",baseline:"Baseline approval",requestBaseline:"Request approval",author:"Requested by",empty:"No requests yet",none:"None",readonly:"Only project owners and managers may access this view.",mine:"You cannot review your own request",reviewed:"Review decision recorded"},
} as const;
const msg=(e:unknown)=>e instanceof Error?e.message:"Request failed";

export function ProjectApprovals({projectId,lang,writable}:{projectId:string;lang:Language;writable:boolean}){
 const t=labels[lang],client=useQueryClient();
 const key=["planning-approvals",projectId],controlsKey=["planning-controls",projectId];
 const query=useQuery({queryKey:key,queryFn:()=>request<ApprovalData>(`/api/planning/approvals?projectId=${encodeURIComponent(projectId)}`),retry:false});
 const controls=useQuery({queryKey:controlsKey,queryFn:()=>request<{baselines:Baseline[]}>(`/api/planning/controls?projectId=${encodeURIComponent(projectId)}`),retry:false});
 const [kind,setKind]=useState<Change["kind"]>("schedule"),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[days,setDays]=useState(0),[impact,setImpact]=useState(0),[currency,setCurrency]=useState("SAR");
 const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function post(body:object){
  setBusy(true);setError("");setSuccess("");
  try{
   await request("/api/planning/approvals",{method:"POST",body:JSON.stringify({projectId,...body})});
   await client.invalidateQueries({queryKey:key});
   await client.invalidateQueries({queryKey:controlsKey});
   setSuccess(t.reviewed);setNote("");
   if("action" in body&&body.action==="submitChange"){setTitle("");setDescription("");setDays(0);setImpact(0);}
  }catch(e){setError(msg(e));}finally{setBusy(false);}
 }
 const d=query.data;
 return <section className="ep-grid" aria-label={t.title}>
  <div className="panel ep-card"><h3>{t.requests}</h3><p className="ep-muted">{t.intro}</p>
    {query.isPending?<p>…</p>:query.isError?<p role="alert" className="ep-error">{msg(query.error)}</p>:d&&<>
    {d.changes.length===0?<p className="ep-muted">{t.empty}</p>:d.changes.map(c=><article className="ep-approval-item" key={c.id}>
     <div className="ep-approval-head"><strong>{c.title}</strong><span>{t[c.status]}</span></div>
     <p className="ep-muted">{t[c.kind]} · {c.description}</p>
     <p className="ep-muted">{t.days}: {c.impactDays} · {t.currency}: {c.impactMinor} {c.currency}</p>
     {c.status!=="pending"?<p className="ep-muted">{c.decisionNote||t.reviewed}</p>:d.canReview&&writable&&c.requestedBy!==d.currentUserId&&<div className="ep-form">
       <label>{t.reason}<input maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
       <div className="ep-actions"><button type="button" disabled={busy} className="button primary" onClick={()=>void post({action:"reviewChange",changeId:c.id,data:{status:"approved",note}})}>{t.approve}</button>
       <button type="button" disabled={busy||note.trim().length<3} className="button secondary" onClick={()=>void post({action:"reviewChange",changeId:c.id,data:{status:"rejected",note}})}>{t.reject}</button></div>
     </div>}
    </article>)}
    <h3>{t.baseline}</h3>
    {(controls.data?.baselines??[]).map(b=>{
      const review=d.baselines.find(x=>x.baselineId===b.id);
      return <div key={b.id} className="ep-approval-item"><div className="ep-approval-head"><strong>{b.label}</strong><span>{review?t[review.status]:t.none}</span></div>
      {!review&&writable&&<button type="button" className="button secondary" disabled={busy} onClick={()=>void post({action:"requestBaseline",baselineId:b.id})}>{t.requestBaseline}</button>}
      {review?.status==="pending"&&d.canReview&&writable&&review.requestedBy!==d.currentUserId&&b.createdBy!==d.currentUserId&&<div className="ep-form"><label>{t.reason}<input maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label><div className="ep-actions">
       <button type="button" className="button primary" disabled={busy} onClick={()=>void post({action:"reviewBaseline",reviewId:review.id,data:{status:"approved",note}})}>{t.approve}</button>
       <button type="button" className="button secondary" disabled={busy||note.trim().length<3} onClick={()=>void post({action:"reviewBaseline",reviewId:review.id,data:{status:"rejected",note}})}>{t.reject}</button>
      </div></div>}</div>;
    })}
    </>}
  </div>
  <div className="ep-stack">{writable&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void post({action:"submitChange",data:{kind,title,description,impactDays:days,impactMinor:impact,currency}});}}>
   <h3>{t.submit}</h3>
   <label>{t.kind}<select value={kind} onChange={e=>setKind(e.target.value as Change["kind"])}>{(["scope","schedule","budget","resource"] as const).map(v=><option value={v} key={v}>{t[v]}</option>)}</select></label>
   <label>{t.titleLabel}<input required minLength={3} maxLength={150} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label>{t.description}<textarea required minLength={10} maxLength={4000} rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label>
   <div className="ep-two"><label>{t.days}<input type="number" min={-36500} max={36500} value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
   <label>{t.impact}<input type="number" min={-2147483647} max={2147483647} value={impact} onChange={e=>setImpact(Number(e.target.value))}/></label></div>
   <label>{t.currency}<input value={currency} pattern="[A-Z]{3}" required maxLength={3} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></label>
   <button className="button primary" type="submit" disabled={busy}>{t.submit}</button>
  </form>}
  {error&&<p role="alert" className="ep-error">{error}</p>}{success&&<p role="status" className="ep-muted">{success}</p>}
  </div>
 </section>;
}
