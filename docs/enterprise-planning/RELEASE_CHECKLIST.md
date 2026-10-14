# Sanaa Enterprise Planning — Implemented Scope and Release Gates

**Branch:** `feature/enterprise-project-planning`
**Review:** Draft PR #1; **not production ready**.
**Non-negotiable:** no merge to main, deployment, production migrations, or destructive database operations without explicit approval and a restore-tested backup.

## Existing features intentionally preserved
Task statuses, created/due dates, assignments, comments, attachments, historical IDs, existing task dependencies, reminders, HR login and reporting hierarchy, dashboards, original Gantt, Arabic/English RTL and Sanaa design tokens.
The new `Planning` view is additive; archived projects are read-only.

## Implemented on branch
1. WBS hierarchy (code uniqueness, cycle checks, permissions).
2. Schedule activities with optionally linked existing tasks, project calendars, exceptions, durations, optional Start-No-Earlier-Than constraint, manually entered planned dates.
3. Independent engineering links FS/SS/FF/SF with lag and cycle prevention; legacy task-blocking dependencies are untouched.
4. Read-only single-calendar CPM preview with early/late dates, float, critical path and visual Gantt. Explicitly save immutable, auditable calculated schedule runs when desired.
5. Immutable plan baselines, progress tracking and baseline comparison. Actual progress never overwrites task completion.
6. Manual planning resource directory, project-member HR identity validation, assignments and estimated weekly load alerts. No payroll/attendance writes or automatic leveling.
7. Manual project cost entries using integer minor currency units, currency-isolated BAC/EV/AC/PV/CPI/SPI. PV requires a fully dated baseline; unsupported forecasts show unavailable instead of fake figures.
8. Risk registry, quality warnings, scoped portfolio summary and CSV export hardened against formula injection.
9. Tests for PGlite and real isolated PostgreSQL migration upgrades; English desktop/Arabic mobile Playwright smoke.
10. Project/task hard purge lifecycle adjusted in existing service to safely manage planning foreign keys, with regression tests.
11. Two-person, auditable **change request and baseline approval** decisions. Requests can be submitted by project managers/owners; decisions require owner or admin, distinct from the requester (and the author for baselines). Approval never automatically modifies a schedule, task or budget. EVM uses only approved baselines.

## Limits — DO NOT describe this as full Oracle Primavera P6 parity
- CPM is integer *working-day* scheduling with one common calendar for each preview; per-activity calendars are stored but preview rejects mismatched calendars. Intraday shifts and complex calendar lag semantics are not supported.
- Only SNET scheduling constraint is supported; P6's other constraint families, data-date actualization, multiple float paths and global change are not implemented.
- No automatic resource leveling, full capacity optimization or time-phased staffing curve (weekly allocation is an estimate).
- HR employee ID validation against the live directory and project membership exists; HR leave, timesheets and availability are **not** synced.
- ERP actuals, procurement, and cost-center integrations are **not** implemented. Governance approvals are decision records only; executing an approved scope/budget change is an explicit subsequent authorized action.
- Company/tenant-wide isolation model requires a dedicated security review before a cross-company EPS; portfolio uses only existing visible project data.
- Primavera XER/P6 XML compatibility **not implemented or claimed**. The available interchange is safe CSV for schedule activities.
- The app has no committed production release, staging migration, restore-tested company backup or performance guarantee for large portfolios.

## Automated merge gates
- `npm run typecheck`
- `npm test`
- `npm run build`
- Isolated PostgreSQL service: upgrade from schema 0002 to migrations 0003–0009, preserve IDs/dates/comments, rerun idempotently.
- Isolated Playwright smoke using development-only identities, English desktop and Arabic mobile RTL.

## Manual pre-release gates
1. Inspect uncommitted local development work; fetch feature branch without overwriting changes.
2. Create consistent backup of the *actual* target development/staging database and verify restore on a disposable environment.
3. Check activity counts, task IDs, HR identity links and attachment counts before/after additive migration in staging.
4. Verify user flows: viewer read-only, two-person approval and rejection scenarios, project manager edits, finance read restrictions, cross-project isolation, archive/restore/permanent-purge, RTL and mobile.
5. Benchmark large WBS/activity/relationship graphs, concurrency and resource dashboard performance on PostgreSQL.
6. Approve rollout plan, rollback application version and monitoring; do not drop additive schema as a rollback shortcut.
7. Only after explicit operator approval: production backup, reviewed schema rollout, canary project, monitor, then staged feature activation.

## Developer commands on the laptop
```powershell
cd "D:\sana task"
git status
git fetch origin
git switch feature/enterprise-project-planning
git pull --ff-only origin feature/enterprise-project-planning
npm ci
npm run typecheck
npm test
npm run build
```
**Do not switch branch with uncommitted local work, and do not run `npm run dev` against an important unbacked local PGlite data folder.** In development mode startup applies pending migrations automatically to the configured local PGlite database. For PostgreSQL the SQL migrations are explicit and must be approved after backup.
