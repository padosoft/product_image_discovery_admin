import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('[run-php] Missing PHP script or command arguments.');
  process.exit(1);
}

const herdPhpBat = join(homedir(), '.config', 'herd', 'bin', 'php84.bat');
const herdPhpExe = join(homedir(), '.config', 'herd', 'bin', 'php84', 'php.exe');

const candidates = [
  process.env.PHP_BINARY,
  process.platform === 'win32' ? herdPhpBat : null,
  process.platform === 'win32' ? herdPhpExe : null,
  'php',
].filter(Boolean);

let lastError = null;

for (const candidate of candidates) {
  if (candidate !== 'php' && !existsSync(candidate)) {
    continue;
  }

  const isBatch = process.platform === 'win32' && /\.(bat|cmd)$/i.test(candidate);
  const result = spawnSync(candidate, args, {
    stdio: 'inherit',
    shell: isBatch,
  });

  if (result.error) {
    lastError = `${basename(candidate)}: ${result.error.message}`;
    continue;
  }

  process.exit(result.status ?? 0);
}

console.error(`[run-php] Unable to execute PHP. ${lastError ?? 'No PHP candidate was available.'}`);
process.exit(1);
