import { defineConfig, devices } from '@playwright/test';

const defaultPhpBinary = process.platform === 'win32'
  ? 'C:\\Users\\lopad\\.config\\herd\\bin\\php84\\php.exe'
  : 'php';
const phpBinary = process.env.PHP_BINARY || defaultPhpBinary;
const port = Number(process.env.PLAYWRIGHT_PORT || 8067);
const database = process.env.DB_DATABASE || `${process.cwd()}\\database\\playwright.sqlite`;
const appKey = process.env.APP_KEY || 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `"${phpBinary}" artisan serve --host=127.0.0.1 --port=${port}`,
    url: `http://127.0.0.1:${port}/admin/product-image-discovery`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
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
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
  ],
});
