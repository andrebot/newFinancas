import { expect, test, type Page } from '@playwright/test';
import { createBudget, seededCategories } from '../support/accountApi';
import { pick } from '../support/controls';
import {
  accountNamed, isoDay, monthOverview, monthStart, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import brl from '../support/money';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I9 — Record Transaction (FL15) and Month Overview (FL17), in Manage
// Finances (X6), against the real API: Core E2E journey #5 up to the Month
// Overview — an expense recorded in the browser accrues on the Budget that
// claims its Category and moves its account's balance, nothing mocked. The
// Dashboard's half joins with I11 (OQ-201 F14). And the Month Overview per
// period (Full E2E): the period bar moves the figures, the ledger stays whole.

/**
 * The figure a Month Overview summary shows under one of its terms.
 *
 * @param page - The browser page, on Transactions.
 * @param term - The term, e.g. `In`.
 * @returns Its definition.
 */
const figure = (page: Page, term: string) => (
  page.locator('dt', { hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]')
);

test('an expense recorded in the browser accrues on its Budget and moves the balance', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Eva', lastName: 'Expenses' });
  const household = await createHousehold(request, owner, 'Expenses Home');
  const categories = await seededCategories(request, owner, household.id);
  const groceries = categories.find((category) => category.name === 'Groceries')!;
  const budget = await createBudget(request, owner, household.id, {
    name: 'Food', categoryIds: [groceries.id],
  });
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  await page.getByRole('button', { name: text('manageFinances', 'record') }).click();
  const record = page.getByRole('dialog', { name: text('recordTransaction', 'record.title') });
  await pick(
    record,
    text('recordTransaction', 'field.kind'),
    text('transactions', 'kind.withdrawal'),
  );
  await record.getByLabel(text('recordTransaction', 'amount.label')).pressSequentially('4550');
  await pick(record, text('recordTransaction', 'field.category'), 'Groceries');
  await record.getByRole('button', { name: text('recordTransaction', 'record.submit') }).click();
  await expect(page.getByText(text('recordTransaction', 'recorded'))).toBeVisible();

  const budgets = page.getByRole('region', { name: text('monthRails', 'budgets') });
  await expect(budgets).toContainText(text('railCard', 'budget.left', { amount: brl(95_450) }));
  const balances = page.getByRole('region', { name: text('monthRails', 'balances') });
  await expect(balances).toContainText(brl(-4550));

  const overview = await monthOverview(request, owner, household.id, new Date());
  expect(overview.budgets).toEqual([expect.objectContaining({
    budgetId: budget.id, spendAmount: 4550,
  })]);
  expect(overview.balances).toContainEqual(expect.objectContaining({
    accountId: account.id, creditCardId: null, amount: -4550,
  }));
});

test('the period bar moves the Month Overview to another month, the ledger staying whole', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Pia', lastName: 'Period' });
  const household = await createHousehold(request, owner, 'Period Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const record = (kind: string, date: Date, amount: number, description: string) => (
    recordTransaction(request, owner, household.id, {
      kind, accountId: account.id, date: isoDay(date), amount, currency: 'BRL', description,
    })
  );
  await record('deposit', monthStart(-1), 500_000, 'Salary');
  await record('withdrawal', monthStart(0), 4_550, 'Lunch');
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  await expect(figure(page, text('monthOverview', 'in'))).toHaveText(brl(0));
  await expect(figure(page, text('monthOverview', 'out'))).toHaveText(brl(-4_550));

  const previous = monthStart(-1);
  if (previous.getFullYear() !== new Date().getFullYear()) {
    await page.getByRole('button', { name: text('periodBar', 'previousYear') }).click();
  }
  // A month's button is named by it and its figures, e.g. `Sep 2026: in …`.
  const short = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(previous);
  await page.getByRole('button', { name: new RegExp(`^${short} ${previous.getFullYear()}:`) })
    .click();

  await expect(figure(page, text('monthOverview', 'in'))).toHaveText(`+${brl(500_000)}`);
  await expect(figure(page, text('monthOverview', 'out'))).toHaveText(brl(0));
  // The account opened today, so both rows predate its anchor and walk its
  // history backward (OQ-169): the rail shows that month's end as the API has it.
  const [ending] = (await monthOverview(request, owner, household.id, previous)).balances;
  const balances = page.getByRole('region', { name: text('monthRails', 'balances') });
  await expect(balances).toContainText(brl(ending!.amount));
  // The ledger isn't scoped by the period: both months' rows stay listed.
  await expect(page.getByRole('button', { name: /Salary|Lunch/ })).toHaveCount(2);
});
