import { expect, test } from '@playwright/test';
import { seededCategories } from '../support/accountApi';
import {
  accountNamed, isoDay, monthStart, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I9 — Browse Transactions (FL16, in X6) against the real API (Full E2E): the
// ledger lists every transaction, not just the period's, a page at a time —
// the next page loaded by scrolling, through the API's cursor — and the
// filter narrows it to one Category.

/** More rows than the API's first page (20) holds. */
const ROWS = 25;

test('the ledger pages through every transaction and filters by Category', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Bel', lastName: 'Browse' });
  const household = await createHousehold(request, owner, 'Browse Home');
  const categories = await seededCategories(request, owner, household.id);
  const groceries = categories.find((category) => category.name === 'Groceries')!;
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  // Spread over this month and the two before: the ledger ignores the period bar.
  await Promise.all(Array.from({ length: ROWS }, (_, index) => recordTransaction(
    request,
    owner,
    household.id,
    {
      kind: 'withdrawal',
      accountId: account.id,
      date: isoDay(monthStart(-(index % 3))),
      amount: 1_000 + index,
      currency: 'BRL',
      description: `Purchase ${index}`,
      ...(index % 5 === 0 ? { categoryId: groceries.id } : {}),
    },
  )));
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  const rows = page.getByRole('button', { name: /Purchase \d+/ });
  await expect(rows.first()).toBeVisible();
  await rows.last().scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(ROWS);

  await page.getByRole('button', { name: text('manageFinances', 'filter'), exact: true }).click();
  const filter = page.getByRole('dialog', { name: text('browseTransactions', 'filter.title') });
  await filter.getByRole('group', { name: text('browseTransactions', 'filter.category') })
    .getByText('Groceries', { exact: true }).click();
  await filter.getByRole('button', { name: text('browseTransactions', 'filter.show') }).click();

  await expect(page.getByRole('heading', { name: text('browseTransactions', 'title.filtered') }))
    .toBeVisible();
  await expect(rows).toHaveCount(ROWS / 5);
});
