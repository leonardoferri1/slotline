# Slotline

**Espaço para acontecer.** A local-first demonstration of a shared workspace booking product, with a React interface and a NestJS API backed by real PostgreSQL.

![Slotline workspace](docs/images/workspace.png)

Slotline explores a concrete engineering problem: multiple people can see the same free slot, but only one overlapping reservation may become active. The database enforces that invariant, while the application handles temporary holds, retries, expiry, authorization, and notifications.

## Run locally

Requirements: **Node.js 22+**, npm, and a supported desktop OS. Tested locally on Windows x64 with Node 26 and PostgreSQL 18.4. No cloud account, paid service, Docker, or API key is needed for the default path.

```sh
npm ci
npm run dev
```

- App: http://127.0.0.1:5178
- API documentation: http://127.0.0.1:3018/api/docs
- API health: http://127.0.0.1:3018/api/health

`npm run dev` starts a genuine PostgreSQL server using the `embedded-postgres` development package, applies versioned SQL migrations, seeds fictional demo accounts/resources, and starts both applications. Data persists in ignored `.local/postgres`. It binds to loopback; nothing is deployed. Stop with Ctrl+C. API edits require restarting; Vite updates the UI automatically.

The first dependency installation downloads PostgreSQL binaries. Installation scripts must be enabled. Ports 5178, 3018, and 55438 must be free. PostgreSQL refuses to run as root; use a normal OS user or the external-database path below.

### Demo accounts

| Account                 | Role          | Workspace                           |
| ----------------------- | ------------- | ----------------------------------- |
| `alex@slotline.local`   | Administrator | Ateliê Collective                   |
| `sam@slotline.local`    | Member        | Ateliê Collective                   |
| `taylor@slotline.local` | Member        | Separate organization; no resources |

All use **`Slotline-demo-2026!`**. These are public fictional development credentials, not production secrets. Demo seeding is explicitly rejected in production mode. The second workspace demonstrates isolation; use Alex or Sam for the booking experience.

### Bring your own PostgreSQL

```sh
docker compose up -d
```

Set `DATABASE_URL=postgresql://slotline:slotline-local-only@127.0.0.1:55438/slotline` in your shell and run `npm run dev`. In PowerShell, use `$env:DATABASE_URL = 'postgresql://slotline:slotline-local-only@127.0.0.1:55438/slotline'`. The local runner uses that database instead of starting an embedded server. Use a dedicated development database: the runner applies migrations and inserts demonstration data.

## What the MVP does

- Sign in/out with opaque server-side sessions and HttpOnly cookies.
- Browse three fictional spaces, capacities and a shared daily calendar.
- Place a five-minute hold; confirm or cancel it.
- Reject overlapping reservations, including under concurrent requests.
- Accept adjacent intervals using half-open `[start,end)` ranges.
- Replay a hold request safely with an `Idempotency-Key`.
- Enforce organization boundaries and owner/admin authorization.
- Expire holds both on demand and via a background worker.
- Record audit events and deliver durable in-app notifications through a transactional outbox.
- Run a real eight-request concurrency experiment in the UI, on a dedicated lab resource.
- Inspect structured request logs and generated OpenAPI documentation.

The calendar uses **America/Sao_Paulo**. API timestamps require explicit offsets and are stored as `timestamptz`. Reservations must start in the next 90 days and last from one minute to eight hours. Resource capacity describes the room; each resource is booked exclusively.

## Try the complete flow

1. Sign in as Alex; the calendar opens on tomorrow.
2. Choose a room, click **Nova reserva**, and enter a title and time interval.
3. Observe the five-minute countdown, then confirm the reservation.
4. Try the same interval again: the API rejects it with HTTP 409.
5. Cancel the original reservation and book the now-free interval.
6. Open **Atividade** and the notification bell to inspect the history.
7. Open **Laboratório** and execute the dispute: a clean slot produces one 201 and seven 409 responses. The winner is cancelled after the experiment. If the browser closes before cleanup, the hold expires normally.

For distinct-user concurrency, the integration suite races 20 requests across two independent sessions. Browser lab timings measure this local run only; they are not throughput or production-scale claims.

## Engineering decisions

| Concern                    | Implementation                                                  | Why                                                                                       |
| -------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Overlap integrity          | PostgreSQL GiST exclusion constraint                            | Preserves the invariant even if a writer bypasses application validation                  |
| State transitions          | Transaction + resource row lock                                 | Orders expiry, hold, confirmation and cancellation for the same resource                  |
| Retried requests           | User-scoped key, payload fingerprint, transaction advisory lock | Concurrent retries return the same reservation without duplicated events                  |
| Async side effects         | Transactional outbox + `FOR UPDATE SKIP LOCKED`                 | Reservation and event commit together; workers can divide pending work                    |
| Notification deduplication | Unique event ID in the local notification sink                  | Reprocessing does not duplicate in-app notifications                                      |
| Authentication             | Salted scrypt hashes; random sessions stored as SHA-256 digests | No bearer token exposed to browser JavaScript; session revocation is immediate            |
| Authorization              | Tenant-scoped queries and owner/admin checks                    | A resource identifier alone grants no access                                              |
| Deployment shape           | One API process and one database                                | A small product does not require microservices to exercise difficult consistency problems |

Read [architecture and trade-offs](docs/architecture.md), [API examples](docs/api.md), [verification](docs/verification.md), and [roadmap](docs/roadmap.md).

## Verification

```sh
npm run build
npm test
npm run format:check
npm audit --omit=dev
```

`npm test` creates an isolated temporary PostgreSQL cluster on port 55439, executes the HTTP integration suite against NestJS, then shuts it down. No in-memory database substitutes the concurrency tests. The test runner uses a separate database directory and never truncates your local demo data.

For CI or an existing disposable test database, set `DATABASE_URL` and `WORKER_DISABLED=true`, then run `npm run test:external`. This database must be dedicated and empty: fixtures and test records are inserted. GitHub Actions uses a disposable PostgreSQL service. There is no deployment workflow.

## Repository

```text
apps/api/src/         NestJS API, reservation domain, worker and authentication
apps/api/sql/         Versioned PostgreSQL migrations
apps/api/test/        Real HTTP + PostgreSQL integration tests
apps/web/src/         React product interface and live concurrency lab
scripts/             Local PostgreSQL and test orchestration
docs/                Architecture, verification, API examples and roadmap
```

## Deliberate MVP boundaries

Workspaces, users and resources are seeded fixtures; there is no public signup, invitation or resource-administration UI yet. Notifications remain in-app; no email is sent. Availability refreshes every five seconds, with authoritative conflict checks on writes. The worker shares the API process. Login throttling is per process. There is no Redis, external message broker, distributed tracing collector, billing, recurring reservations, calendar sync, resource opening-hours policy, production provisioning, or hosted environment.

See the roadmap for the next steps. These are explicit limits rather than implied production readiness.
