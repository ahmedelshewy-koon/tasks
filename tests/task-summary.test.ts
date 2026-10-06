import { describe, expect, it } from "vitest";
import { summarizeTasks } from "../src/modules/tasks/summary";

describe("team task summary", () => {
  it("does not count completed tasks as overdue or due today", () => {
    expect(
      summarizeTasks(
        [
          { status: "done", dueDate: "2026-10-01" },
          { status: "done", dueDate: "2026-10-04" },
          { status: "todo", dueDate: "2026-10-03" },
          { status: "in_progress", dueDate: "2026-10-04" },
          { status: "todo", dueDate: null },
          { status: "todo", dueDate: "2026-10-05" },
        ],
        "2026-10-04",
      ),
    ).toEqual({ open: 4, overdue: 1, dueToday: 1, completed: 2 });
  });

  it("returns zero counts for an empty team", () => {
    expect(summarizeTasks([], "2026-10-04")).toEqual({
      open: 0,
      overdue: 0,
      dueToday: 0,
      completed: 0,
    });
  });
});
