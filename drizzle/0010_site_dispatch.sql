-- Optional field-service estimates on existing tasks. Null means no ETA supplied.
ALTER TABLE tasks ADD COLUMN site_estimate_minutes integer CHECK(site_estimate_minutes BETWEEN 15 AND 43200);
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN site_started_at timestamptz;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN site_expected_end_at timestamptz;
--> statement-breakpoint
CREATE INDEX task_site_active_idx ON tasks(status,site_expected_end_at) WHERE archived_at IS NULL AND deleted_at IS NULL;
