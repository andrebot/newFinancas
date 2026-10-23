import { expect, test } from '@playwright/test';
import { categoryShapes, defaultCategoryShapes } from '../support/accountApi';
import {
  addMember, createHousehold, currentUser, listHouseholds, newCredentials, registerUser,
  signInThroughApi,
} from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';
import totpCode from '../support/totp';

// I7 — Onboard (X2) against the real API: registration, MFA enrollment with a
// real authenticator code, the first household and its Guided Setup (X2G):
// the mandatory first account, then the optional steps passed by. Core E2E
// journey #1 (BDT plan), with I5's check: the household.created event reached
// AccountManager, so the household holds the defaults in the creator's language.

test('a new user registers, enrolls MFA, creates and sets up their first household', {
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

  // Guided Setup: the first account is mandatory, the rest is optional.
  await expect(page).toHaveURL(/\/setup\/guided$/);
  await page.getByLabel(text('guidedSetup', 'account.name')).fill('Main Checking');
  await page.getByRole('button', { name: text('guidedSetup', 'account.submit') }).click();
  await page.getByRole('button', { name: text('guidedSetup', 'categories.continue') }).click();
  await page.getByRole('button', { name: text('guidedSetup', 'finish') }).click();
  await expect(page.getByRole('heading', {
    name: text('guidedSetup', 'complete.title', { household: 'Onboard Home' }),
  })).toBeVisible();
  await page.getByRole('button', { name: text('guidedSetup', 'complete.dashboard') }).click();

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

  // Seeded through the bus (I5), in the language they registered in.
  const signedIn = { accessToken: tokens.accessToken! };
  const [household] = await listHouseholds(request, signedIn);
  expect(await categoryShapes(request, signedIn, household!.id))
    .toEqual(defaultCategoryShapes('en-US'));
});

test('a member of a household with only the Owner\'s personal accounts skips Guided Setup', async ({
  page, request,
}) => {
  // The gate asks whether the household has an account of any visibility,
  // not whether the member can see one (OQ-198).
  const owner = await registerUser(request, { firstName: 'Paula', lastName: 'Private' });
  const household = await createHousehold(request, owner, 'Private Home', 'personal');
  const member = await registerUser(request, { firstName: 'Mia', lastName: 'Member' });
  await addMember(request, owner, household.id, { user: member, role: 'Member' });

  await signInThroughUi(page, member);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: text('shell', 'header.openMenu') })).toBeVisible();
});
