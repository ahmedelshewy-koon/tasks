"use client";
import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {request} from "./api";
import type {Language} from "./i18n";
import {calculateEarnedValue} from "../modules/planning/metrics";
import "./planning-view.css";
type Resource={id:string;name:string;kind:"labor"|"equipment"|"material";hrUserId:string|null;capacityHoursWeek:number;rateMinor:number;currency:string};
type Assignment={id:string;activityId:string;resourceId:string;plannedHours:number;allocationPercent:number};
type Cost={id:string;name:string;activityId:string|null;currency:string;budgetMinor:number;actualMinor:number};
type Risk={id:string;title:string;probability:number;impact:number;status:"open"|"mitigating"|"closed";response:string};
type Activity={id:string;code:string;name:string;plannedStart:string|null;plannedFinish:string|null};
type Progress={activityId:string;percentComplete:number};
type Baseline={snapshot:{activities:Activity[]};label:string;id:string};
type Data={resources:Resource[];assignments:Assignment[];costs:Cost[];risks:Risk[];progress:Progress[];baselines:Baseline[];activities:Activity[];financeAllowed:boolean};
const words={
 ar:{resources:"الموارد",costs:"الميزانية والتكاليف",risks:"المخاطر",assignments:"توزيع الموارد",save:"حفظ",name:"الاسم",kind:"النوع",labor:"موظف",equipment:"معدة",material:"مادة",hr:"معرف الموظف في HR (اختياري)",capacity:"الساعات المتاحة أسبوعيًا",rate:"سعر الساعة بأصغر وحدة نقدية",currency:"العملة",resource:"المورد",activity:"النشاط",hours:"الساعات المخططة",percent:"نسبة التخصيص",budget:"الميزانية",actual:"التكلفة الفعلية",risk:"الخطر",impact:"التأثير",probability:"الاحتمالية",response:"خطة الاستجابة",status:"الحالة",open:"مفتوح",mitigating:"تحت المعالجة",closed:"مغلق",none:"بدون",edit:"تعديل",evm:"مؤشرات القيمة المكتسبة",nodata:"لا توجد بيانات.",manual:"القيم المالية تُسجّل يدويًا، ولا يتم سحبها من ERP تلقائيًا.",limitation:"PV وSPI يتطلبان خط أساس محددًا بتواريخ صحيحة. لا يتم جمع العملات المختلفة.",plannedDate:"تاريخ التقييم",selectedBaseline:"خط الأساس",missing:"غير متاح",readonly:"عرض فقط — التعديل لمدير المشروع."},
 en:{resources:"Resources",costs:"Budget & costs",risks:"Risks",assignments:"Resource assignments",save:"Save",name:"Name",kind:"Kind",labor:"Labor",equipment:"Equipment",material:"Material",hr:"HR employee reference (optional)",capacity:"Available hours/week",rate:"Hourly rate in minor currency units",currency:"Currency",resource:"Resource",activity:"Activity",hours:"Planned hours",percent:"Allocation percent",budget:"Budget",actual:"Actual cost",risk:"Risk",impact:"Impact",probability:"Probability",response:"Mitigation",status:"Status",open:"Open",mitigating:"Mitigating",closed:"Closed",none:"None",edit:"Edit",evm:"Earned value metrics",nodata:"No records yet.",manual:"Costs are manually entered; there is no automatic ERP sync.",limitation:"PV and SPI require a dated baseline. Different currencies are never added together.",plannedDate:"Data date",selectedBaseline:"Baseline",missing:"N/A",readonly:"Read only — editing is for managers."},
};
const money=(minor:number,currency:string,lang:Language)=>new Intl.NumberFormat(lang==="ar"?"ar-EG":"en-GB",{minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100)+" "+currency;
export function ProjectEnterprise({projectId,lang,writable,tab}:{projectId:string;lang:Language;writable:boolean;tab:"resources"|"costs"|"risks"}){
 const t=words[lang],client=useQueryClient(),key=["planning-enterprise",projectId];
 const query=useQuery({queryKey:key,queryFn:()=>request<Data>(`/api/planning/enterprise?projectId=${encodeURIComponent(projectId)}`),retry:false});
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [resource,setResource]=useState({id:"",name:"",kind:"labor" as Resource["kind"],hrUserId:"",capacityHoursWeek:40,rateMinor:0,currency:"SAR"});
 const [assign,setAssign]=useState({activityId:"",resourceId:"",plannedHours:8,allocationPercent:100});
 const [cost,setCost]=useState({id:"",name:"",activityId:"",currency:"SAR",budgetMinor:0,actualMinor:0});
 const [risk,setRisk]=useState({id:"",title:"",probability:3,impact:3,status:"open" as Risk["status"],response:""});
 const [currency,setCurrency]=useState("SAR"),[baselineId,setBaselineId]=useState(""),[date,setDate]=useState(new Date().toISOString().slice(0,10));
 async function save(action:string,data:object){
  setError("");setBusy(true);
  try{await request("/api/planning/enterprise",{method:"POST",body:JSON.stringify({projectId,action,data})});await client.invalidateQueries({queryKey:key});
    if(action==="saveResource")setResource({id:"",name:"",kind:"labor",hrUserId:"",capacityHoursWeek:40,rateMinor:0,currency:"SAR"});
    if(action==="saveCost")setCost({id:"",name:"",activityId:"",currency:"SAR",budgetMinor:0,actualMinor:0});
    if(action==="saveRisk")setRisk({id:"",title:"",probability:3,impact:3,status:"open",response:""});
  }catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
 }
 const d=query.data, baseline=d?.baselines.find(b=>b.id===baselineId)??d?.baselines[0];
 const currencies=[...new Set(d?.costs.map(c=>c.currency)??[])];
 const picked=currencies.includes(currency)?currency:currencies[0]??currency;
 const earned=d?calculateEarnedValue({costs:d.costs,progress:d.progress,currency:picked,dataDate:date,baseline:baseline?.snapshot.activities}):null;
 return <div className="ep-grid">
 <div className="panel ep-card">
   {query.isPending?<p>…</p>:query.isError?<p className="ep-error" role="alert">{String(query.error)}</p>:d&&<>
   {tab==="resources"&&<><h3>{t.resources} ({d.resources.length})</h3>
    <div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.name}</th><th>{t.kind}</th><th>{t.capacity}</th><th>{t.rate}</th></tr></thead><tbody>
      {d.resources.map(x=><tr key={x.id} onClick={()=>writable&&setResource({id:x.id,name:x.name,kind:x.kind,hrUserId:x.hrUserId??"",capacityHoursWeek:x.capacityHoursWeek,rateMinor:x.rateMinor,currency:x.currency})}><td>{x.name}</td><td>{t[x.kind]}</td><td>{x.capacityHoursWeek}</td><td>{money(x.rateMinor,x.currency,lang)}</td></tr>)}
    </tbody></table></div><h3>{t.assignments}</h3><div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.resource}</th><th>{t.activity}</th><th>{t.hours}</th><th>{t.percent}</th></tr></thead><tbody>
      {d.assignments.map(a=><tr key={a.id}><td>{d.resources.find(x=>x.id===a.resourceId)?.name}</td><td>{d.activities.find(x=>x.id===a.activityId)?.name}</td><td>{a.plannedHours}</td><td>{a.allocationPercent}%</td></tr>)}
    </tbody></table></div></>}
   {tab==="costs"&&<><h3>{t.costs}</h3>{!d.financeAllowed?<p className="ep-error">{lang==="ar"?"التكاليف متاحة فقط لمالك المشروع ومديره.":"Financial details are restricted to project owners and managers."}</p>:<><p className="ep-muted">{t.manual}</p>
    <div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.name}</th><th>{t.budget}</th><th>{t.actual}</th></tr></thead><tbody>
      {d.costs.map(c=><tr key={c.id} onClick={()=>writable&&setCost({id:c.id,name:c.name,activityId:c.activityId??"",currency:c.currency,budgetMinor:c.budgetMinor,actualMinor:c.actualMinor})}><td>{c.name}</td><td>{money(c.budgetMinor,c.currency,lang)}</td><td>{money(c.actualMinor,c.currency,lang)}</td></tr>)}
    </tbody></table></div>
    <h3>{t.evm}</h3>
    <div className="ep-two">
      <label className="ep-control-label">{t.currency}<select value={picked} onChange={e=>setCurrency(e.target.value)}>{(currencies.length?currencies:["SAR"]).map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="ep-control-label">{t.plannedDate}<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label className="ep-control-label">{t.selectedBaseline}<select value={baseline?.id??""} onChange={e=>setBaselineId(e.target.value)}><option value="">{t.none}</option>{d.baselines.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
    </div>
    <div className="ep-metric-grid">{earned&&(["BAC","AC","EV","PV","CPI","SPI","CV","SV"] as const).map(key=><div className="ep-metric" key={key}><strong>{key}</strong><span>{earned[key]===null?t.missing:["CPI","SPI"].includes(key)?Number(earned[key]).toFixed(2):money(Number(earned[key]),picked,lang)}</span></div>)}</div>
    <p className="ep-muted">{t.limitation}</p></>}
   </>}
   {tab==="risks"&&<><h3>{t.risks} ({d.risks.length})</h3>
    <div className="ep-scroll"><table className="ep-table"><thead><tr><th>{t.risk}</th><th>{t.probability}</th><th>{t.impact}</th><th>{t.status}</th></tr></thead><tbody>
      {d.risks.map(r=><tr key={r.id} onClick={()=>writable&&setRisk({...r})}><td>{r.title}</td><td>{r.probability}</td><td>{r.impact}</td><td>{t[r.status]}</td></tr>)}
    </tbody></table></div></>}
   </>}
 </div>
 <div className="ep-stack">
   {writable&&tab==="resources"&&<>
   <form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void save("saveResource",{...resource,id:resource.id||undefined,hrUserId:resource.hrUserId||null});}}>
     <h3>{t.resources}</h3><label>{t.name}<input required maxLength={150} value={resource.name} onChange={e=>setResource({...resource,name:e.target.value})}/></label>
     <label>{t.kind}<select value={resource.kind} onChange={e=>setResource({...resource,kind:e.target.value as Resource["kind"]})}>{(["labor","equipment","material"] as const).map(x=><option key={x} value={x}>{t[x]}</option>)}</select></label>
     <label>{t.hr}<input value={resource.hrUserId} maxLength={100} onChange={e=>setResource({...resource,hrUserId:e.target.value})}/></label>
     <div className="ep-two"><label>{t.capacity}<input type="number" min={0} max={168} value={resource.capacityHoursWeek} onChange={e=>setResource({...resource,capacityHoursWeek:Number(e.target.value)})}/></label>
     <label>{t.currency}<input required maxLength={3} value={resource.currency} onChange={e=>setResource({...resource,currency:e.target.value.toUpperCase()})}/></label></div>
     <label>{t.rate}<input type="number" min={0} max={2147483647} value={resource.rateMinor} onChange={e=>setResource({...resource,rateMinor:Number(e.target.value)})}/></label>
     <button className="button primary" disabled={busy}>{t.save}</button>
   </form>
   <form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void save("saveAssignment",assign);}}>
     <h3>{t.assignments}</h3><label>{t.resource}<select required value={assign.resourceId} onChange={e=>setAssign({...assign,resourceId:e.target.value})}><option value="">{t.none}</option>{d?.resources.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
     <label>{t.activity}<select required value={assign.activityId} onChange={e=>setAssign({...assign,activityId:e.target.value})}><option value="">{t.none}</option>{d?.activities.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
     <div className="ep-two"><label>{t.hours}<input type="number" min={0} max={1000000} value={assign.plannedHours} onChange={e=>setAssign({...assign,plannedHours:Number(e.target.value)})}/></label><label>{t.percent}<input type="number" min={0} max={200} value={assign.allocationPercent} onChange={e=>setAssign({...assign,allocationPercent:Number(e.target.value)})}/></label></div>
     <button className="button primary" disabled={busy}>{t.save}</button>
   </form></>}
   {writable&&tab==="costs"&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void save("saveCost",{...cost,id:cost.id||undefined,activityId:cost.activityId||null});}}>
     <h3>{t.costs}</h3><label>{t.name}<input required maxLength={150} value={cost.name} onChange={e=>setCost({...cost,name:e.target.value})}/></label>
     <label>{t.activity}<select value={cost.activityId} onChange={e=>setCost({...cost,activityId:e.target.value})}><option value="">{t.none}</option>{d?.activities.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
     <label>{t.currency}<input required maxLength={3} value={cost.currency} onChange={e=>setCost({...cost,currency:e.target.value.toUpperCase()})}/></label>
     <div className="ep-two"><label>{t.budget}<input type="number" min={0} max={2147483647} value={cost.budgetMinor} onChange={e=>setCost({...cost,budgetMinor:Number(e.target.value)})}/></label>
     <label>{t.actual}<input type="number" min={0} max={2147483647} value={cost.actualMinor} onChange={e=>setCost({...cost,actualMinor:Number(e.target.value)})}/></label></div>
     <button className="button primary" disabled={busy}>{t.save}</button>
   </form>}
   {writable&&tab==="risks"&&<form className="panel ep-card ep-form" onSubmit={e=>{e.preventDefault();void save("saveRisk",{...risk,id:risk.id||undefined});}}>
     <h3>{t.risks}</h3><label>{t.risk}<input required maxLength={150} value={risk.title} onChange={e=>setRisk({...risk,title:e.target.value})}/></label>
     <div className="ep-two"><label>{t.probability}<input type="number" min={1} max={5} value={risk.probability} onChange={e=>setRisk({...risk,probability:Number(e.target.value)})}/></label><label>{t.impact}<input type="number" min={1} max={5} value={risk.impact} onChange={e=>setRisk({...risk,impact:Number(e.target.value)})}/></label></div>
     <label>{t.status}<select value={risk.status} onChange={e=>setRisk({...risk,status:e.target.value as Risk["status"]})}>{(["open","mitigating","closed"] as const).map(s=><option key={s} value={s}>{t[s]}</option>)}</select></label>
     <label>{t.response}<textarea maxLength={2000} rows={3} value={risk.response} onChange={e=>setRisk({...risk,response:e.target.value})}/></label>
     <button className="button primary" disabled={busy}>{t.save}</button>
   </form>}
   {!writable&&<p className="ep-muted">{t.readonly}</p>}
   {error&&<p className="ep-error" role="alert">{error}</p>}
 </div></div>;
}
