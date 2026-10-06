import { describe, expect, it } from "vitest";
import { buildRoadmap } from "../src/modules/tasks/roadmap";

describe("project roadmap", () => {
  const sections = [
    { id: "design", name: "Design", position: 0 },
    { id: "launch", name: "Launch", position: 1 },
  ];
  const task = (
    id: string,
    sectionId: string | null,
    status = "todo",
    parentId: string | null = null,
  ) => ({ id, sectionId, status, parentId, dueDate: "2026-10-20" });
  it("keeps ordered empty milestones pending and ignores subtasks in totals", () => {
    const result = buildRoadmap([...sections].reverse(), [
      task("a", "design", "done"),
      task("child", "design", "done", "a"),
    ]);
    expect(result.stages.map((s) => s.id)).toEqual(["design", "launch"]);
    expect(result.total).toBe(1);
    expect(result.stages[0].complete).toBe(true);
    expect(result.stages[1].complete).toBe(false);
    expect(result.complete).toBe(false);
  });
  it("includes unassigned tasks so they cannot disappear from the goal", () => {
    const result = buildRoadmap(sections, [
      task("a", "design", "done"),
      task("b", "launch", "done"),
      task("c", null),
    ]);
    expect(result.total).toBe(3);
    expect(result.completed).toBe(2);
    expect(result.progress).toBe(67);
    expect(result.complete).toBe(false);
    expect(result.stages.at(-1)?.tasks[0].id).toBe("c");
  });
  it("only reaches the goal when every populated milestone and task is complete", () => {
    expect(buildRoadmap([], []).complete).toBe(false);
    const result = buildRoadmap(sections, [
      task("a", "design", "done"),
      task("b", "launch", "done"),
    ]);
    expect(result.complete).toBe(true);
    expect(result.progress).toBe(100);
  });
});
