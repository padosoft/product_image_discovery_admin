import { expect, test } from '@playwright/test';

test('admin shell renders without console errors and supports theme toggle', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto('/admin/product-image-discovery');

  await expect(page.getByTestId('product-image-discovery-admin')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Product image discovery sections' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Requests section' })).toBeVisible();

  const themeButton = page.getByRole('button', { name: 'Switch to dark theme' });
  await expect(themeButton).toBeVisible();
  await themeButton.click();
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('admin shell keeps sidebar and main content separated on tablet', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await page.goto('/admin/product-image-discovery');

  const sidebar = page.getByTestId('pid-shell-sidebar');
  const header = page.getByTestId('pid-shell-header');
  const content = page.getByTestId('pid-shell-content');

  await expect(sidebar).toBeVisible();
  await expect(header).toBeVisible();
  await expect(content).toBeVisible();

  const sidebarBox = await sidebar.boundingBox();
  const headerBox = await header.boundingBox();
  const contentBox = await content.boundingBox();

  expect(sidebarBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();

  expect(headerBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width - 1);
  expect(contentBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
});

test('settings page creates and deletes a typed override', async ({ page }, testInfo) => {
  const settingKey = `e2e.${testInfo.project.name}.manual_review_threshold`;

  await page.goto('/admin/product-image-discovery/settings');

  await expect(page.getByRole('heading', { name: 'Create Setting' })).toBeVisible();
  await page.getByLabel('Setting key').fill(settingKey);
  await page.getByLabel('Client override').fill('77');
  await page.getByLabel('Setting value').fill('64');
  await page.getByLabel('Description').fill('E2E typed setting override');
  await page.getByRole('button', { name: 'Create setting' }).click();

  await expect(page.getByText('Setting created.')).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: settingKey });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Client 77');
  await expect(row).toContainText('64');

  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: `Delete ${settingKey}` }).getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Setting deleted.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: settingKey })).toHaveCount(0);
});

test('providers page replaces and clears write-only credentials', async ({ page }, testInfo) => {
  const providerCode = `e2e-${testInfo.project.name}-provider`;

  await page.goto('/admin/product-image-discovery/providers');

  await expect(page.getByRole('heading', { name: 'Create Provider' })).toBeVisible();
  await page.getByLabel('Code').fill(providerCode);
  await page.getByLabel('Name').fill('E2E Provider');
  await page.getByLabel('Driver').selectOption('fake');
  await page.getByLabel('API key action').selectOption('replace');
  await page.getByLabel('API key value').fill('e2e-key');
  await page.getByLabel('API secret action').selectOption('replace');
  await page.getByLabel('API secret value').fill('e2e-secret');
  await page.getByRole('button', { name: 'Create provider' }).click();

  await expect(page.getByText('Provider created.')).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: providerCode });
  await expect(row).toBeVisible();
  await expect(row).toContainText('key configured / secret configured');

  await row.getByRole('button', { name: 'Test' }).click();
  await expect(page.getByText('Provider test completed.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Provider test result' })).toContainText(providerCode);
  await expect(row).toContainText('empty');

  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('API secret action').selectOption('clear');
  await page.getByRole('button', { name: 'Save provider' }).click();

  await expect(page.getByText('Provider updated.')).toBeVisible();
  await expect(row).toContainText('key configured / secret missing');

  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: `Delete ${providerCode}` }).getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Provider deleted.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: providerCode })).toHaveCount(0);
});

test('trusted sources page creates policy flags and deletes the source', async ({ page }, testInfo) => {
  const domain = `e2e-${testInfo.project.name}.example.test`;

  await page.goto('/admin/product-image-discovery/trusted');

  await expect(page.getByRole('heading', { name: 'Create Trusted Source' })).toBeVisible();
  const form = page.locator('section.pid-panel').filter({ has: page.getByRole('heading', { name: 'Create Trusted Source' }) });
  await form.getByLabel('Client override').fill('77');
  await form.getByLabel('Domain', { exact: true }).fill(domain);
  await form.getByLabel('Source name').fill('E2E Supplier');
  await form.getByLabel('Source type').selectOption('supplier');
  await form.getByLabel('Trust score', { exact: true }).fill('91');
  await form.getByLabel('Allow auto publish').selectOption('true');
  await form.getByLabel('Requires manual review').selectOption('false');
  await form.getByLabel('Brand scope').fill('Acme');
  await form.getByLabel('URL patterns').fill(`https://${domain}/*`);
  await form.getByRole('button', { name: 'Create trusted source' }).click();

  await expect(page.getByText('Trusted source created.')).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: domain });
  await expect(row).toBeVisible();
  await expect(row).toContainText('auto publish');
  await expect(row).toContainText('Acme');

  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: `Delete ${domain}` }).getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Trusted source deleted.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: domain })).toHaveCount(0);
});
