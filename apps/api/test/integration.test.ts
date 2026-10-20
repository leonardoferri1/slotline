import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { Database } from '../src/database';
import { migrate } from '../src/migrate';
import { ids, seed } from '../src/seed';
import { Worker } from '../src/worker';
import { recordEvent } from '../src/reservations';
let app: INestApplication,
  db: Database,
  base: string,
  admin: string,
  member: string,
  outsider: string;
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = admin,
  key = randomUUID(),
  origin?: string,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie ?? '',
      'Idempotency-Key': key,
      ...(origin ? { Origin: origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
    response,
  };
}
function payload(offset: number, resourceId = ids.room) {
  const start = new Date(Date.now() + 86400000 + offset * 3600000);
  start.setSeconds(0, 0);
  return {
    resourceId,
    title: 'Teste de integração',
    startsAt: start.toISOString(),
    endsAt: new Date(+start + 3600000).toISOString(),
  };
}
before(async () => {
  app = await createApp(true);
  db = app.get(Database);
  await migrate(db.pool);
  await seed(db.pool);
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api';
  for (const [email, set] of [
    ['alex@slotline.local', (c: string) => (admin = c)],
    ['sam@slotline.local', (c: string) => (member = c)],
    ['taylor@slotline.local', (c: string) => (outsider = c)],
  ] as const) {
    const r = await request('/auth/login', 'POST', { email, password: 'Slotline-demo-2026!' }, '');
    assert.equal(r.status, 200);
    set(r.response.headers.get('set-cookie')!.split(';')[0]);
  }
});
after(async () => {
  await app?.close();
});
test('unauthenticated requests are rejected and cross-origin writes blocked', async () => {
  assert.equal((await request('/resources', 'GET', undefined, '')).status, 401);
  assert.equal(
    (
      await request(
        '/reservations',
        'POST',
        payload(0),
        admin,
        randomUUID(),
        'https://untrusted.example',
      )
    ).status,
    403,
  );
});
test('20 simultaneous requests across independent sessions produce exactly one winner', async () => {
  const body = payload(1);
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      request('/reservations', 'POST', body, i % 2 ? member : admin),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 19);
  assert.equal(
    (
      await db.pool.query(
        "SELECT count(*)::int AS n FROM reservations WHERE resource_id=$1 AND starts_at=$2 AND status='held'",
        [ids.room, body.startsAt],
      )
    ).rows[0].n,
    1,
  );
});
test('database exclusion constraint rejects overlap even when bypassing the service', async () => {
  const body = payload(3);
  const first = await request('/reservations', 'POST', body);
  assert.equal(first.status, 201);
  await assert.rejects(
    db.pool.query(
      "INSERT INTO reservations(id,organization_id,resource_id,user_id,title,starts_at,ends_at,status,expires_at) VALUES($1,$2,$3,$4,'Bypass',$5,$6,'confirmed',now())",
      [randomUUID(), ids.org, ids.room, ids.admin, body.startsAt, body.endsAt],
    ),
    (e: any) => e.code === '23P01',
  );
});
test('concurrent retries share one reservation and key cannot be reused for another payload', async () => {
  const body = payload(5),
    key = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 10 }, () => request('/reservations', 'POST', body, admin, key)),
  );
  assert.ok(results.every((r) => r.status === 201));
  assert.equal(new Set(results.map((r) => r.body.id)).size, 1);
  assert.equal(
    (await request('/reservations', 'POST', { ...body, title: 'Outro encontro' }, admin, key))
      .status,
    409,
  );
  assert.equal(
    (
      await db.pool.query('SELECT count(*)::int AS n FROM audit_events WHERE reservation_id=$1', [
        results[0].body.id,
      ])
    ).rows[0].n,
    1,
  );
});
test('adjacent half-open intervals succeed; overlapping and invalid intervals fail', async () => {
  const body = payload(7);
  assert.equal((await request('/reservations', 'POST', body)).status, 201);
  assert.equal(
    (
      await request('/reservations', 'POST', {
        ...body,
        startsAt: body.endsAt,
        endsAt: new Date(+new Date(body.endsAt) + 3600000).toISOString(),
      })
    ).status,
    201,
  );
  assert.equal(
    (await request('/reservations', 'POST', { ...body, endsAt: body.startsAt })).status,
    400,
  );
  assert.equal(
    (await request('/reservations', 'POST', { ...payload(10), extra: 'invalid' })).status,
    400,
  );
  assert.equal(
    (
      await request('/reservations', 'POST', {
        ...payload(10),
        startsAt: '2020-01-01T00:00:00Z',
        endsAt: '2020-01-01T01:00:00Z',
      })
    ).status,
    400,
  );
});
test('organization boundaries and reservation ownership are enforced', async () => {
  assert.deepEqual((await request('/resources', 'GET', undefined, outsider)).body, []);
  assert.equal((await request('/reservations', 'POST', payload(12), outsider)).status, 404);
  const owned = await request('/reservations', 'POST', payload(12));
  assert.equal(
    (await request(`/reservations/${owned.body.id}/cancel`, 'POST', undefined, member)).status,
    403,
  );
  assert.equal(
    (await request(`/reservations/${owned.body.id}/confirm`, 'POST', undefined, outsider)).status,
    404,
  );
  const day = new Date(owned.body.starts_at).toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
  const list = await request('/reservations?day=' + day, 'GET', undefined, member);
  assert.equal(list.body.find((r: any) => r.id === owned.body.id).title, 'Ocupado');
});
test('confirmation and cancellation are idempotent and cancellation releases availability', async () => {
  const body = payload(14);
  const r = await request('/reservations', 'POST', body);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await request(`/reservations/${r.body.id}/confirm`, 'POST')).body.status,
      'confirmed',
    );
  assert.equal((await request('/reservations', 'POST', body)).status, 409);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await request(`/reservations/${r.body.id}/cancel`, 'POST')).body.status,
      'cancelled',
    );
  assert.equal((await request(`/reservations/${r.body.id}/confirm`, 'POST')).status, 409);
  assert.equal((await request('/reservations', 'POST', body)).status, 201);
  assert.equal(
    (
      await db.pool.query('SELECT count(*)::int AS n FROM audit_events WHERE reservation_id=$1', [
        r.body.id,
      ])
    ).rows[0].n,
    3,
  );
});
test('expired holds cannot be confirmed and expiry commits despite conflict response', async () => {
  const body = payload(16);
  const r = await request('/reservations', 'POST', body);
  await db.pool.query("UPDATE reservations SET expires_at=now()-interval '1 second' WHERE id=$1", [
    r.body.id,
  ]);
  assert.equal((await request(`/reservations/${r.body.id}/confirm`, 'POST')).status, 409);
  assert.equal(
    (await db.pool.query('SELECT status FROM reservations WHERE id=$1', [r.body.id])).rows[0]
      .status,
    'expired',
  );
  assert.equal((await request('/reservations', 'POST', body)).status, 201);
});
test('a new request reclaims an expired hold without waiting for the worker', async () => {
  const body = payload(18);
  const r = await request('/reservations', 'POST', body);
  await db.pool.query("UPDATE reservations SET expires_at=now()-interval '1 second' WHERE id=$1", [
    r.body.id,
  ]);
  assert.equal((await request('/reservations', 'POST', body)).status, 201);
});
test('worker expires holds and delivers durable notifications exactly once in the local sink', async () => {
  const r = await request('/reservations', 'POST', payload(20));
  await db.pool.query("UPDATE reservations SET expires_at=now()-interval '1 second' WHERE id=$1", [
    r.body.id,
  ]);
  const worker = app.get(Worker);
  await Promise.all([worker.tick(), worker.tick()]);
  await worker.tick();
  assert.equal(
    (await db.pool.query('SELECT status FROM reservations WHERE id=$1', [r.body.id])).rows[0]
      .status,
    'expired',
  );
  const events = await db.pool.query('SELECT id FROM outbox WHERE reservation_id=$1', [r.body.id]);
  assert.equal(events.rowCount, 2);
  assert.equal(
    (
      await db.pool.query('SELECT count(*)::int AS n FROM notifications WHERE reservation_id=$1', [
        r.body.id,
      ])
    ).rows[0].n,
    2,
  );
  assert.equal(
    (await db.pool.query('SELECT count(*)::int AS n FROM outbox WHERE delivered_at IS NULL'))
      .rows[0].n,
    0,
  );
});
test('transaction rollback leaves no reservation, audit, or outbox partial write', async () => {
  const id = randomUUID();
  await assert.rejects(
    db.transaction(async (c) => {
      await c.query(
        "INSERT INTO reservations VALUES($1,$2,$3,$4,'Rollback',now()+interval '40 days',now()+interval '40 days 1 hour','held',now()+interval '5 minutes',now())",
        [id, ids.org, ids.studio, ids.admin],
      );
      await recordEvent(c, { id, organization_id: ids.org }, 'held', ids.admin);
      throw new Error('injected failure');
    }),
  );
  assert.equal((await db.pool.query('SELECT * FROM reservations WHERE id=$1', [id])).rowCount, 0);
  assert.equal(
    (await db.pool.query('SELECT * FROM outbox WHERE reservation_id=$1', [id])).rowCount,
    0,
  );
  assert.equal(
    (await db.pool.query('SELECT * FROM audit_events WHERE reservation_id=$1', [id])).rowCount,
    0,
  );
});
test('date validation, malformed identifiers, and logout are handled', async () => {
  assert.equal((await request('/reservations?day=2027-02-30')).status, 400);
  assert.equal((await request('/reservations/not-a-uuid/confirm', 'POST')).status, 400);
  assert.equal((await request('/auth/logout', 'POST', undefined, outsider)).status, 204);
  assert.equal((await request('/resources', 'GET', undefined, outsider)).status, 401);
});
