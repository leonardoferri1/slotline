# Verification record

Initial local verification: 2026-10-19, Windows x64, Node 26.7.0, genuine PostgreSQL 18.4 via embedded-postgres.

## Automated integration suite

`npm test` runs HTTP requests against an actual NestJS listener and independent connections in a PostgreSQL pool. It verifies:

1. Authentication and cross-origin write rejection.
2. Twenty simultaneous acquisitions, alternating two user sessions: one success and nineteen conflicts.
3. Overlap rejection through direct SQL, bypassing the service entirely.
4. Ten concurrent identical retries: one reservation and one audit event; changed payload rejected.
5. Adjacent intervals, invalid durations, past starts and unknown input properties.
6. Cross-organization resource access, owner/admin checks and meeting-title privacy.
7. Idempotent confirmation/cancellation, terminal-state rejection and released availability.
8. Expired confirmation rejection with a committed expiry transition.
9. On-demand expiry without worker assistance.
10. Concurrent worker passes, expiry and deduplicated local notifications.
11. Transaction rollback without partial writes.
12. Invalid dates/UUIDs and session revocation.

These are correctness scenarios, not a throughput benchmark. No production traffic or scaling claim is implied.

## Browser checks

Manually exercised through the browser automation interface: login, create hold, countdown, confirm, concurrency laboratory, activity, cancellation, and responsive viewport inspection. Screenshots in `docs/images` show the actual local application. Browser checks are not yet a committed automated E2E suite.

## Build and dependencies

`npm run build` type-checks and builds both applications. `npm run format:check` checks source formatting. `npm audit --omit=dev` checks runtime dependency advisories at execution time. A root override selects patched js-yaml 4.3.2+ for Swagger's transitive dependency; the lockfile captures the verified resolution.

GitHub Actions repeats build, formatting and integration checks against a disposable PostgreSQL service. Its remote result should be inspected separately; a workflow file alone is not evidence of a passing CI run.
