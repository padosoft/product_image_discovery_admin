import { existsSync, mkdirSync, closeSync, openSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const herdPhp = join(homedir(), '.config', 'herd', 'bin', 'php84', 'php.exe');
const phpBinary = process.env.PHP_BINARY
  || (process.platform === 'win32' && existsSync(herdPhp) ? herdPhp : 'php');
const database = resolve('database/playwright.sqlite');
const appKey = 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=';

const manifest = resolve('public/build/manifest.json');
if (!existsSync(manifest)) {
  console.error('[prepare-e2e] Vite assets not found. Run "npm run build" before "npm run e2e".');
  process.exit(1);
}

mkdirSync(dirname(database), { recursive: true });

if (!existsSync(database)) {
  closeSync(openSync(database, 'w'));
}

const env = {
  ...process.env,
  APP_ENV: 'testing',
  APP_KEY: appKey,
  APP_DEBUG: 'true',
  DB_CONNECTION: 'sqlite',
  DB_DATABASE: database,
  CACHE_STORE: 'array',
  SESSION_DRIVER: 'file',
  QUEUE_CONNECTION: 'sync',
  PRODUCT_IMAGE_DISCOVERY_ROUTE_MIDDLEWARE: 'api',
  PID_ADMIN_DEBUG_RUN_MIDDLEWARE: '',
};

const result = spawnSync(phpBinary, ['artisan', 'migrate:fresh', '--seed', '--force'], {
  stdio: 'inherit',
  env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
