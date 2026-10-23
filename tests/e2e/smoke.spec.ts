import { expect, test } from '@playwright/test';
import { categoryShapes, defaultCategoryShapes } from './support/accountApi';
import { createHousehold, registerUser, signInThroughApi } from './support/identityApi';

// Smoke (BDT plan): is the system fundamentally wired — not business rules.
// Run on every PR. The plan's transaction check joins once transactions exist.

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

test('registering returns an MFA enrollment whose first code opens a session', {
  tag: '@smoke',
}, async ({ request }) => {
  // registerUser fails on any non-2xx answer or a missing access token.
  const user = await registerUser(request, { firstName: 'Sid', lastName: 'Smoke' });

  expect(user.totpSecret).not.toBe('');
  expect(user.recoveryCodes).toHaveLength(10);
});

test('signing in returns a challenge whose MFA code opens a session', {
  tag: '@smoke',
}, async ({ request }) => {
  const user = await registerUser(request, { firstName: 'Sia', lastName: 'Smoke' });

  const tokens = await signInThroughApi(request, user);

  expect(tokens.accessToken).toBeTruthy();
  expect(tokens.refreshToken).toBeTruthy();
});

for (const locale of ['en-US', 'pt-BR'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`the signed-out pages load in ${locale}, ${theme}, with no missing text`, {
      tag: '@smoke',
    }, async ({ browser }) => {
      const { baseURL } = test.info().project.use;
      const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), locale });
      // The theme a returning visitor saved (apps/web config `theme.storageKey`).
      await context.addInitScript((saved) => {
        localStorage.setItem('financas.theme', saved);
      }, theme);
      const page = await context.newPage();
      // The web app warns through its logger when a catalog key is missing or broken.
      const i18nWarnings: string[] = [];
      page.on('console', (message) => {
        if (message.text().startsWith('[I18nUtility]')) i18nWarnings.push(message.text());
      });

      /**
       * Opens a page and waits for its heading.
       *
       * @param path - The page's address.
       */
      const open = async (path: string) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      };
      await open('/sign-in');
      await open('/register');
      await open('/forgot-password');

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(i18nWarnings).toEqual([]);
      await context.close();
    });
  }
}

test('a new household holds the default Categories', { tag: '@smoke' }, async ({ request }) => {
  const user = await registerUser(request, { firstName: 'Sol', lastName: 'Smoke' });

  const household = await createHousehold(request, user, 'Smoke Home');

  // Seeded by AccountManager once the bus delivers household.created, after
  // the household's 201 (I5): wait for it.
  await expect.poll(() => categoryShapes(request, user, household.id))
    .toEqual(defaultCategoryShapes('en-US'));
});
