import { expect, test } from '../support/test';
import { seededCategories } from '../support/accountApi';
import { showMonth } from '../support/controls';
import {
  accountNamed, isoDay, monthStart, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I9 — Browse Transactions (FL16, in X6) against the real API (Full E2E): the
// ledger lists the month the period bar selects (OQ-255), a page at a time —
// the next page loaded by scrolling, through the API's cursor — the filter
// narrows it to one Category, and another month lists that month's rows.

/** More rows than the API's first page (20) holds. */
const ROWS = 25;

/** Last month's rows: never listed while this month is on view. */
const OLDER = 3;

test('the ledger pages through the month, filters by Category and follows the month', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Bel', lastName: 'Browse' });
  const household = await createHousehold(request, owner, 'Browse Home');
  const categories = await seededCategories(request, owner, household.id);
  const groceries = categories.find((category) => category.name === 'Groceries')!;
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  // This month's rows on its 1st (never after today), and a few last month.
  await Promise.all(Array.from({ length: ROWS }, (_, index) => recordTransaction(
    request,
    owner,
    household.id,
    {
      kind: 'withdrawal',
      accountId: account.id,
      date: isoDay(monthStart(0)),
      amount: 1_000 + index,
      currency: 'BRL',
      description: `Purchase ${index}`,
      ...(index % 5 === 0 ? { categoryId: groceries.id } : {}),
    },
  )));
  await Promise.all(Array.from({ length: OLDER }, (_, index) => recordTransaction(
    request,
    owner,
    household.id,
    {
      kind: 'withdrawal',
      accountId: account.id,
      date: isoDay(monthStart(-1)),
      amount: 2_000 + index,
      currency: 'BRL',
      description: `Older ${index}`,
    },
  )));
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  const rows = page.getByRole('button', { name: /Purchase \d+/ });
  await expect(rows.first()).toBeVisible();
  await rows.last().scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(ROWS);
  const older = page.getByRole('button', { name: /Older \d+/ });
  await expect(older).toHaveCount(0);

  await page.getByRole('button', { name: text('manageFinances', 'filter'), exact: true }).click();
  const filter = page.getByRole('dialog', { name: text('browseTransactions', 'filter.title') });
  await filter.getByRole('group', { name: text('browseTransactions', 'filter.category') })
    .getByText('Groceries', { exact: true }).click();
  await filter.getByRole('button', { name: text('browseTransactions', 'filter.show') }).click();

  await expect(page.getByRole('heading', { name: text('browseTransactions', 'title.filtered') }))
    .toBeVisible();
  await expect(rows).toHaveCount(ROWS / 5);

  await page.getByRole('button', { name: text('browseTransactions', 'clearFilters') }).click();
  await showMonth(page, monthStart(-1));
  await expect(older).toHaveCount(OLDER);
  await expect(rows).toHaveCount(0);
});
