import { expect, test } from '@playwright/test';
import { currentUser, newCredentials, signInThroughApi } from '../support/identityApi';
import text from '../support/text';
import totpCode from '../support/totp';

// I7 — Onboard (X2) against the real API: registration, MFA enrollment with a
// real authenticator code, and the first household. Core E2E journey #1 (BDT
// plan); its "default Categories exist" check joins once Categories do.

test('a new user registers, enrolls MFA and creates their first household', {
  tag: '@core',
}, async ({ page, request }) => {
  const user = newCredentials({ firstName: 'Olivia', lastName: 'Onboard' });

  await page.goto('/register');
  await page.getByLabel(text('registration', 'firstName')).fill(user.firstName);
  await page.getByLabel(text('registration', 'lastName')).fill(user.lastName);
  await page.getByLabel(text('registration', 'email')).fill(user.email);
  await page.getByLabel(text('registration', 'password'), { exact: true }).fill(user.password);
  await page.getByLabel(text('registration', 'confirm'), { exact: true }).fill(user.password);
  await page.getByRole('button', { name: text('registration', 'submit') }).click();

  await page.getByRole('button', { name: text('mfaEnrollment', 'method.continue') }).click();
  // The setup key, as the screen shows it: base32 in groups of four.
  const setupKey = await page.locator('code', { hasText: /^[A-Z2-7 ]+$/ }).innerText();
  await page.getByLabel(text('mfaEnrollment', 'setup.code')).fill(await totpCode(setupKey));

  const codesHeading = page.getByRole('heading', { name: text('mfaEnrollment', 'codes.title') });
  await expect(codesHeading).toBeVisible();
  // The input is visually hidden behind the kit's box: tick it as a user does,
  // through its label, then make sure it took.
  await page.getByText(text('mfaEnrollment', 'codes.saved')).click();
  await expect(page.getByRole('checkbox', { name: text('mfaEnrollment', 'codes.saved') }))
    .toBeChecked();
  await page.getByRole('button', { name: text('mfaEnrollment', 'codes.continue') }).click();

  await page.getByLabel(text('householdSetup', 'name')).fill('Onboard Home');
  await page.getByRole('button', { name: text('householdSetup', 'submit') }).click();

  // On the Dashboard.
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: text('shell', 'header.openMenu') }).click();
  const drawer = page.getByRole('navigation', { name: text('shell', 'drawer.label') });
  await expect(drawer.getByText('Onboard Home')).toBeVisible();
  await expect(drawer.getByText(text('shell', 'identity.greeting', { firstName: 'Olivia' })))
    .toBeVisible();

  // The account keeps the language they registered in, not the pt-BR column
  // default (OQ-161) — read from the API, since the page shows en-US either way.
  const tokens = await signInThroughApi(request, { ...user, totpSecret: setupKey });
  expect((await currentUser(request, tokens.accessToken!)).preferences.language).toBe('en-US');
});
