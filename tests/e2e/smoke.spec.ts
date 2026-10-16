import { expect, test } from '@playwright/test';

// The App Shell is wired (S1): React mounts, and the router's guards send a
// signed-out visitor from the Dashboard to Sign In.
test('web app sends a signed-out visitor to Sign In', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.locator('#root')).not.toBeEmpty();
});

test('api health endpoint is up', { tag: '@smoke' }, async ({ request }) => {
  const response = await request.get('http://localhost:3000/health');

  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: 'ok' });
});
