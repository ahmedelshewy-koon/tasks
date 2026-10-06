# TASK V1 design

The supplied TASK brief is the product specification. Build a modular Next.js application with a warm neutral workspace, dark teal navigation, Inter / IBM Plex Sans Arabic, English and Arabic, RTL, responsive layouts, keyboard focus, and accessible task drawers. Exact SANA tokens are unavailable; initial tokens follow the supplied visual description and remain centralized for replacement.

## Architecture

One TypeScript modular monolith. React client uses TanStack Query against validated route handlers; services enforce permissions before database access. Drizzle models target PostgreSQL. An embedded PGlite database persists locally when PostgreSQL is absent in development. Production requires DATABASE_URL. No demo tasks or fabricated statistics.

## Identity and HR boundary

HR adapter validates a bearer token against /me and retrieves /employees and /employees/:id/direct-reports. These are explicit proposed adapter contracts, not claims about SANA's undocumented API. Store no passwords or organization hierarchy. User records contain HR IDs only; HR directory data stays in request memory. TASK admins are local grants. Signed HTTP-only sessions carry a short-lived encrypted HR token; revalidate identity on requests. Local development provides clearly labeled fixture identities, enabled explicitly and forbidden in production.

## Authorization

Admin controls all projects and tasks, including personal work. Managers create/own projects, add only current direct reports, and assign only current direct reports who are members. Manager status comes from live direct reports. Employees see project tasks only with membership, edit only assignments, create self-assigned tasks, and comment on visible project tasks. Personal work is visible only to its creator and admins; Team Tasks never bypasses this privacy. Assignee completion is changed only by that assignee or admin. Employees cannot reassign or move tasks to expand access.

## Data

Normalized users, admin grants, projects, memberships, sections, tasks (self-reference for subtasks), assignments, comments, attachments, notifications, and audit events. Dates are calendar dates. UUID primary keys. Parent and child share project and visibility. One level of subtasks in V1. Soft deletion preserves audit history; deleted objects and attachments cease being accessible. Transactional writes protect task/assignment/audit consistency. Row locking serializes competing updates.

## Completion

Every assigned user has their own completed flag. All complete => Done, some complete => In Progress. An explicit In Progress state with zero completions is allowed. For tasks with subtasks, displayed progress is completed subtasks / total, and Done additionally requires all subtasks Done. Project progress uses top-level tasks only. Removing an assignee recomputes completion; adding one reopens a completed task.

## Flows

Dashboard derives counts from visible work. My Tasks combines assignments and personal work; Team Tasks filters visible project work assigned to current direct reports. Project list, board, and month calendar share records. Filters combine title, status, priority, assignee, due range, project. Task drawer supports editing, individual completion, subtasks, comments, secure attachments, and audit timeline. Project create/edit includes owner, dates, status, members, sections. In-app notifications include assignment, comment, update, upcoming and overdue; scheduled job endpoint and on-open reconciliation deduplicate due reminders. Settings changes language; Admin manages grants and views environment-based HR settings.

## Verification and limits

Use real embedded PostgreSQL integration tests for permissions, persistence, atomic assignment completion, privacy, member/assignee validation, and notifications. Check TypeScript, production build, and browser workflows at desktop/mobile and RTL. Actual HR SSO interoperability and exact visual match require the real SANA contract/assets. Tokens must use HTTPS in production. Attachments are capped at 10 MiB and stored in the database for a simple V1; deployment operators provide database backups.
