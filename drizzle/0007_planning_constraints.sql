-- Optional Start-No-Earlier-Than constraint; manual planned dates remain untouched.
ALTER TABLE planning_activities ADD COLUMN constraint_type text CHECK (constraint_type IN ('snet'));
--> statement-breakpoint
ALTER TABLE planning_activities ADD COLUMN constraint_date date;
--> statement-breakpoint
ALTER TABLE planning_activities ADD CONSTRAINT planning_constraint_pair CHECK ((constraint_type IS NULL) = (constraint_date IS NULL));
