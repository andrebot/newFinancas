import { expect, test } from '@playwright/test';
import { typeDate } from '../support/controls';
import {
  accountBalances, accountNamed, isoDay, isoMonth, monthStart, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I9 — editing a ledger row (Browse Transactions FL16 → Record Transaction
// FL15, in X6) against the real API: Core E2E journey #7 — an expense moved
// to an earlier month shifts every month's balance from the one it lands in
// up to the one it left by the same amount, not just the landing month's.
// An account opens today (OQ-169), so the edit runs the backward walk; the
// forward cascade, after the anchor, needs an older account than E2E can
// arrange through the API. The journey spans past months only, so every row
// is dated before today — on the 1st, this month has no such day.

/** The months the journey spans: four back to last month. */
const MONTHS = [-4, -3, -2, -1] as const;

/**
 * The 10th of a month some months back — a day before today in each of them.
 *
 * @param offset - How many months away: negative.
 * @returns That day, as `YYYY-MM-DD`.
 */
const tenthOf = (offset: number): string => {
  const start = monthStart(offset);
  return isoDay(new Date(start.getFullYear(), start.getMonth(), 10));
};

test('an expense moved three months back shifts every balance it passes over', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Bia', lastName: 'Backdate' });
  const household = await createHousehold(request, owner, 'Backdate Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const spend = (date: string, amount: number, description: string) => recordTransaction(
    request,
    owner,
    household.id,
    {
      kind: 'withdrawal', accountId: account.id, date, amount, currency: 'BRL', description,
    },
  );
  // One small expense a month, so every month in the span has a balance row.
  await Promise.all([
    ...MONTHS.map((offset) => spend(tenthOf(offset), 1_000, `Bus pass ${offset}`)),
    spend(tenthOf(-1), 10_000, 'Rent'),
  ]);
  const range = { from: isoMonth(monthStart(-4)), to: isoMonth(monthStart(-1)) };
  const before = await accountBalances(request, owner, household.id, account.id, range);
  const landing = new Date(monthStart(-4).getFullYear(), monthStart(-4).getMonth(), 15);
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  await page.getByRole('button', { name: /Rent/ }).click();
  await page.getByRole('button', { name: text('browseTransactions', 'edit') }).click();
  const edit = page.getByRole('dialog', { name: text('recordTransaction', 'edit.title') });
  await typeDate(edit.getByLabel(text('recordTransaction', 'field.date')), isoDay(landing));
  await edit.getByRole('button', { name: text('recordTransaction', 'edit.submit') }).click();
  await expect(page.getByText(text('recordTransaction', 'saved'))).toBeVisible();

  const after = await accountBalances(request, owner, household.id, account.id, range);
  expect(before).toHaveLength(MONTHS.length);
  expect(after.map(({ year, month }) => [year, month]))
    .toEqual(before.map(({ year, month }) => [year, month]));
  // Every month from the landing one to the last before the one it left ends
  // 100,00 lower; the month it left ends the same. The account opened today, so its
  // balance now is the anchor and these movements walk backward (OQ-169).
  expect(after.map((row) => row.endingBalance)).toEqual(before.map((row, index) => (
    row.endingBalance - (index < MONTHS.length - 1 ? 10_000 : 0)
  )));
});
