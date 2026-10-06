# TASK · SANA

A TypeScript task and project workspace with a Next.js UI, server-side authorization, PostgreSQL/Drizzle data model, and an isolated HR adapter.

## Start locally

Requires Node.js 20.9+ (verified here with Node 24).

```sh
npm ci
npm run setup:local
npm run dev
```

Open http://127.0.0.1:3107. The configured workspace uses real HR login (see below). On a fresh unconfigured checkout, `setup:local` creates development mode: choose **Local admin** initially to bootstrap TASK administration. The local manager has two direct-report fixture identities. These identities are development-only, explicitly labeled, and rejected in production. There are no seeded projects, tasks, or invented metrics.

Without `DATABASE_URL`, development persists PostgreSQL data using PGlite in `.data/postgres`. Do not run two app processes against the same PGlite directory. Use an ordinary PostgreSQL server for production or multiple processes. `.env.local` contains a generated session key and is excluded from Git.

## Implemented

- Projects with owners, dates, membership, sections, manual Active/Completed state, and task-derived progress.
- Shared list, board, and month calendar views; search and combined status, priority, assignee, due-date, and project filters.
- My Tasks, manager Team Tasks, dashboard counts, priority/employee summaries, and private personal tasks.
- My Team (فريقي): a separate manager directory of current HR reporting hierarchy (direct and indirect reports), including work email, job title, department, company and branch, even before tasks are assigned.
- Task drawers with editing, per-assignee completion, subtasks, comments, attachments, activity, and deletion.
- A task finishes only when every assignee and every subtask is complete. Parent progress uses completed subtasks; project progress counts top-level tasks.
- Admin-controlled TASK grants; last-admin removal is blocked. Admin can inspect and edit all work, including personal tasks.
- In-app assignment, comment, update, upcoming, and overdue notifications with deduplicated due reminders.
- English/Arabic interface, RTL/LTR, bundled fonts, responsive layouts, focus states, and Radix dialogs.
- Encrypted HTTP-only, SameSite session cookies; HR sessions validated on every authenticated request; no stored HR passwords.

## SANA HR API integration

This workspace is now configured for the HR project in `D:\HR` on `http://127.0.0.1:3000`.
Open TASK on http://127.0.0.1:3107 and sign in with your existing HR email/password.
The real workspace uses `.data/hr-postgres`; previous development data remains untouched in `.data/postgres`.

- TASK forwards credentials server-to-server to HR `POST /api/auth`. Passwords are not persisted or logged.
- HR issues its existing `koon_portal_session`; TASK encrypts it inside its HTTP-only session cookie.
- The new HR route `app/api/task/route.ts` exposes `GET /api/task`, authenticated by that HR session cookie. It returns `{me, employees, directReports}` and `Cache-Control: no-store`.
- The directory contains active accounts linked to active/probation/notice-period employees, and only work identity/organization fields. It is a shared work directory for authenticated staff, without salaries, personal contacts, documents or other private HR fields.
- Direct reports use HR's existing `EMPLOYEE_MANAGER_SQL`, including its department-manager fallback. TASK does not rebuild the organization tree.
- Disabled accounts, invalidated/expired sessions, inactive employment and required password changes block TASK access. Complete required password changes inside HR.
- `TASK_BOOTSTRAP_HR_ADMIN=true` allows the first authenticated HR Super Admin to bootstrap TASK administration when no TASK admin exists. Later grants remain TASK-managed. Set it false and configure `TASK_BOOTSTRAP_ADMINS` for explicit IDs instead.

Task assignment follows the live HR reporting hierarchy: project members can assign themselves or their direct/indirect reports who also belong to that project. Upward and sideways assignment is denied on both creation and reassignment. Project membership management uses the same descendant scope. TASK administrators retain their existing override; personal tasks remain self-assigned. Missing reporting links and hierarchy cycles do not grant access.

HR IDs are stable strings; `managerId` is an employee ID while assignment/member references use user IDs. Only IDs are persisted in TASK; directory details stay in request memory. `HR_API_URL` must point to the `/api/task` endpoint; login uses `/api/auth` on that same server. No shared HR signing secret or database credentials are needed.

Adapter tests cover credential exchange, password-change enforcement, cookie forwarding, HR-supplied direct reports and expired sessions. The live HR endpoint was verified to reject unauthenticated requests. A successful real-account sign-in still needs the user to enter their HR credentials in TASK; no passwords were extracted or test accounts added to HR.

The local HR login currently supports localhost/private-network development. Its production auth route also requires its hosting platform identity; remote deployment therefore needs a supported server-to-server auth flow on HR before this connector can be deployed there. Both services require HTTPS in production.

