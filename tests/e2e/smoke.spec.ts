import {
  expect, test, watchCspViolations, watchI18nWarnings,
} from './support/test';
import { categoryShapes, defaultCategoryShapes } from './support/accountApi';
import {
  accountNamed, getAccount, isoDay, recordTransaction,
} from './support/financeApi';
import { createHousehold, registerUser, signInThroughApi } from './support/identityApi';
import { signInThroughUi } from './support/signIn';
import { textIn } from './support/text';
import { dashboard } from './support/insightsApi';

// Smoke (BDT plan): is the system fundamentally wired — not business rules.
// Run on every PR.

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

test('a new household\'s Dashboard answers', { tag: '@smoke' }, async ({ request }) => {
  const user = await registerUser(request, { firstName: 'Dot', lastName: 'Smoke' });
  const household = await createHousehold(request, user, 'Smoke Dashboard');

  // dashboard fails on any non-2xx answer (I11): the Insights wiring, end to end.
  const report = await dashboard(request, user, household.id);

  expect(report.month).toMatch(/^\d{4}-\d{2}$/);
  expect(report.balances).toHaveLength(1);
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
      // Its own context, so the automatic CSP check doesn't see it: watch it here.
      const cspViolations = watchCspViolations(context);
      const page = await context.newPage();
      const i18nWarnings = watchI18nWarnings(page);

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
      expect(cspViolations).toEqual([]);
      await context.close();
    });
  }
}

/** A signed-in page to check: its address and, for a tabbed page, the tab it opens on. */
interface SignedInPage {
  readonly path: string;
  readonly tab?: string;
}

// Every signed-in page a member of a household with an account reaches, each
// tab included, as a new household first sees it (OQ-259). Onboard and Guided
// Setup need a user without a household or an account, so their journeys cover them.
const SIGNED_IN_PAGES: readonly SignedInPage[] = [
  { path: '/' },
  { path: '/transactions' },
  ...['accounts', 'categories', 'budgets', 'goals'].map((tab) => ({ path: '/account-setup', tab })),
  ...['overview', 'holdings', 'rates'].map((tab) => ({ path: '/investments', tab })),
  { path: '/household' },
  { path: '/profile' },
  { path: '/households/new' },
];

for (const locale of ['en-US', 'pt-BR'] as const) {
  test(`the signed-in pages load in ${locale} with no missing text`, {
    tag: '@smoke',
  }, async ({ page, request }) => {
    // The app takes the language the user registered in once they sign in;
    // Sign In itself runs in the browser's en-US, as signInThroughUi expects.
    const user = await registerUser(request, { firstName: 'Lia', lastName: 'Smoke' }, locale);
    await createHousehold(request, user, 'Smoke Pages');
    const i18nWarnings = watchI18nWarnings(page);
    const localText = textIn(locale);

    /**
     * Opens a signed-in page and waits until it shows what was asked for — the
     * address and tab, not a fallback — in the user's language, with its data.
     *
     * @param target - The page, and the tab it opens on.
     */
    const open = async ({ path, tab }: SignedInPage) => {
      const address = tab ? `${path}?tab=${tab}` : path;
      await page.goto(address);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // An unknown address goes to the Dashboard, an unknown tab to the first one.
      expect(new URL(page.url()).pathname).toBe(path);
      if (tab) await expect(page.locator(`input[type="radio"][value="${tab}"]`)).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      // Let the page's data arrive, so the texts it renders are checked too.
      await page.waitForLoadState('networkidle');
    };

    await signInThroughUi(page, user);
    // One page after the other (no await in a loop — Airbnb): each page is
    // checked once the one before it settled.
    await SIGNED_IN_PAGES.reduce(
      (previous, target) => previous.then(() => open(target)),
      Promise.resolve(),
    );
    // The drawers every member opens: the navigation menu and Record Transaction.
    await page.goto('/transactions');
    await page.getByRole('button', { name: localText('manageFinances', 'record') }).click();
    await expect(page.getByRole('dialog', { name: localText('recordTransaction', 'record.title') }))
      .toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: localText('shell', 'header.openMenu') }).click();
    await expect(page.getByRole('button', { name: localText('shell', 'account.signOut') }))
      .toBeVisible();

    expect(i18nWarnings).toEqual([]);
  });
}

test('a new household holds the default Categories in its creator\'s language', {
  tag: '@smoke',
}, async ({ request }) => {
  // pt-BR, the primary locale; core journey #1 checks en-US (OQ-117).
  const user = await registerUser(request, { firstName: 'Sol', lastName: 'Smoke' }, 'pt-BR');

  const household = await createHousehold(request, user, 'Smoke Home');

  // Seeded by AccountManager once the bus delivers household.created, after
  // the household's 201 (I5): wait for it.
  await expect.poll(() => categoryShapes(request, user, household.id))
    .toEqual(defaultCategoryShapes('pt-BR'));
});

test('recording a transaction moves its account\'s balance', { tag: '@smoke' }, async ({
  request,
}) => {
  const user = await registerUser(request, { firstName: 'Sam', lastName: 'Smoke' });
  const household = await createHousehold(request, user, 'Smoke Ledger');
  const account = await accountNamed(request, user, household.id, 'Main Checking');

  await recordTransaction(request, user, household.id, {
    kind: 'withdrawal',
    accountId: account.id,
    date: isoDay(new Date()),
    amount: 12_345,
    currency: 'BRL',
  });

  expect(await getAccount(request, user, household.id, account.id))
    .toMatchObject({ currentBalance: account.currentBalance - 12_345 });
});
