"use client";
import {useMemo,useState} from "react";
import {BriefcaseBusiness,Search} from "lucide-react";
import type {Workspace} from "./api";
import type {Language} from "./i18n";
import "./portfolio.css";
export function PortfolioView({data,lang,onProject}:{data:Workspace;lang:Language;onProject:(id:string)=>void}){
 const [search,setSearch]=useState("");
 const [status,setStatus]=useState("all");
 const ar=lang==="ar";
 const names=ar?{title:"محفظة المشاريع",subtitle:"عرض المشاريع المصرح لك بالوصول إليها فقط",total:"إجمالي المشاريع",active:"النشطة",risk:"المعرضة للخطر",avg:"متوسط الإنجاز",search:"ابحث عن مشروع",all:"الكل",completed:"المكتملة",open:"فتح المشروع",progress:"الإنجاز",health:"الصحة"}:
 {title:"Project Portfolio",subtitle:"Only projects you are authorized to access are included.",total:"Projects",active:"Active",risk:"At risk",avg:"Average progress",search:"Search projects",all:"All",completed:"Completed",open:"Open project",progress:"Progress",health:"Health"};
 const projects=data.projects;
 const visible=useMemo(()=>projects.filter(p=>(status==="all"||p.status===status)&&p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)),[projects,status,search]);
 const average=projects.length?Math.round(projects.reduce((sum,p)=>sum+p.progress,0)/projects.length):0;
 const danger=projects.filter(p=>p.health==="at_risk"||p.health==="off_track").length;
 return <section className="portfolio-page">
 <header className="portfolio-intro"><BriefcaseBusiness size={23}/><div><h2>{names.title}</h2><p>{names.subtitle}</p></div></header>
 <div className="portfolio-summary">
   {[[names.total,projects.length],[names.active,projects.filter(p=>p.status==="active").length],[names.risk,danger],[names.avg,average+"%"]].map(([label,value])=><div key={String(label)} className="panel portfolio-kpi"><span>{label}</span><strong>{value}</strong></div>)}
 </div>
 <div className="portfolio-filter"><label><Search size={16}/><input value={search} aria-label={names.search} placeholder={names.search} onChange={e=>setSearch(e.target.value)}/></label>
 <select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">{names.all}</option><option value="active">{names.active}</option><option value="completed">{names.completed}</option></select></div>
 <div className="portfolio-grid">{visible.map(p=><article key={p.id} className="panel portfolio-project"><div><h3>{p.name}</h3><p>{p.description}</p></div>
 <div className="portfolio-meta"><span>{names.progress}</span><strong>{p.progress}%</strong></div>
 <div className="portfolio-bar"><div style={{width:`${p.progress}%`}}/></div>
 <div className="portfolio-meta"><span>{names.health}: {p.health.replaceAll("_"," ")}</span><button type="button" className="button secondary small-button" onClick={()=>onProject(p.id)}>{names.open}</button></div>
 </article>)}</div>
 </section>;
}
