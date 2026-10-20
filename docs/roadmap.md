# Roadmap

## MVP delivered

- [x] NestJS + PostgreSQL + React application, runnable locally without Docker.
- [x] Authenticated roles and organization-scoped resources.
- [x] Holds, confirmation, cancellation, expiry, history and in-app notifications.
- [x] Exclusion constraint, row locks, idempotency and transactional outbox.
- [x] Real-database HTTP integration tests and a browser concurrency laboratory.
- [x] Versioned migrations, OpenAPI, structured logs and CI definition.

## Product next

- [ ] Admin flows for workspaces, members and resources; invitations and account recovery.
- [ ] Resource opening hours, blackout periods, approval rules and cancellation policies.
- [ ] Rescheduling as an atomic operation; recurring bookings with explicit conflict rules.
- [ ] Month/week views, filters, shareable URLs and server-side pagination.
- [ ] Email notifications with provider idempotency and delivery status.
- [ ] Timezone selection beyond the current São Paulo workspace.

## Engineering next

- [ ] Extract reusable UI components into the future React design system.
- [ ] Generate a typed API client from OpenAPI; unify response DTOs.
- [ ] Add repeatable browser end-to-end and visual regression suites.
- [ ] Add accessibility auditing beyond keyboard/modal and responsive checks.
- [ ] Distributed login throttling and cleanup/retention policies.
- [ ] Outbox delivery retries/backoff/dead-letter handling for external adapters.
- [ ] OpenTelemetry traces, metrics, load profiles and documented resource limits.
- [ ] Evaluate RLS, independent workers, SSE, and resource-level throughput only against measured requirements.

## Hosting

- [ ] Deployment is intentionally deferred. No environment is provisioned in this iteration.
