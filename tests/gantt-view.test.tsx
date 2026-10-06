import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectGantt } from "../src/ui/project-gantt";
import type { Project, Task, Workspace } from "../src/ui/api";

const project = {
  id: "p",
  sections: [{ id: "s", name: "Build", position: 0 }],
  startDate: null,
  dueDate: null,
} as unknown as Project;
const task = (id: string, title: string, extra: Partial<Task> = {}) =>
  ({
    id,
    title,
    sectionId: "s",
    status: "in_progress",
    progress: 40,
    dueDate: "2026-12-10",
    createdAt: "2026-12-01T12:00:00Z",
    blockedBy: [],
    ...extra,
  }) as unknown as Task;
const milestones = [
  { id: "m", projectId: "p", name: "Launch", dueDate: "2026-12-15", status: "upcoming" },
] as unknown as Workspace["milestones"];

it.each(["en", "ar"] as const)(
  "renders sections, bars, milestones and dependency links (%s)",
  (lang) => {
    const html = renderToStaticMarkup(
      <ProjectGantt
        project={project}
        tasks={[
          task("a", "Design"),
          task("b", "Ship", { blockedBy: ["a"], dueDate: null } as Partial<Task>),
        ]}
        milestones={milestones}
        t={(s) => s}
        lang={lang}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain("Build");
    expect(html).toContain("Design");
    expect(html).toContain("gantt-bar in_progress");
    expect(html).toContain("undated");
    expect(html).toContain("Launch");
    expect(html.match(/marker-end="url\(#gantt-arrow\)"/g)).toHaveLength(1);
  },
);

it("shows the empty state when filters hide every task", () => {
  const html = renderToStaticMarkup(
    <ProjectGantt
      project={project}
      tasks={[]}
      milestones={[]}
      t={(s) => s}
      lang="en"
      onOpen={() => {}}
    />,
  );
  expect(html).toContain("No matching tasks");
});
