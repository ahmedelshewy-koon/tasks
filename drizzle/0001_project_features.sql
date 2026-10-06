CREATE TABLE milestones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id),
 name text NOT NULL, description text NOT NULL DEFAULT '', due_date date NOT NULL,
 status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed'))
);
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN milestone_id uuid REFERENCES milestones(id);
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN reminder_minutes integer NOT NULL DEFAULT 1440 CHECK (reminder_minutes IN (60,1440,4320));
--> statement-breakpoint
CREATE TABLE task_dependencies (
 task_id uuid NOT NULL REFERENCES tasks(id), blocker_id uuid NOT NULL REFERENCES tasks(id),
 PRIMARY KEY (task_id, blocker_id), CHECK (task_id <> blocker_id)
);
--> statement-breakpoint
CREATE TABLE task_checklist (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES tasks(id),
 title text NOT NULL, completed boolean NOT NULL DEFAULT false, position integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE activity_logs ALTER COLUMN task_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE activity_logs ADD COLUMN project_id uuid REFERENCES projects(id);
--> statement-breakpoint
CREATE INDEX checklist_task_idx ON task_checklist(task_id);
--> statement-breakpoint
CREATE INDEX milestones_project_idx ON milestones(project_id);
--> statement-breakpoint
