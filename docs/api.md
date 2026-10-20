# API guide

Interactive documentation: `http://127.0.0.1:3018/api/docs`. The UI uses a Vite same-origin `/api` proxy. Examples below use curl; use `curl.exe` on Windows PowerShell if `curl` is aliased.

```sh
curl -c cookies.txt -H "Content-Type: application/json" -d '{"email":"alex@slotline.local","password":"Slotline-demo-2026!"}' http://127.0.0.1:3018/api/auth/login
curl -b cookies.txt http://127.0.0.1:3018/api/resources
```

Choose an actual future date within 90 days, then send:

```http
POST /api/reservations
Content-Type: application/json
Idempotency-Key: a-unique-client-generated-key
Cookie: slotline=<session cookie>

{
  "resourceId": "30000000-0000-4000-8000-000000000001",
  "title": "Product planning",
  "startsAt": "2027-01-10T10:00:00-03:00",
  "endsAt": "2027-01-10T11:00:00-03:00"
}
```

The example date is illustrative and will eventually be outside the booking horizon. The response includes a reservation UUID, status `held`, and the database-generated expiry deadline. Retry the exact payload with the same key after a network failure. Reusing that key with different data returns 409. A replay returns the current reservation representation with HTTP 201; inspect `status` rather than assuming a fresh hold.

| Endpoint                               | Behavior                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/auth/login`                 | Authenticate; set HttpOnly cookie                                               |
| `GET /api/auth/me`                     | Current actor                                                                   |
| `POST /api/auth/logout`                | Revoke session, clear cookie; 204                                               |
| `GET /api/resources`                   | Organization resources                                                          |
| `GET /api/reservations?day=YYYY-MM-DD` | Reservations intersecting that São Paulo calendar day; includes terminal states |
| `POST /api/reservations`               | Acquire hold; Idempotency-Key required                                          |
| `POST /api/reservations/:id/confirm`   | Confirm unexpired hold                                                          |
| `POST /api/reservations/:id/cancel`    | Cancel and free interval                                                        |
| `GET /api/activity`                    | Last 30 authorized audit events                                                 |
| `GET /api/notifications`               | Last 30 notifications for current user                                          |
| `GET /api/health`                      | Database connectivity check                                                     |

Responses use camelCase for input DTOs and database snake_case fields for reservation output. The frontend declares the output contract explicitly; harmonizing generated client types is a roadmap item.

Errors: 400 invalid payload/date/key; 401 missing/expired session; 403 unauthorized action/origin; 404 resource outside caller scope or absent; 409 overlapping booking, incompatible idempotency key, or invalid transition; 429 excessive login attempts. Unexpected failures remain 500 and include a request ID header for log correlation.
