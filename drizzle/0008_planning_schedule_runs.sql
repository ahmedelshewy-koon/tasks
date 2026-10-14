-- Immutable, opt-in schedule calculation snapshots.
CREATE TABLE planning_schedule_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id),
 calendar_id uuid NOT NULL REFERENCES planning_calendars(id),
 result jsonb NOT NULL,
 created_by text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX planning_schedule_runs_project_idx ON planning_schedule_runs(project_id,created_at);
