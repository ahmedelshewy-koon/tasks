ALTER TABLE project_members ADD COLUMN role text NOT NULL DEFAULT 'member' CHECK (role IN ('project_manager', 'member', 'viewer'));
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN archived_at timestamptz;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN health_override text CHECK (health_override IN ('on_track', 'at_risk', 'off_track', 'completed'));
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN archived_at timestamptz;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN recurrence text CHECK (recurrence IN ('daily', 'weekly', 'monthly'));
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN recurrence_next_id uuid;
--> statement-breakpoint
CREATE TABLE tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX tags_name_idx ON tags (lower(name));
--> statement-breakpoint
CREATE TABLE task_tags (
 task_id uuid NOT NULL REFERENCES tasks(id), tag_id uuid NOT NULL REFERENCES tags(id),
 PRIMARY KEY (task_id, tag_id)
);
--> statement-breakpoint
CREATE TABLE project_fields (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id),
 name text NOT NULL, type text NOT NULL CHECK (type IN ('text', 'number', 'select', 'date')),
 options jsonb NOT NULL DEFAULT '[]'::jsonb, position integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX project_fields_project_idx ON project_fields(project_id);
--> statement-breakpoint
CREATE TABLE task_field_values (
 task_id uuid NOT NULL REFERENCES tasks(id), field_id uuid NOT NULL REFERENCES project_fields(id),
 value text NOT NULL, PRIMARY KEY (task_id, field_id)
);
--> statement-breakpoint
CREATE TABLE project_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text NOT NULL DEFAULT '',
 created_by text NOT NULL REFERENCES users(id), content jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE saved_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES users(id),
 name text NOT NULL, scope text NOT NULL CHECK (scope IN ('my-tasks', 'team', 'project')),
 project_id uuid REFERENCES projects(id), config jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX saved_views_user_idx ON saved_views(user_id);
--> statement-breakpoint
UPDATE activity_logs a SET project_id = t.project_id FROM tasks t WHERE a.task_id = t.id AND a.project_id IS NULL AND t.project_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX activity_project_idx ON activity_logs(project_id, created_at);
--> statement-breakpoint
CREATE INDEX activity_task_idx ON activity_logs(task_id);
