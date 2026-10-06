import { describe, expect, it } from "vitest";
import { buildGantt, dayIso, dayNumber } from "../src/modules/tasks/gantt";

describe("project gantt", () => {
  const task = (
    id: string,
    sectionId: string | null,
    created: string,
    dueDate: string | null,
    extra: { status?: string; blockedBy?: string[] } = {},
  ) => ({
    id,
    sectionId,
    dueDate,
    status: extra.status ?? "todo",
    blockedBy: extra.blockedBy ?? [],
    // Noon UTC is the same calendar day in Cairo.
    createdAt: `${created}T12:00:00Z`,
  });
  const sections = [
    { id: "build", name: "Build", position: 1 },
    { id: "plan", name: "Plan", position: 0 },
  ];

  it("runs bars from creation to due date, grouped by ordered sections", () => {
    const g = buildGantt({
      sections,
      tasks: [
        task("b", "build", "2026-10-05", "2026-10-12"),
        task("a", "plan", "2026-10-01", "2026-10-03"),
        task("loose", null, "2026-10-02", null),
      ],
      milestones: [],
      today: "2026-10-06",
    });
    expect(
      g.rows.map((r) => (r.kind === "section" ? `#${r.name}` : r.task.id)),
    ).toEqual(["#Plan", "a", "#Build", "b", "#No section", "loose"]);
    const a = g.rows[1];
    expect(a.kind === "task" && [dayIso(a.start), dayIso(a.end)]).toEqual([
      "2026-10-01",
      "2026-10-03",
    ]);
    const loose = g.rows[5];
    expect(loose.kind === "task" && loose.undated).toBe(true);
    expect(a.kind === "task" && a.overdue).toBe(true);
  });

  it("snaps the range to whole Sunday-based weeks covering every date", () => {
    const g = buildGantt({
      sections: [],
      tasks: [task("a", null, "2026-10-01", "2026-10-20")],
      milestones: [{ id: "m", name: "Launch", dueDate: "2026-11-02" }],
      projectStart: "2026-09-28",
      today: "2026-10-06",
    });
    expect(g.days % 7).toBe(0);
    expect(new Date(g.start * 86_400_000).getUTCDay()).toBe(0);
    expect(g.start).toBeLessThanOrEqual(dayNumber("2026-09-28"));
    expect(g.start + g.days - 1).toBeGreaterThanOrEqual(dayNumber("2026-11-02"));
    expect(g.today).toBe(dayNumber("2026-10-06") - g.start);
    expect(g.milestones[0].offset).toBe(dayNumber("2026-11-02") - g.start);
  });

  it("links dependencies and flags a task due before its blocker", () => {
    const g = buildGantt({
      sections: [],
      tasks: [
        task("blocker", null, "2026-10-01", "2026-10-10"),
        task("early", null, "2026-10-02", "2026-10-05", {
          blockedBy: ["blocker"],
        }),
        task("ok", null, "2026-10-03", "2026-10-15", {
          blockedBy: ["blocker", "hidden"],
        }),
      ],
      milestones: [],
      today: "2026-10-01",
    });
    expect(g.links).toEqual([
      { from: 0, to: 1, conflict: true },
      { from: 0, to: 2, conflict: false },
    ]);
  });
});
