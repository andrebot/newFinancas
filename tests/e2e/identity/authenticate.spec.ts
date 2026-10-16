import { expect, test } from '@playwright/test';
import { createHousehold, registerUser, type TestUser } from '../support/identityApi';
import { signInThroughUi, signOut, submitCredentials } from '../support/signIn';
import text from '../support/text';

// I7 — Authenticate (X1) against the real API: the two-step sign-in with a
// real authenticator code, a backup code instead, a refused password, and
// signing out.

let user: TestUser;

test.beforeEach(async ({ request }) => {
  user = await registerUser(request, { firstName: 'Sam', lastName: 'Signin' });
  await createHousehold(request, user, 'Signin Home');
});

test('a user signs in with their authenticator code and signs out again', async ({ page }) => {
  await signInThroughUi(page, user);
  await expect(page).toHaveURL(/\/$/);

  await signOut(page);

  // The session is over: the Dashboard sends them back to Sign In.
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('a wrong password is refused with the localized message', async ({ page }) => {
  await page.goto('/sign-in');
  await submitCredentials(page, { email: user.email, password: 'not-the-password' });

  await expect(page.getByText(text('errors', 'auth.invalid_credentials'))).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('a backup code signs the user in once, and only once', async ({ page }) => {
  const [backupCode] = user.recoveryCodes;

  /**
   * Signs in up to the second step, then enters the backup code.
   */
  const signInWithBackupCode = async () => {
    await page.goto('/sign-in');
    await submitCredentials(page, user);
    await page.getByRole('button', { name: text('signIn', 'code.useBackupCode') }).click();
    await page.getByLabel(text('signIn', 'backupCode.label')).fill(backupCode!);
    await page.getByRole('button', { name: text('signIn', 'backupCode.submit') }).click();
  };

  await signInWithBackupCode();
  await expect(page).toHaveURL(/\/$/);

  await signOut(page);
  await signInWithBackupCode();
  await expect(page.getByText(text('errors', 'auth.mfa_invalid'))).toBeVisible();
});
