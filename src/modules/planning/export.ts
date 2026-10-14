/** Formula-safe UTF-8 CSV for externally reviewing authorized project schedule data. */
export type ExportWbs={id:string;code:string};
export type ExportActivity={code:string;name:string;type:string;durationDays:number;wbsId:string|null;plannedStart:string|null;plannedFinish:string|null};
export function planningActivitiesCsv(activities:ExportActivity[],nodes:ExportWbs[]):string {
 const byWbs=new Map(nodes.map(w=>[w.id,w.code]));
 const escape=(value:string)=>{
  // Spreadsheet programs can execute attacker-controlled formulas on import.
  const safe=/^[=+@\-\t\r]/.test(value)?"'"+value:value;
  return '"'+safe.replaceAll('"','""')+'"';
 };
 const header=["Activity ID","Activity Name","Type","WBS","Duration (working days)","Planned Start","Planned Finish"];
 const rows=activities.map(a=>[a.code,a.name,a.type,byWbs.get(a.wbsId??"")??"",String(a.durationDays),a.plannedStart??"",a.plannedFinish??""]);
 return "\uFEFF"+[header,...rows].map(cols=>cols.map(v=>escape(v)).join(",")).join("\r\n")+"\r\n";
}
