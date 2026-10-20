import { spawn } from 'node:child_process';
import { startDatabase } from './postgres.mjs';
const { pg, url } = await startDatabase(true);
try {
  const child = spawn(process.execPath, ['--test', 'apps/api/dist/test/integration.test.js'], {
    env: { ...process.env, DATABASE_URL: url, WORKER_DISABLED: 'true', NODE_ENV: 'test' },
    stdio: 'inherit',
    windowsHide: true,
  });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  process.exitCode = code ?? 1;
} finally {
  await pg.stop();
}
