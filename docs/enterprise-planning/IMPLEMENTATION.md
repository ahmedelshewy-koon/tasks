# Enterprise Project Planning — Sanaa Tasks

This branch extends, and does not replace, the production Tasks data model and Sanaa design system.

**Current implementation and rollout gates:** [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## Non-destructive architecture
- Existing project IDs, task IDs, task completion logic, comments, HR integrations, original Gantt, dashboard, reporting and UI remain the reference source of truth for operational Tasks.
- WBS, activities, dependencies, project calendars, schedule previews and saved runs are independent planning entities.
- `task_dependencies` continue to block execution; `planning_relationships` drive engineering CPM. They are not silently synchronized.
- Manual activity planned dates are not derived from existing task creation dates.
- Original project and task deletion workflows were amended with regression tests so archived permanent removal handles planning foreign keys safely.
- Project finance read access is restricted to admins, owners and project managers; all writes require owner/project-manager/admin authorization and audit logging.
- All planning migrations are additive; a production rollback should roll back app code, not drop data tables.

## Review and validation
Run `npm ci && npm run typecheck && npm test && npm run build` on a clean checkout. GitHub Actions also verifies upgrading a disposable PostgreSQL database while preserving old task data, and Playwright browser flows in English desktop and Arabic mobile RTL.

## Caveat
The result is an **enterprise-planning MVP**, not a feature-complete Oracle Primavera P6 clone. For unsupported capabilities, explicit remaining work and release approvals, read [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md). The Draft Pull Request must not be merged or deployed before an approved staging rollout and a restore-tested production backup.
