import { expect, test } from '@playwright/test';

test('web app loads and shows the product name', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Finance APP' })).toBeVisible();
});

test('api health endpoint is up', async ({ request }) => {
  const response = await request.get('http://localhost:3000/health');

  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: 'ok' });
});
