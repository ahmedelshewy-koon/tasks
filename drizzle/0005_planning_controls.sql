-- Immutable project baseline and independent activity progress.
CREATE TABLE planning_baselines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id),
 label text NOT NULL,
 snapshot jsonb NOT NULL,
 created_by text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX planning_baselines_project_idx ON planning_baselines(project_id);
--> statement-breakpoint
CREATE TABLE planning_progress (
 activity_id uuid PRIMARY KEY REFERENCES planning_activities(id),
 project_id uuid NOT NULL REFERENCES projects(id),
 percent_complete integer NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
 actual_start date,
 actual_finish date,
 remaining_days integer NOT NULL DEFAULT 0 CHECK (remaining_days BETWEEN 0 AND 36500),
 note text NOT NULL DEFAULT '',
 updated_by text NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT planning_progress_date_order CHECK (actual_start IS NULL OR actual_finish IS NULL OR actual_start <= actual_finish),
 CONSTRAINT planning_progress_finish_requires_start CHECK (actual_finish IS NULL OR actual_start IS NOT NULL),
 CONSTRAINT planning_progress_finish_is_complete CHECK (actual_finish IS NULL OR percent_complete = 100)
);
--> statement-breakpoint
CREATE INDEX planning_progress_project_idx ON planning_progress(project_id);
