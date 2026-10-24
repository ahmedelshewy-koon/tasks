# Sanaa Tasks — Safe Primavera Removal (REVIEW BRANCH)

**Status: Draft for code review; NOT validated for merging or production.**

## Approach
- Target project state: GitHub commit `8c0f5e76d6fc79d3d76d91978dca61f5930d7f9f` (before Primavera/enterprise planning).
- Proposed rollback compares to GitHub `main` at `c39dd7271764af0b9913e9455b88d5273f0f8082`.
- Restore original Tasks, HR auth and layout from the pre-planning baseline.
- Re-apply cross-department task-assignment approvals from commit `39ed010203542cba8ecca6fa4835dd00db902a60`, including the bilingual UI, manager policy, service/API and tests.
- Keep current standalone Next.js packaging, base CI, read-only deployment preflight and production deploy workflow unchanged.
- **Keep all existing SQL migration files 0000–0011 and the journal unchanged**, including unused planning tables. These represent historical schema changes and must NOT be deleted or reversed from live databases.

## Changes excluded
- Old and new Primavera-like planning UI, WBS/scheduling/CPM, baselines, portfolio, planning controls, resource/cost planning, and site-dispatch planning extension.
- Planning endpoints, services, related UI views and planning-only tests, scripts and workflows.
- Local unpublished Phases 1–8 are NOT changed by this GitHub branch; those remain on the user's computer until separately reverted locally.

## Mandatory approval gates before merge
1. Protect local dirty changes and make a verified cold backup of the actual local DB and all files.
2. Confirm current production commit, migration ledger and backup/restore capacity.
3. Run npm ci, npm run typecheck, npm test and npm run build on this branch.
4. Verify migration compatibility using a throwaway DB restored from a recent representative snapshot; no database replacement or down-migrations.
5. Browser-test HR login, original Tasks (projects, tasks, attachments, comments, notifications) and cross-department approval; verify Arabic RTL.
6. Fix any test/compatibility issues; only then obtain explicit authorization for merging into main.

## Safety
This branch does not run production deploy; that workflow triggers only on a push to main.
Do not merge, deploy, force-push, drop database tables or alter production without separate review and approval.
