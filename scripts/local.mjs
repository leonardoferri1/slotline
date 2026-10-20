import { spawn } from 'node:child_process';
import { startDatabase } from './postgres.mjs';
const database = process.env.DATABASE_URL ? null : await startDatabase();
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? database.url,
  SEED_DEMO: 'true',
  PORT: '3018',
  WEB_ORIGIN: 'http://127.0.0.1:5178',
};
const api = spawn(process.execPath, ['apps/api/dist/src/main.js'], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});
const web = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--config',
    'apps/web/vite.config.ts',
    'apps/web',
    '--host',
    '127.0.0.1',
  ],
  { env, stdio: 'inherit', windowsHide: true },
);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill();
  web.kill();
  await Promise.all([
    new Promise((r) => (api.exitCode !== null ? r() : api.once('exit', r))),
    new Promise((r) => (web.exitCode !== null ? r() : web.once('exit', r))),
  ]);
  await database?.pg.stop();
  process.exit(code);
}
api.on('exit', (code) => {
  if (!stopping) stop(code ?? 1);
});
web.on('exit', (code) => {
  if (!stopping) stop(code ?? 1);
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
