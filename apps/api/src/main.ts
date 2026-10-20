import { createApp } from './app';
import { Database } from './database';
import { migrate } from './migrate';
import { seed } from './seed';
async function main() {
  const app = await createApp();
  const db = app.get(Database);
  await migrate(db.pool);
  if (process.env.SEED_DEMO === 'true') {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Demo seed is forbidden in production.');
    await seed(db.pool);
  }
  await app.listen(Number(process.env.PORT ?? 3018), '127.0.0.1');
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
