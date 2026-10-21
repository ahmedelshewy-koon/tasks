-- Cross-department assignment: the assignee's direct HR manager must approve
-- before the employee is added to task_assignees.
CREATE TABLE assignment_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES tasks(id),
 user_id text NOT NULL REFERENCES users(id),
 requested_by text NOT NULL REFERENCES users(id),
 approver_id text NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewed_by text REFERENCES users(id),
 reviewed_at timestamptz,
 decision_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT assignment_request_decision_coherent CHECK (
 (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
 OR (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX assignment_requests_pending_idx ON assignment_requests(task_id,user_id) WHERE status='pending';
--> statement-breakpoint
CREATE INDEX assignment_requests_approver_idx ON assignment_requests(approver_id,status);
--> statement-breakpoint
CREATE INDEX assignment_requests_task_idx ON assignment_requests(task_id);
