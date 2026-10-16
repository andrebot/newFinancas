import { expect, test } from '@playwright/test';
import { newCredentials } from '../support/identityApi';
import text from '../support/text';
import totpCode from '../support/totp';

// I7 — Onboard (X2) against the real API: registration, MFA enrollment with a
// real authenticator code, and the first household. Core E2E journey #1 (BDT
// plan); its "default Categories exist" check joins once Categories do.

test('a new user registers, enrolls MFA and creates their first household', {
  tag: '@core',
}, async ({ page }) => {
  const user = newCredentials({ firstName: 'Olivia', lastName: 'Onboard' });

  await page.goto('/register');
  await page.getByLabel(text('registration', 'firstName')).fill(user.firstName);
  await page.getByLabel(text('registration', 'lastName')).fill(user.lastName);
  await page.getByLabel(text('registration', 'email')).fill(user.email);
  await page.getByLabel(text('registration', 'password'), { exact: true }).fill(user.password);
  await page.getByLabel(text('registration', 'confirm'), { exact: true }).fill(user.password);
  await page.getByRole('button', { name: text('registration', 'submit') }).click();

  await page.getByRole('button', { name: text('mfaEnrollment', 'method.continue') }).click();
  const setupKey = await page.locator('code').first().innerText();
  await page.getByLabel(text('mfaEnrollment', 'setup.code')).fill(totpCode(setupKey));

  const codesHeading = page.getByRole('heading', { name: text('mfaEnrollment', 'codes.title') });
  await expect(codesHeading).toBeVisible();
  await page.getByText(text('mfaEnrollment', 'codes.saved')).click();
  await page.getByRole('button', { name: text('mfaEnrollment', 'codes.continue') }).click();

  await page.getByLabel(text('householdSetup', 'name')).fill('Onboard Home');
  await page.getByRole('button', { name: text('householdSetup', 'submit') }).click();

  // On the Dashboard, still in the language they registered in (OQ-161).
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: text('shell', 'header.openMenu') }).click();
  const drawer = page.getByRole('navigation', { name: text('shell', 'drawer.label') });
  await expect(drawer.getByText('Onboard Home')).toBeVisible();
  await expect(drawer.getByText(text('shell', 'identity.greeting', { firstName: 'Olivia' })))
    .toBeVisible();
});
