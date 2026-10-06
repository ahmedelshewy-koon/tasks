import { describe, expect, it } from "vitest";
import {
  aggregateStatus,
  canViewTask,
  canEditTask,
  canManageProject,
  validateAssignees,
  progress,
} from "../src/modules/tasks/policy";
const employee = {
  userId: "e",
  employeeId: "e",
  isAdmin: false,
  directReportIds: [],
};
const manager = {
  ...employee,
  userId: "m",
  employeeId: "m",
  directReportIds: ["e"],
};
const admin = { ...employee, userId: "a", isAdmin: true };
const project = { ownerId: "m", memberIds: ["e", "other"] };
const task = { creatorId: "e", projectId: "p", assigneeIds: ["e"] };
describe("privacy and authority", () => {
  it("hides personal work from managers even when assigned to a direct report", () => {
    expect(canViewTask(manager, { ...task, projectId: null }, null)).toBe(
      false,
    );
    expect(canViewTask(admin, { ...task, projectId: null }, null)).toBe(true);
  });
  it("denies a nonmember even if their ID remains on an assignment", () => {
    expect(canViewTask(employee, task, { ...project, memberIds: [] })).toBe(
      false,
    );
    expect(canEditTask(employee, task, { ...project, memberIds: [] })).toBe(
      false,
    );
  });
  it("allows members to read but only assignees to edit", () => {
    const other = { ...employee, userId: "other", employeeId: "other" };
    expect(canViewTask(other, task, project)).toBe(true);
    expect(canEditTask(other, task, project)).toBe(false);
    expect(canEditTask(employee, task, project)).toBe(true);
  });
  it("only the owner or admin can manage a project", () => {
    expect(canManageProject(manager, project)).toBe(true);
    expect(canManageProject({ ...manager, directReportIds: [] }, project)).toBe(
      true,
    );
    expect(canManageProject(employee, project)).toBe(false);
    expect(canManageProject(admin, project)).toBe(true);
  });
  it("rejects managers assigning outsiders and employees assigning coworkers", () => {
    // Owners manage the project, so any assignable member can receive work.
    expect(() => validateAssignees(manager, ["other"], project)).not.toThrow();
    expect(() => validateAssignees(manager, ["outsider"], project)).toThrow();
    expect(() => validateAssignees(employee, ["other"], project)).toThrow();
    expect(() => validateAssignees(manager, ["e"], project)).not.toThrow();
    expect(() => validateAssignees(employee, ["e"], project)).not.toThrow();
    expect(() =>
      validateAssignees(manager, ["e"], { ...project, memberIds: [] }),
    ).toThrow();
  });
});
describe("completion invariants", () => {
  it("requires all individual completions", () => {
    expect(aggregateStatus("todo", [true, false], [])).toBe("in_progress");
    expect(aggregateStatus("todo", [true, true], [])).toBe("done");
    expect(aggregateStatus("done", [true, false], [])).toBe("in_progress");
    expect(aggregateStatus("done", [false], [])).toBe("todo");
  });
  it("requires subtasks and assignments to be complete", () => {
    expect(aggregateStatus("todo", [true], ["done", "todo"])).toBe(
      "in_progress",
    );
    expect(aggregateStatus("todo", [true], ["done", "done"])).toBe("done");
    expect(aggregateStatus("todo", [false], ["done", "done"])).toBe(
      "in_progress",
    );
  });
  it("calculates empty and partial progress without fabricated values", () => {
    expect(progress([])).toBe(0);
    expect(progress(["done", "todo", "in_progress", "done"])).toBe(50);
  });
});

describe("organizational assignment", () => {
  const lead = { ...manager, subordinateIds: ["e", "junior"] };
  const shared = { ownerId: "boss", memberIds: ["m", "e", "junior", "peer"] };
  it("lets a manager assign indirect reports in a project they belong to", () => {
    expect(() => validateAssignees(lead, ["junior"], shared)).not.toThrow();
  });
  it("rejects upward and sideways assignments even inside the project", () => {
    expect(() => validateAssignees(lead, ["boss"], shared)).toThrow();
    expect(() => validateAssignees(lead, ["peer"], shared)).toThrow();
  });
  it("still requires project membership inside projects", () => {
    expect(() =>
      validateAssignees(lead, ["junior"], { ...shared, memberIds: ["m"] }),
    ).toThrow();
  });
  it("lets managers assign reports to tasks without a project", () => {
    expect(() => validateAssignees(lead, ["junior"], null)).not.toThrow();
    expect(() => validateAssignees(lead, ["boss"], null)).toThrow();
    expect(() => validateAssignees(employee, ["other"], null)).toThrow();
    expect(() => validateAssignees(employee, ["e"], null)).not.toThrow();
    const assigned = { creatorId: "m", projectId: null, assigneeIds: ["e"] };
    expect(canViewTask({ ...employee, userId: "e" }, assigned, null)).toBe(true);
    expect(canViewTask({ ...employee, userId: "x" }, assigned, null)).toBe(
      false,
    );
  });
  it("uses the current hierarchy rather than stale direct reports", () => {
    expect(() =>
      validateAssignees({ ...lead, subordinateIds: [] }, ["e"], shared),
    ).toThrow();
  });
});
