import { expect, type Page } from '@playwright/test';
import type { TestUser } from './identityApi';
import text from './text';
import totpCode from './totp';

/**
 * Fills and submits Sign In's password step.
 *
 * @param page - The browser page, already on Sign In.
 * @param credentials - The email and password to type.
 * @returns Resolves once the step is submitted.
 */
export const submitCredentials = async (
  page: Page,
  credentials: { readonly email: string; readonly password: string },
): Promise<void> => {
  await page.getByLabel(text('signIn', 'credentials.email')).fill(credentials.email);
  await page.getByLabel(text('signIn', 'credentials.password'), { exact: true })
    .fill(credentials.password);
  await page.getByRole('button', { name: text('signIn', 'credentials.submit') }).click();
};

/**
 * Signs a user in through the browser — both steps, the authenticator code
 * included — and waits for the app to land past Sign In.
 *
 * @param page - The browser page.
 * @param user - The user who signs in.
 * @returns Resolves once the user is signed in.
 */
export const signInThroughUi = async (page: Page, user: TestUser): Promise<void> => {
  await page.goto('/sign-in');
  await submitCredentials(page, user);
  await page.getByLabel(text('signIn', 'code.label')).fill(totpCode(user.totpSecret));
  await expect(page).not.toHaveURL(/\/sign-in$/);
};

/**
 * Signs the user out through the navigation drawer, back to Sign In.
 *
 * @param page - The browser page, signed in.
 * @returns Resolves once Sign In shows.
 */
export const signOut = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: text('shell', 'header.openMenu') }).click();
  await page.getByRole('button', { name: text('shell', 'account.signOut') }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
};
