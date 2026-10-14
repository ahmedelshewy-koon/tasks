-- Separate scheduling relationships; never mutate execution task_dependencies.
CREATE TABLE planning_relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id),
 predecessor_id uuid NOT NULL REFERENCES planning_activities(id),
 successor_id uuid NOT NULL REFERENCES planning_activities(id),
 type text NOT NULL CHECK (type IN ('FS','SS','FF','SF')),
 lag_days integer NOT NULL DEFAULT 0 CHECK (lag_days BETWEEN -36500 AND 36500),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT planning_relationship_no_self CHECK (predecessor_id <> successor_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX planning_relationship_pair_type_idx ON planning_relationships(predecessor_id, successor_id, type);
--> statement-breakpoint
CREATE INDEX planning_relationships_project_idx ON planning_relationships(project_id);