## Production

HR dashboard integration: HR now displays **My tasks / مهامي** using its existing login session. Its `/api/task/my-tasks` proxy calls TASK `/api/hr/tasks`, which validates that session against HR and returns only tasks assigned to that account and still visible under TASK permissions. Responses are not cached. The dashboard refreshes every 30 seconds and on focus; task links open the matching TASK drawer (TASK sign-in may be required).

Set `TASK_APP_URL` in the HR environment to the TASK server origin. Local HR development defaults to `http://127.0.0.1:3107`; production requires an explicit HTTPS origin reachable by HR and employees' browsers. This bridge is disabled in TASK's local fixture identity mode. Both services must be running.

1. Provision PostgreSQL, run `npm ci` and `npm run build`, then configure the required `.env.example` values in your deployment secret store: `DATABASE_URL`, `HR_API_URL` (HTTPS), `TASK_ORIGIN` (the exact public HTTPS origin, no trailing slash; production rejects all browser writes without it), a random `SESSION_SECRET` of at least 32 characters, and `CRON_SECRET`.
2. Set `TASK_BOOTSTRAP_ADMINS` to the HR user ID of the first admin. This applies only when no TASK admins exist. Later grants are managed inside TASK.
3. Run `npm run db:migrate` with `DATABASE_URL` in the process environment. Run migrations once, before starting app replicas. The script uses a dedicated connection and a migration ledger.
4. Run `npm start` behind an HTTPS reverse proxy (the public site must use HTTPS). It binds `0.0.0.0` on port 3107; set `PORT` to override. Migrations never run on startup. Do not use local development identities in production.
5. Configure a scheduler to POST `/api/jobs/due` every 5 minutes, with `Authorization: Bearer <CRON_SECRET>`. No emails are sent. Date-only deadlines are the end of the due date in Africa/Cairo. Reminders default to 24 hours before that instant, with 1-hour and 3-day options. The scheduler and workspace reads share the same calculation and unique notification key (recipient/task/kind/due date); changing a reminder does not resend a notification already delivered for that due date. Opening the workspace also reconciles due reminders for the current user.
6. Configure database backups and a reverse-proxy request body limit of at least 11 MB. Attachments are stored as database bytes, limited to 10 MiB each, and downloaded only after permission checks as `application/octet-stream`. Add malware scanning if required by your deployment's file policy.

Changing the session secret invalidates all sessions. Treat HR availability as an authentication dependency: authorization fails closed if HR is unavailable. An HR 401 clears the TASK session and returns the user to sign-in.

## Architecture

```text
src/app/             Next.js page, route handlers, shared design tokens/styles
src/db/              Drizzle schema, PostgreSQL/PGlite provider, migrations
src/modules/auth/    Encrypted sessions, HR identity validation, admin bootstrap
src/modules/hr/      HR interface, API adapter, gated local development adapter
src/modules/tasks/   Pure permission and aggregate-completion policies
src/modules/work/    Transactional project/task/comment/file/notification services
src/modules/shared/  Types, errors, origin enforcement
src/ui/              Shell, translations, task views, forms, drawer
drizzle/             Versioned SQL and schema snapshots
tests/               Policy, service, session and HTTP-boundary tests
```

Project changes and task mutations acquire project locks before parent/task locks, then recheck current permissions inside the transaction. These intentionally simple locks favor correctness over high write concurrency in V1. Audit and notification writes commit with their mutations. Soft deletion retains history and removes objects from normal access; recovery UI is outside this version.

## Checks

```sh
npm test
npm run typecheck
npm run build
# With a separate server explicitly using TASK_AUTH_MODE=development:
npm run test:api
```

Tests use real in-memory PostgreSQL via PGlite, including controlled interleavings for stale-assignment and deleted-parent races. HTTP smoke checks exercise sessions, all local roles, assignments, completion, privacy, comments, notifications, and unauthenticated rejection. They create temporary verification work and soft-delete it afterward. Browser checks covered project/task creation, comments, partial/all completion, list/board/calendar consistency, desktop widths, and Arabic/mobile navigation.

## Deliberate V1 limits

