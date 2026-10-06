import {
  pgTable,
  text,
  uuid,
  timestamp,
  date,
  boolean,
  integer,
  jsonb,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";
const bytes = customType<{ data: Buffer }>({
  dataType: () => "bytea",
  toDriver: (v) => v,
  fromDriver: (v) => Buffer.from(v as Uint8Array),
});
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  createdAt: created(),
});
export const admins = pgTable("admins", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  createdAt: created(),
});
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  status: text("status", { enum: ["active", "completed"] })
    .notNull()
    .default("active"),
  healthOverride: text("health_override", {
    enum: ["on_track", "at_risk", "off_track", "completed"],
  }),
  createdAt: created(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
export const members = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["project_manager", "member", "viewer"] })
      .notNull()
      .default("member"),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);
export const sections = pgTable("sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
});
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    projectId: uuid("project_id").references(() => projects.id),
    parentId: uuid("parent_id"),
    sectionId: uuid("section_id").references(() => sections.id),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["todo", "in_progress", "done"] })
      .notNull()
      .default("todo"),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
      .notNull()
      .default("medium"),
    dueDate: date("due_date"),
    reminderMinutes: integer("reminder_minutes").notNull().default(1440),
    milestoneId: uuid("milestone_id").references(() => milestones.id),
    recurrence: text("recurrence", { enum: ["daily", "weekly", "monthly"] }),
    recurrenceNextId: uuid("recurrence_next_id"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId),
    index("tasks_parent_idx").on(t.parentId),
  ],
);
export const assignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    completed: boolean("completed").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.userId] }),
    index("assignees_user_idx").on(t.userId),
  ],
);
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: created(),
});
export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  content: bytes("content").notNull(),
  createdAt: created(),
});
export const activity = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id),
  projectId: uuid("project_id").references(() => projects.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: created(),
});
export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  dueDate: date("due_date").notNull(),
  status: text("status", { enum: ["upcoming", "completed"] })
    .notNull()
    .default("upcoming"),
});
export const dependencies = pgTable(
  "task_dependencies",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => tasks.id),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.blockerId] })],
);
export const checklist = pgTable("task_checklist", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  position: integer("position").notNull().default(0),
});
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    dedupeKey: text("dedupe_key").unique(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: created(),
});
export const taskTags = pgTable(
  "task_tags",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] })],
);
export const fields = pgTable("project_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["text", "number", "select", "date"] }).notNull(),
  options: jsonb("options").$type<string[]>().notNull().default([]),
  position: integer("position").notNull().default(0),
});
export const fieldValues = pgTable(
  "task_field_values",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => fields.id),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.fieldId] })],
);
export const templates = pgTable("project_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  content: jsonb("content").notNull(),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  scope: text("scope", { enum: ["my-tasks", "team", "project"] }).notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  config: jsonb("config").notNull(),
  createdAt: created(),
});
