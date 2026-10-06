import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MyTeam } from "../src/ui/my-team";
import type { Actor, Employee } from "../src/modules/shared/types";
const actor: Actor = {
  userId: "manager",
  employeeId: "10",
  isAdmin: false,
  directReportIds: ["report"],
};
const employees: Employee[] = ["report", "outsider"].map((userId) => ({
  userId,
  employeeId: userId,
  name: userId,
  email: `${userId}@example.com`,
  company: "SANA",
  branch: "Cairo",
  department: "Operations",
  jobTitle: "Specialist",
  managerId: "10",
}));
it("shows HR direct reports even without projects or tasks, excluding other colleagues", () => {
  const html = renderToStaticMarkup(
    <MyTeam actor={actor} employees={employees} t={(s) => s} />,
  );
  expect(html).toContain("report@example.com");
  expect(html).toContain("Operations");
  expect(html).not.toContain("outsider@example.com");
});
it("does not expose the directory to a user without direct reports, including admins", () => {
  const html = renderToStaticMarkup(
    <MyTeam
      actor={{ ...actor, isAdmin: true, directReportIds: [] }}
      employees={employees}
      t={(s) => s}
    />,
  );
  expect(html).toContain("No team members");
  expect(html).not.toContain("report@example.com");
});

it("includes indirect reports when the server supplies the full hierarchy", () => {
  const html = renderToStaticMarkup(
    <MyTeam
      actor={{ ...actor, subordinateIds: ["report", "outsider"] }}
      employees={employees}
      t={(s) => s}
    />,
  );
  expect(html).toContain("report@example.com");
  expect(html).toContain("outsider@example.com");
});
