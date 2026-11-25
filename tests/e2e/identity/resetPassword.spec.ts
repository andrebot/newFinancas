import { expect, test } from '../support/test';
import { refreshStatus, registerUser, signInWithRecoveryCode } from '../support/identityApi';
import resetLinkSentTo from '../support/outbox';
import { signInThroughUi, submitCredentials } from '../support/signIn';
import text from '../support/text';

// V3 — Full E2E: password reset (uc-18, FR-1.13; Account Recovery Flow, OQ-147)
// through the email the API really sends, read back from the test outbox
// (OQ-260). The link works once; the reset ends every session.

test('a forgotten password is reset through the emailed link, which works only once', async ({
  page, request,
}) => {
  const user = await registerUser(request, { firstName: 'Rui', lastName: 'Reset' });
  const newPassword = `${user.password}-reset`;
  const otherDevice = await signInWithRecoveryCode(request, user);

  await page.goto('/sign-in');
  await page.getByRole('button', { name: text('signIn', 'credentials.forgotPassword') }).click();
  // Sign In's own field shares the "Email" label: wait for the step to swap.
  await expect(page.getByRole('heading', { name: text('accountRecovery', 'request.title') }))
    .toBeVisible();
  await page.getByLabel(text('accountRecovery', 'request.email')).fill(user.email);
  await page.getByRole('button', { name: text('accountRecovery', 'request.submit') }).click();
  await expect(page.getByText(text('accountRecovery', 'request.sentTitle'))).toBeVisible();

  const link = await resetLinkSentTo(user.email);
  await page.goto(link);
  await page.getByLabel(text('accountRecovery', 'newPassword.password'), { exact: true })
    .fill(newPassword);
  await page.getByLabel(text('accountRecovery', 'newPassword.confirm'), { exact: true })
    .fill(newPassword);
  await page.getByRole('button', { name: text('accountRecovery', 'newPassword.submit') }).click();
  await expect(page.getByText(text('accountRecovery', 'done.title'))).toBeVisible();

  // The reset signed out every device (FR-1.13).
  expect(await refreshStatus(request, otherDevice.refreshToken!)).toBe(401);

  // A used link is dead: the Flow sends the user back to ask for a new one.
  await page.goto(link);
  await page.getByLabel(text('accountRecovery', 'newPassword.password'), { exact: true })
    .fill(`${newPassword}-again`);
  await page.getByLabel(text('accountRecovery', 'newPassword.confirm'), { exact: true })
    .fill(`${newPassword}-again`);
  await page.getByRole('button', { name: text('accountRecovery', 'newPassword.submit') }).click();
  await expect(page.getByText(text('errors', 'password_reset.token_invalid'))).toBeVisible();
  await expect(page.getByLabel(text('accountRecovery', 'request.email'))).toBeVisible();

  await page.goto('/sign-in');
  await submitCredentials(page, user);
  await expect(page.getByText(text('errors', 'auth.invalid_credentials'))).toBeVisible();
  await signInThroughUi(page, { ...user, password: newPassword });
});
