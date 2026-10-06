import { z } from "zod";
import { daysBetween } from "../tasks/recurrence";

const offset = z.number().int().min(-3650).max(3650).nullable();
const priority = z.enum(["low", "medium", "high", "urgent"]);
const key = z.string().min(1).max(64);
const checklist = z.array(z.string().trim().min(1).max(250)).max(100);
const assigneeIds = z.array(z.string().min(1)).max(100);
const subtask = z.object({
  key,
  title: z.string().trim().min(1).max(250),
  description: z.string().max(20000),
  priority,
  offset,
  checklist,
  assigneeIds,
});
// Due dates are stored as day offsets from the project start, so a template
// keeps its schedule shape whenever it is used.
export const templateContent = z.object({
  sections: z.array(z.string().trim().min(1).max(100)).max(30),
  milestones: z
    .array(
      z.object({
        key,
        name: z.string().trim().min(1).max(150),
        description: z.string().max(10000),
        offset: z.number().int().min(-3650).max(3650),
      }),
    )
    .max(100),
  tasks: z
    .array(
      subtask.extend({
        section: z.number().int().min(0).nullable(),
        milestone: key.nullable(),
        subtasks: z.array(subtask).max(100),
      }),
    )
    .max(500),
  dependencies: z.array(z.object({ task: key, blocker: key })).max(2000),
});
export type TemplateContent = z.infer<typeof templateContent>;

type SourceTask = {
  id: string;
  title: string;
  description: string;
  priority: z.infer<typeof priority>;
  parentId: string | null;
  sectionId: string | null;
  milestoneId: string | null;
  dueDate: string | null;
  assigneeIds: string[];
};

export function captureTemplate(input: {
  base: string;
  sections: { id: string; name: string }[];
  milestones: {
    id: string;
    name: string;
    description: string;
    dueDate: string;
  }[];
  tasks: SourceTask[];
  checklist: { taskId: string; title: string; position: number }[];
  dependencies: { taskId: string; blockerId: string }[];
  includeAssignees: boolean;
}): TemplateContent {
  const at = (date: string | null) =>
    date ? daysBetween(input.base, date) : null;
  const items = (taskId: string) =>
    input.checklist
      .filter((item) => item.taskId === taskId)
      .sort((a, b) => a.position - b.position)
      .map((item) => item.title);
  const shape = (task: SourceTask) => ({
    key: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    offset: at(task.dueDate),
    checklist: items(task.id),
    assigneeIds: input.includeAssignees ? task.assigneeIds : [],
  });
  const ids = new Set(input.tasks.map((task) => task.id));
  return {
    sections: input.sections.map((section) => section.name),
    milestones: input.milestones.map((milestone) => ({
      key: milestone.id,
      name: milestone.name,
      description: milestone.description,
      offset: daysBetween(input.base, milestone.dueDate),
    })),
    tasks: input.tasks
      .filter((task) => !task.parentId)
      .map((task) => {
        const section = input.sections.findIndex(
          (s) => s.id === task.sectionId,
        );
        return {
          ...shape(task),
          section: section < 0 ? null : section,
          milestone: input.milestones.some((m) => m.id === task.milestoneId)
            ? task.milestoneId
            : null,
          subtasks: input.tasks
            .filter((child) => child.parentId === task.id)
            .map(shape),
        };
      }),
    dependencies: input.dependencies
      .filter((edge) => ids.has(edge.taskId) && ids.has(edge.blockerId))
      .map((edge) => ({ task: edge.taskId, blocker: edge.blockerId })),
  };
}

export function templateSummary(content: TemplateContent) {
  return {
    sections: content.sections.length,
    milestones: content.milestones.length,
    tasks: content.tasks.length,
    subtasks: content.tasks.reduce((sum, task) => sum + task.subtasks.length, 0),
    dependencies: content.dependencies.length,
    checklistItems: content.tasks.reduce(
      (sum, task) =>
        sum +
        task.checklist.length +
        task.subtasks.reduce((n, child) => n + child.checklist.length, 0),
      0,
    ),
    assigned: content.tasks.some(
      (task) =>
        task.assigneeIds.length ||
        task.subtasks.some((child) => child.assigneeIds.length),
    ),
  };
}
