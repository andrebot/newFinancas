import { expect, test } from '@playwright/test';
import {
  createHousehold, refreshStatus, registerUser, signInThroughApi, type TestUser,
} from '../support/identityApi';
import { signInThroughUi, signOut, submitCredentials } from '../support/signIn';
import text from '../support/text';

// I7 — Manage Profile (X3) against the real API: personal info and
// preferences survive a reload, the session list shows this device, and a
// changed password is the one Sign In accepts.

let user: TestUser;

test.beforeEach(async ({ page, request }) => {
  user = await registerUser(request, { firstName: 'Pat', lastName: 'Profile' });
  await createHousehold(request, user, 'Profile Home');
  await signInThroughUi(page, user);
  await page.goto('/profile');
});

test('edited personal info is saved', async ({ page }) => {
  await page.getByLabel(text('profile', 'personal.firstName')).fill('Patricia');
  await page.getByRole('button', { name: text('profile', 'personal.save') }).click();
  await expect(page.getByText(text('profile', 'personal.saved'))).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(text('profile', 'personal.firstName'))).toHaveValue('Patricia');
});

test('theme and language preferences apply at once and are kept', async ({ page }) => {
  const html = page.locator('html');
  await page.getByRole('radiogroup', { name: text('profile', 'preferences.theme') })
    .getByText(text('profile', 'theme.light'), { exact: true }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByRole('radiogroup', { name: text('profile', 'preferences.language') })
    .getByText(text('profile', 'language.pt-BR'), { exact: true }).click();
  await expect(html).toHaveAttribute('lang', 'pt-BR');

  // A reload restores them from the server: what this browser remembers is
  // forgotten (apps/web config `theme`/`i18n` storage keys), the session kept.
  await page.evaluate(`localStorage.removeItem('financas.theme');
    localStorage.removeItem('financas.locale');`);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(html).toHaveAttribute('lang', 'pt-BR');
});

test('the user revokes another device, then signs out all the others', async ({
  page, request,
}) => {
  const tablet = await signInThroughApi(request, user);
  await page.reload();
  // This device, the API sign-in above and the one registration opened.
  const revokeButtons = page.getByRole('button', {
    name: new RegExp(`^${text('security', 'sessions.revoke')} `),
  });
  await expect(revokeButtons).toHaveCount(2);

  await revokeButtons.first().click();
  await expect(page.getByText(text('security', 'sessions.revoked'))).toBeVisible();
  await expect(revokeButtons).toHaveCount(1);

  await page.getByRole('button', { name: text('security', 'others.open') }).click();
  await page.getByRole('group', { name: text('security', 'others.message') })
    .getByRole('button', { name: text('security', 'others.confirm') }).click();
  await expect(page.getByText(text('security', 'others.done'))).toBeVisible();

  // Only this device is left, at the API too.
  await expect(revokeButtons).toHaveCount(0);
  expect(await refreshStatus(request, tablet.refreshToken!)).toBe(401);
  await page.reload();
  await expect(page.getByText(text('security', 'sessions.thisDevice'))).toBeVisible();
});

test('a changed password is the one Sign In accepts, and other devices are signed out', async ({
  page, request,
}) => {
  const newPassword = `${user.password}-changed`;
  const otherDevice = await signInThroughApi(request, user);
  await expect(page.getByText(text('security', 'sessions.thisDevice'))).toBeVisible();

  await page.getByLabel(text('security', 'password.current'), { exact: true }).fill(user.password);
  await page.getByLabel(text('security', 'password.new'), { exact: true }).fill(newPassword);
  await page.getByLabel(text('security', 'password.confirm'), { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: text('security', 'password.submit') }).click();
  await expect(page.getByText(text('security', 'password.changed'))).toBeVisible();

  // Every other session ended (FR-1.14); this one goes on.
  expect(await refreshStatus(request, otherDevice.refreshToken!)).toBe(401);

  await signOut(page);
  await submitCredentials(page, user);
  await expect(page.getByText(text('errors', 'auth.invalid_credentials'))).toBeVisible();
  await signInThroughUi(page, { ...user, password: newPassword });
  await expect(page).toHaveURL(/\/profile$/);
});
