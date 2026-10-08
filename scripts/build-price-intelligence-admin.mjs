// Builds the padosoft/laravel-ai-price-intelligence-admin SPA and copies it to
// public/vendor/price-intelligence-admin, where its PanelController serves it from.
// The package is installed from GitHub without prebuilt assets, so the output is committed:
// rerun `npm run build:price-intelligence-admin` after every update of the package.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const packageDir = join(root, 'vendor', 'padosoft', 'laravel-ai-price-intelligence-admin');
const distDir = join(packageDir, 'resources', 'dist');
const targetDir = join(root, 'public', 'vendor', 'price-intelligence-admin');

if (!existsSync(join(packageDir, 'package.json'))) {
  console.error('[price-intelligence-admin] Package not found: run composer install first.');
  process.exit(1);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const args of [['ci', '--no-audit', '--no-fund'], ['run', 'build']]) {
  const result = spawnSync(npm, args, { cwd: packageDir, stdio: 'inherit', shell: process.platform === 'win32' });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

rmSync(targetDir, { recursive: true, force: true });
cpSync(distDir, targetDir, { recursive: true });
console.log(`[price-intelligence-admin] Assets copied to ${targetDir}`);
