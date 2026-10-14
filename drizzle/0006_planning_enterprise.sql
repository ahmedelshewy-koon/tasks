-- Enterprise planning resources, assignments, costs and risk registry.
CREATE TABLE planning_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id),
 name text NOT NULL, kind text NOT NULL CHECK(kind IN ('labor','equipment','material')),
 hr_user_id text, capacity_hours_week integer NOT NULL DEFAULT 40 CHECK(capacity_hours_week BETWEEN 0 AND 168),
 rate_minor integer NOT NULL DEFAULT 0 CHECK(rate_minor BETWEEN 0 AND 2147483647),
 currency text NOT NULL DEFAULT 'SAR' CHECK(currency ~ '^[A-Z]{3}$'), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX planning_resources_project_idx ON planning_resources(project_id);
--> statement-breakpoint
CREATE TABLE planning_resource_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id),
 activity_id uuid NOT NULL REFERENCES planning_activities(id),
 resource_id uuid NOT NULL REFERENCES planning_resources(id),
 planned_hours integer NOT NULL DEFAULT 0 CHECK(planned_hours BETWEEN 0 AND 1000000),
 allocation_percent integer NOT NULL DEFAULT 100 CHECK(allocation_percent BETWEEN 0 AND 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX planning_assignment_unique_idx ON planning_resource_assignments(activity_id,resource_id);
--> statement-breakpoint
CREATE INDEX planning_assignment_project_idx ON planning_resource_assignments(project_id);
--> statement-breakpoint
CREATE TABLE planning_cost_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id),
 activity_id uuid REFERENCES planning_activities(id),
 name text NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 budget_minor integer NOT NULL DEFAULT 0 CHECK(budget_minor BETWEEN 0 AND 2147483647),
 actual_minor integer NOT NULL DEFAULT 0 CHECK(actual_minor BETWEEN 0 AND 2147483647),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX planning_cost_project_idx ON planning_cost_items(project_id);
--> statement-breakpoint
CREATE TABLE planning_risks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id),
 title text NOT NULL, probability integer NOT NULL CHECK(probability BETWEEN 1 AND 5),
 impact integer NOT NULL CHECK(impact BETWEEN 1 AND 5),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','mitigating','closed')),
 response text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX planning_risk_project_idx ON planning_risks(project_id);
