# HR dashboard tasks — 2026-10-04

Implemented the HR dashboard “My tasks / مهامي” panel in `D:/HR`, backed by a same-origin HR proxy and a read-only TASK endpoint. Identity is derived from the live HR session; caller-supplied user IDs are ignored. Only assigned tasks still visible under TASK permissions are returned, including subtasks. Deleted tasks/projects are excluded. The panel shows up to six tasks, outstanding work first, with a link to all tasks. Both services must be running.

Verification:

- TASK: 53 tests passed; TypeScript passed; production build passed after the final login redirect preservation change.
- HR: production build passed; 437 tests passed, 3 skipped, 5 failed in unrelated approval/translation checks (listed below).
- HR TypeScript: existing error in `tmp/page-order-qa/entry.tsx:5` (`HTMLElement | null` is not assignable to `Container`). No new-file errors reported.
- Live unauthenticated requests to both integration endpoints returned 401 and `Cache-Control: no-store`.
- Actual panel rendered with isolated test data and visually checked at desktop and 390px mobile widths, in Arabic. Test data was not inserted into employee databases.
- Initial real-account dashboard verification was unavailable because the accessible browser was signed out. After the user reported HTTP 503, live server logs identified a Workers incompatibility with `redirect: 'error'`. Changed the proxy to `redirect: 'manual'`, preserving rejection of non-2xx redirects. The user's active page subsequently generated successful `/api/task/my-tasks` HTTP 200 responses (787 ms and 1.2 s), confirming the authenticated round trip. No credentials or sessions were extracted or fabricated.
- Added two workerd/Miniflare regression tests: successful task retrieval and rejection of redirects without forwarding the session. Both failed before the fix and passed afterward. The full HR suite after this fix reports 439 passed, 3 skipped, and the same 5 unrelated failures listed below.

Failing HR checks:

1. `tests/arabic-navigation.test.mjs:50` — every API message the server can raise has an Arabic translation (approval-center message).
2. `tests/arabic-navigation.test.mjs:72` — every notification title the server emits has an Arabic title in the bell (attendance/request notification keys).
3. `tests/arabic-navigation.test.mjs:93` — Arabic wording keeps one term per concept (approval terminology).
4. `tests/employee-hr-routing.test.mjs:56` — request services validate routing before writes and HR notifications use assignment.
5. `tests/hr-responsibility.test.mjs:318` — workflows: routing, queues, notifications and reports use the effective resolver SQL, never only the raw override (`app/api/dashboard/route.ts`).

Configuration: HR uses `TASK_APP_URL`, with `http://127.0.0.1:3107` as the local development default. Production requires an explicit HTTPS origin. Existing HR production authentication deployment limitations still apply (see README).
