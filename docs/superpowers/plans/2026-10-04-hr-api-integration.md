# SANA HR API integration — implemented

User supplied `D:\HR` as the integration source. No changes to existing modified HR files, credentials, employee records or authentication policy were made.

- [x] Inspect existing HR session/password API and manager resolver.
- [x] Add authenticated, read-only `/api/task` work-directory endpoint in HR, reusing session revocation and direct-manager SQL.
- [x] Replace TASK token entry with HR email/password login, exchanging credentials only server-to-server.
- [x] Keep HR session encrypted, directory request-scoped and authorization refreshed.
- [x] Block expired/disabled sessions, inactive employees and required password changes.
- [x] Configure localhost HR connection and separate real workspace storage.
- [x] Verify 30 TASK tests and production build.
- [x] Live HTTP: login page 200 with password autocomplete, no development selector; development token rejected 400; unauthenticated work and HR directory both 401.
- [ ] User real-account sign-in: requires the user to enter existing credentials in the app.

HR TypeScript check reports an unrelated pre-existing nullable-container error at `tmp/page-order-qa/entry.tsx:5`; no errors reported in the new route. Browser visual check was blocked by browser URL policy; no bypass attempted.

Production HR login has an additional hosting-platform gate; this local integration must not be described as verified for remote deployment. See README for that deployment limitation and bootstrap settings.