- Login uses the HR authentication API; redirect-based SSO is not implemented. Visual tokens follow the SANA design system: `src/app/design-tokens.css` (colors, type, spacing, radius, elevation) and `src/app/design-system.css` (buttons, inputs, badges, cards, shell).
- HR connection settings are environment-managed; Admin currently displays connection status and manages grants.
- Subtasks are one level deep. Board cards open the common task drawer for updates; there is no drag-and-drop shortcut.
- Workspace reads currently load the visible workspace in one response. Add database-level pagination and targeted aggregate queries before large deployments.
- Database-level permission tests run on PGlite; external PostgreSQL multi-process load testing remains a deployment check.
- No time tracking, goals, portfolios, sprints, Gantt, chat, AI agents, or custom report builders.

Implementation decisions and verification notes are in `docs/superpowers/`.

## Core project management

- Dependencies are directed, within one project, and editable by its manager/admin. Blocked is an indicator derived from the prerequisite task’s overall status; it does not replace To Do, In Progress, or Done. Circular additions are checked while holding the project lock.
- Dated milestones have Upcoming/Completed states and link to existing tasks/subtasks. Find them in project overview, Project Map, calendar, and reports. Task groups in the map are labeled stages to distinguish them from milestones.
- Checklists stay inside their task, with editable titles, completion, removal, and up/down ordering. They do not affect assignee completion or create standalone tasks.
- Reports have server-enforced admin/managed-project scope, combined task filters, status counts, existing employee/priority/project charts, full project map context, milestones, dependencies, overdue work, and detailed tables. Date range filters apply to task creation dates; a separate due-date filter is available. Print uses the browser’s print/PDF flow.
- Apply migration 0001_project_features before deployment. It is additive and preserves existing task/project/HR data. Local PGlite applies pending migrations on startup; restart an already running development server after updating the schema.
- No HR-owned records or HR task-editing routes are introduced.

## V1 advanced core

Apply migration `0002_advanced_core` before deployment (additive; local PGlite applies it on startup — restart a running dev server). It adds member roles, archive columns, health override, recurrence, tags, custom fields, templates and saved views, and backfills `project_id` on existing task activity.

- **Project roles**: Owner, Project Manager, Member, Viewer; admins keep full control. Owners/admins appoint project managers and change ownership (the previous owner stays as project manager). Project managers manage tasks, sections, milestones, custom fields and members, and may add people from the owner's HR team or their own reports; once someone is a member (not a viewer) they can assign them work. Members edit their assigned tasks and comment; viewers are read-only and cannot be assigned.
- **Archive before deletion**: managers/project managers archive and restore projects and tasks (subtasks follow their parent); archived work leaves lists, boards, calendars, reports, reminders and the HR bridge and is read-only. Admins permanently delete archived items from the Archive page. All three actions are logged; admins see an archive history.
- **Recurring tasks**: daily/weekly/monthly on top-level tasks with a due date. When the task becomes Done (all assignees and subtasks complete) the next one is created once, with title, description, assignees still assignable in the project, priority, project/section, checklist (unticked), tags and the next due date (skipping dates already past; month ends are clamped).
- **Project templates**: managers/admins save a project they manage as a template (sections, tasks, subtasks, milestones, priorities, dependencies, checklists, optional assignees; due dates stored as day offsets from the project start). New projects start Blank or From template. Assignees who are not members of the new project fall back to the owner. No task templates in V1.
- **Project health**: suggested On Track / At Risk / Off Track / Completed from progress, overdue tasks, overdue milestones, elapsed time vs. progress and the due date, with the reasons shown. Project managers can override it; overrides are logged.
- **Mentions**: `@` in comments autocompletes people who can see the task (project owner and members; creator and assignees for personal tasks). Mentions are stored by user ID, highlighted, and notify the mentioned person (“Mentioned you”). Viewers cannot comment.
- **Tags**, **custom fields** (text, number, select, date per project), and personal **saved views** (filters, sorting, grouping, visible columns and order) on My Tasks, Team Tasks and project lists.
- **Project views**: Overview (progress, health, milestones, overdue/upcoming tasks, team workload, recent activity, Project Map preview), List, Board, Calendar, Project Map, Activity (a filtered feed of meaningful events).
- **Workload** (managers/admins): open, in-progress, overdue, due-soon (3 days) and completed counts per person, by task count only, with busy/overloaded markers whose thresholds are shown on the page.

Browser verification: `TASK_TEST_URL=http://127.0.0.1:3108 node scripts/verify-advanced-core.mjs` against an isolated development instance (English desktop and Arabic mobile; it archives its verification project afterward).

Browser feature verification (use a separate development database/server): `TASK_TEST_URL=http://127.0.0.1:3108 node scripts/verify-project-features.mjs`. It creates temporary verification work, exercises actual controls in English and Arabic mobile RTL, and deletes its project afterward. Screenshots are saved under `.data/verification`.
