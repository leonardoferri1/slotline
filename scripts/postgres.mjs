import EmbeddedPostgres from 'embedded-postgres';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
export async function startDatabase(test = false) {
  const password = test ? randomBytes(24).toString('hex') : 'slotline-local-only';
  const port = test ? 55439 : 55438;
  const databaseDir = resolve(test ? `.local/test-${Date.now()}` : '.local/postgres');
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'slotline',
    password,
    port,
    persistent: !test,
    authMethod: 'scram-sha-256',
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {},
    onError: (message) => {
      if (String(message).includes('FATAL')) console.error(message);
    },
  });
  if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='slotline'")).rowCount)
    await client.query('CREATE DATABASE slotline');
  await client.end();
  return { pg, url: `postgresql://slotline:${password}@127.0.0.1:${port}/slotline` };
}
