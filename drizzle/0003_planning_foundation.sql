-- Additive Phase 1: existing projects/tasks/HR links remain untouched.
CREATE TABLE planning_wbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  parent_id uuid REFERENCES planning_wbs(id),
  code text NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_wbs_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX planning_wbs_project_code_idx ON planning_wbs(project_id, code);
--> statement-breakpoint
CREATE INDEX planning_wbs_parent_idx ON planning_wbs(parent_id);
--> statement-breakpoint
CREATE TABLE planning_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  name text NOT NULL,
  time_zone text NOT NULL,
  working_days jsonb NOT NULL,
  minutes_per_day integer NOT NULL CHECK (minutes_per_day BETWEEN 1 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX planning_calendars_project_name_idx ON planning_calendars(project_id, name);
--> statement-breakpoint
CREATE TABLE planning_calendar_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES planning_calendars(id),
  day date NOT NULL,
  is_working boolean NOT NULL,
  note text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX planning_calendar_exception_day_idx ON planning_calendar_exceptions(calendar_id, day);
--> statement-breakpoint
CREATE TABLE planning_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'task' CHECK (type IN ('task','milestone')),
  wbs_id uuid REFERENCES planning_wbs(id),
  task_id uuid REFERENCES tasks(id),
  calendar_id uuid REFERENCES planning_calendars(id),
  duration_days integer NOT NULL DEFAULT 1 CHECK (duration_days BETWEEN 0 AND 36500),
  planned_start date,
  planned_finish date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_activity_date_order CHECK (planned_start IS NULL OR planned_finish IS NULL OR planned_start <= planned_finish),
  CONSTRAINT planning_activity_milestone_duration CHECK ((type='milestone' AND duration_days=0) OR (type='task' AND duration_days >= 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX planning_activity_project_code_idx ON planning_activities(project_id, code);
--> statement-breakpoint
CREATE UNIQUE INDEX planning_activity_task_idx ON planning_activities(task_id);
--> statement-breakpoint
CREATE INDEX planning_activity_wbs_idx ON planning_activities(wbs_id);
--> statement-breakpoint
CREATE INDEX planning_activity_calendar_idx ON planning_activities(calendar_id);
