import { z } from "zod";
export const dateValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Enter a valid calendar date.",
  )
  .nullable();
const roleMap = z.record(
  z.string(),
  z.enum(["project_manager", "member", "viewer"]),
);
const projectFields = {
  name: z.string().trim().min(1).max(150),
  description: z.string().max(10000),
  ownerId: z.string().min(1),
  memberIds: z.array(z.string().min(1)).max(500),
  roles: roleMap,
  startDate: dateValue,
  dueDate: dateValue,
  status: z.enum(["active", "completed"]),
};
export const projectInput = z.object({
  ...projectFields,
  description: projectFields.description.default(""),
  ownerId: projectFields.ownerId.optional(),
  memberIds: projectFields.memberIds.default([]),
  roles: roleMap.default({}),
  startDate: dateValue.optional(),
  dueDate: dateValue.optional(),
  status: projectFields.status.default("active"),
  sectionNames: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  templateId: z.uuid().optional(),
});
// Patches carry no defaults: omitted fields stay unchanged.
export const projectPatch = z.object(projectFields).partial();
const taskFields = {
  title: z.string().trim().min(1).max(250),
  description: z.string().max(20000),
  sectionId: z.uuid().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "done"]),
  dueDate: dateValue,
  assigneeIds: z.array(z.string().min(1)).min(1).max(100),
  recurrence: z.enum(["daily", "weekly", "monthly"]).nullable(),
};
export const taskInput = z.object({
  ...taskFields,
  description: taskFields.description.default(""),
  projectId: z.uuid().nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  sectionId: taskFields.sectionId.optional(),
  priority: taskFields.priority.default("medium"),
  status: taskFields.status.default("todo"),
  dueDate: dateValue.optional(),
  recurrence: taskFields.recurrence.optional(),
  tags: z.lazy(() => tagNames).optional(),
});
// Patches carry no defaults: omitted fields stay unchanged.
export const taskPatch = z.object(taskFields).partial();
export const tagNames = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((names) => [
    ...new Map(names.map((n) => [n.toLocaleLowerCase(), n])).values(),
  ]);
export const fieldInput = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(80),
    type: z.enum(["text", "number", "select", "date"]),
    options: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  })
  .refine(
    (f) => f.type !== "select" || f.options.length > 0,
    "Select fields need at least one option.",
  );
export const viewInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(60),
  scope: z.enum(["my-tasks", "team", "project"]),
  projectId: z.uuid().nullable().default(null),
  config: z.object({
    filters: z.record(z.string().max(80), z.string().max(200)),
    sort: z.object({
      key: z.string().max(80),
      dir: z.enum(["asc", "desc"]),
    }),
    group: z.string().max(80),
    columns: z.array(z.string().max(80)).max(40),
  }),
});
