# Enterprise Project Planning: compatibility and delivery plan

Status: Phase 0 audited; Phase 1 implemented incrementally on a feature branch. No migration, merge, or deployment to production has been performed by this change.

## Existing system baseline (main at 8c0f5e76)
- Next.js 16, React 19, TypeScript, PostgreSQL/PGlite, Drizzle ORM.
- `projects`, `sections`, `tasks`, `task_dependencies`, `milestones`, HR session/employee hierarchy, permissions and audit log.
- Gantt reads **task createdAt to dueDate**, not an engineering schedule. Never reinterpret `created_at` as planned start, and never overwrite the existing task due date.
- Project roles owner, project_manager, member and viewer; admins override. Existing `/api/work` and `/api/hr/tasks` contracts must remain intact.
- Sanaa design tokens in `src/app/sana-tokens.css` and `design-tokens.css`; preserve Arabic RTL and English.
- Existing Vitest PGlite tests and scripts: `npm test`, `npm run typecheck`, `npm run build`.

## Data invariants
1. Never delete, rename or repurpose existing task/project/HR rows, primary keys or foreign keys.
2. WBS nodes, calendars and activities are **additional** entities. Activities can optionally reference existing project tasks. No automatic migration of legacy dates.
3. Preserve archived/deleted state and task-level authorization, reminders, reports, notifications, templates and HR bridge.
4. Changes must be scoped to a single authorized project. Read: admin, owner or current member (including viewer). Write: admin, owner or project manager. Archived projects are read-only.
5. Use project-level transactional locking for concurrent planning edits. Create audit records in the existing activity log in the same transaction.
6. Do not expose company-wide portfolio queries until company/tenant isolation and HR identity mapping are separately reviewed.
7. The current `task_dependencies` block execution; planning relationships will be added separately and MUST NOT silently change that meaning.

## Release policy / rollback
- Keep all work in `feature/enterprise-project-planning` and open a **draft** PR. Do not merge to main, deploy, or run production migrations without explicit approval.
- Before staging migration: capture a database-specific consistent backup, verify restore on a disposable instance, record table counts and original IDs, then run `0003_planning_foundation.sql` in staging. Production needs a new approval and a restore-tested backup.
- A deployment rollback is an application rollback to the previous commit; **do not drop new tables** to revert the application. Keep additive schema until a separately approved cleanup.
- Note: local PGlite automatically migrates on application start for development; a feature-branch checkout in a development environment will add the new tables. PostgreSQL production migrations are explicit.
- CI/test validation required before merge: `npm run typecheck`, `npm test`, `npm run build`, API permission checks, PGlite migration verification, RTL visual regression, production PostgreSQL concurrency/load checks.

## Phase 1 scope in this branch
- WBS hierarchy with project-unique codes and cycle checks.
- Project working calendars with IANA time zone, workdays, hours/day and date exceptions.
- Independent schedule activities with code, optional WBS/task/calendar links, duration, type, and **manually provided** planned dates.
- Project-scoped authorized API and audit events. No change to existing UI, Gantt or task models in this slice.
- Scheduling calculations, SS/FF/SF relationships, progress control, baselines, resource and cost functionality are **not** implemented in this slice and are intentionally deferred.

## Next slices
1. Phase 1 UI (WBS editor, activity register, calendar settings using the unchanged Sanaa tokens), with RTL/English tests.
2. Phase 2 scheduling (FS/SS/FF/SF, lag, constraints, working-calendar mathematics, forward/backward pass, float, longest path, schedule runs) with independent fixtures.
3. Phase 3 immutable baselines, actuals and controlled updates.
4. Phase 4 resource planning/leveling, phase 5 cost/EVM, phase 6 portfolio and enterprise controls.

### Data rule
A project in Sanaa Tasks is not assumed to have an engineering schedule until a manager explicitly creates activities and working calendars. Existing task completion, assignees and reminders remain authoritative in Tasks.
