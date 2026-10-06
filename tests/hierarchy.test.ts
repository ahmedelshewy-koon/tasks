import { expect, it } from "vitest";
import { subordinateUserIds } from "../src/modules/hr/hierarchy";
import type { Employee } from "../src/modules/shared/types";
const person = (employeeId: string, managerId: string | null): Employee => ({
  employeeId,
  userId: `user-${employeeId}`,
  managerId,
  name: employeeId,
  email: `${employeeId}@example.com`,
  company: "",
  branch: "",
  department: "",
  jobTitle: "",
});
const boss = person("boss", null);
const me = person("manager", "boss");
const lead = person("lead", "manager");
const junior = person("junior", "lead");
const leaf = person("leaf", "junior");
const peer = person("peer", "boss");
it("resolves all descendants through employee IDs and returns user IDs", () => {
  expect(
    subordinateUserIds(me, [leaf, peer, boss, junior, me, lead]).sort(),
  ).toEqual(["user-junior", "user-lead", "user-leaf"]);
});
it("does not include self, ancestors, peers or broken and cyclic branches", () => {
  expect(
    subordinateUserIds(me, [
      me,
      boss,
      peer,
      person("orphan", "missing"),
      person("a", "b"),
      person("b", "a"),
    ]),
  ).toEqual([]);
});
it("fails closed when the current employee is part of a hierarchy cycle", () => {
  const cyclicMe = { ...me, managerId: "lead" };
  expect(subordinateUserIds(cyclicMe, [cyclicMe, lead, junior])).toEqual([]);
});
it("reflects a transfer on the next hierarchy snapshot", () => {
  expect(
    subordinateUserIds(me, [me, { ...lead, managerId: "peer" }, junior, peer]),
  ).toEqual([]);
});
