-- Additive two-person review. Approval never automatically changes tasks, costs or dates.
CREATE TABLE planning_change_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id),
 kind text NOT NULL CHECK(kind IN ('scope','schedule','budget','resource')),
 title text NOT NULL, description text NOT NULL,
 impact_days integer NOT NULL DEFAULT 0 CHECK(impact_days BETWEEN -36500 AND 36500),
 impact_minor integer NOT NULL DEFAULT 0 CHECK(impact_minor BETWEEN -2147483647 AND 2147483647),
 currency text NOT NULL DEFAULT 'SAR' CHECK(currency ~ '^[A-Z]{3}$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by text NOT NULL REFERENCES users(id),
 reviewed_by text REFERENCES users(id),
 reviewed_at timestamptz, decision_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT planning_change_decision_coherent CHECK (
 (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
 OR (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by<>requested_by))
);
--> statement-breakpoint
CREATE INDEX planning_change_requests_project_idx ON planning_change_requests(project_id);
--> statement-breakpoint
CREATE TABLE planning_baseline_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id),
 baseline_id uuid NOT NULL UNIQUE REFERENCES planning_baselines(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by text NOT NULL REFERENCES users(id),
 reviewed_by text REFERENCES users(id),
 reviewed_at timestamptz, decision_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT planning_baseline_review_coherent CHECK (
 (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
 OR (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by<>requested_by))
);
--> statement-breakpoint
CREATE INDEX planning_baseline_reviews_project_idx ON planning_baseline_reviews(project_id);
