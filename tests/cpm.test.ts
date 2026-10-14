import { describe, it, expect } from "vitest";
import { calculateCpm, type ScheduleCalendar, type ScheduleLink } from "../src/modules/scheduling/cpm";

const calendar: ScheduleCalendar={ workingDays:[0,1,2,3,4] };
const run=(durations:Record<string,number>,relationships:ScheduleLink[]=[],startDate="2026-10-18",cal=calendar)=>
  calculateCpm({activities:Object.entries(durations).map(([id,durationDays])=>({id,durationDays})),relationships,startDate,calendar:cal});

describe("project CPM scheduling preview",()=>{
  it("calculates critical path and float with FS precedence",()=>{
    const p=run({A:2,B:4,C:3},[{predecessorId:"A",successorId:"B",type:"FS",lagDays:0},{predecessorId:"A",successorId:"C",type:"FS",lagDays:0}]);
    const a=Object.fromEntries(p.activities.map(x=>[x.id,x]));
    expect([a.A.earliestStart,a.B.earliestStart,a.C.earliestStart]).toEqual([0,2,2]);
    expect([a.A.totalFloatDays,a.B.totalFloatDays,a.C.totalFloatDays]).toEqual([0,0,1]);
    expect(p.projectFinishDate).toBe("2026-10-25");
  });
  it("supports SS, FF, SF and negative lead without mutating inputs",()=>{
    const ss=run({A:3,B:2},[{predecessorId:"A",successorId:"B",type:"SS",lagDays:1}]);
    expect(ss.activities[1].earliestStart).toBe(1);
    const ff=run({A:5,B:2},[{predecessorId:"A",successorId:"B",type:"FF",lagDays:0}]);
    expect(ff.activities[1].earliestStart).toBe(3);
    const sf=run({A:1,B:2},[{predecessorId:"A",successorId:"B",type:"SF",lagDays:3}]);
    expect(sf.activities[1].earliestStart).toBe(1);
    const lead=run({A:4,B:2},[{predecessorId:"A",successorId:"B",type:"FS",lagDays:-2}]);
    expect(lead.activities[1].earliestStart).toBe(2);
  });
  it("honors weekend and calendar exception on civil dates",()=>{
    const p=run({A:2},[],"2026-10-15",{workingDays:[0,1,2,3,4],exceptions:[{day:"2026-10-18",isWorking:false}]});
    expect(p.activities[0].earlyStartDate).toBe("2026-10-15");
    expect(p.activities[0].earlyFinishDate).toBe("2026-10-19");
  });
  it("handles milestone zero-duration and empty schedules",()=>{
    const p=run({A:2,M:0},[{predecessorId:"A",successorId:"M",type:"FS",lagDays:0}]);
    const m=p.activities.find(a=>a.id==="M")!;
    expect(m.earliestStart).toBe(2);
    expect(m.earlyStartDate).toBe(m.earlyFinishDate);
    expect(run({}).projectFinishDate).toBeNull();
  });
  it("rejects cycles, invalid calendar, bad targets, malformed lags and duplicates",()=>{
    expect(()=>run({A:1,B:2},[{predecessorId:"A",successorId:"B",type:"FS",lagDays:0},{predecessorId:"B",successorId:"A",type:"FS",lagDays:0}])).toThrow("Circular");
    expect(()=>run({A:1},[],"2026-10-18",{workingDays:[]})).toThrow();
    expect(()=>run({A:1},[{predecessorId:"A",successorId:"X",type:"FS",lagDays:0}])).toThrow();
    expect(()=>run({A:1,B:1},[{predecessorId:"A",successorId:"B",type:"FS",lagDays:0.5}])).toThrow();
    expect(()=>run({A:1},[],"2026-02-30")).toThrow();
  });
});
