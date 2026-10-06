import { expect, it } from "vitest";
import { subordinateUserIds } from "../src/modules/hr/hierarchy";
import type { Employee } from "../src/modules/shared/types";

it("keeps each user identity when HR exposes two accounts for the same subordinate employee", () => {
  const boss: Employee = {
    employeeId: "boss",
    userId: "boss-user",
    managerId: null,
    name: "Boss",
    email: "boss@example.com",
    company: "",
    branch: "",
    department: "",
    jobTitle: "",
  };
  const real = {
    ...boss,
    employeeId: "report",
    userId: "real-user",
    managerId: "boss",
  };
  const demo = { ...real, userId: "demo-user" };
  expect(subordinateUserIds(boss, [boss, real, demo]).sort()).toEqual([
    "demo-user",
    "real-user",
  ]);
  expect(subordinateUserIds(boss, [boss, demo, real]).sort()).toEqual([
    "demo-user",
    "real-user",
  ]);
});
