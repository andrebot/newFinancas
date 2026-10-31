import { expect, test } from '@playwright/test';
import { choose, pick, typeDate } from '../support/controls';
import {
  UNIT, accountNamed, isoDay, listHoldings, recordTransaction, scheduleEntries,
  valuationSnapshots,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I9 — a fixed-term buy recorded in Record Transaction (FL15, in X6) against
// the real API: Core E2E journey #6 up to the schedule — the buy creates its
// own Holding (a second buy of the same CDB never accumulates into it, OQ-50),
// InvestmentProductEngine computes its schedule, and no Valuation Snapshot is
// written (OQ-51). The projection on the Holdings view joins with I10
// (OQ-201 F14).

/**
 * A Record Transaction text, as the drawer shows it.
 *
 * @param key - The message key.
 * @returns The en-US text.
 */
const recordText = (key: Parameters<typeof text<'recordTransaction'>>[1]): string => (
  text('recordTransaction', key)
);

test('a CDB bought in the browser gets its own Holding and schedule, and no snapshot', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Caio', lastName: 'Cdb' });
  const household = await createHousehold(request, owner, 'Fixed Income Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const today = new Date();
  const due = new Date(today.getFullYear() + 1, today.getMonth(), 15);
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  await page.getByRole('button', { name: text('manageFinances', 'record') }).click();
  const record = page.getByRole('dialog', { name: recordText('record.title') });
  await pick(record, recordText('field.group'), text('transactions', 'group.investment'));
  await pick(record, recordText('field.kind'), text('transactions', 'kind.investment_buy'));
  await choose(page, record, recordText('field.assetType'), text('assetTypes', 'cdb'));
  await record.getByLabel(recordText('field.ticker')).fill('CDB Banco Azul');
  await pick(record, recordText('field.rateType'), recordText('rateType.fixed'));
  await record.getByLabel(recordText('rateValue.fixed')).fill('12.5');
  await typeDate(record.getByLabel(recordText('field.dueDate')), isoDay(due));
  await pick(record, recordText('field.interestPayment'), recordText('interestPayment.monthly'));
  await record.getByLabel(recordText('amount.invested')).pressSequentially('1000000');
  await record.getByRole('button', { name: recordText('record.submit') }).click();
  await expect(page.getByText(recordText('recorded'))).toBeVisible();

  const [holding] = await listHoldings(request, owner, household.id, account.id);
  expect(holding).toMatchObject({
    assetType: 'cdb',
    ticker: 'CDB Banco Azul',
    quantity: UNIT,
    rate: { type: 'fixed', value: 125_000 },
    dueDate: isoDay(due),
    interestPayment: 'monthly',
  });
  const schedule = await scheduleEntries(request, owner, household.id, holding!.id!);
  // Monthly interest up to the due date, where the contract redeems — on the
  // next business day when the due date isn't one (Brazil's calendar, which
  // the Engine's own suite covers): within a week of it, whatever today is.
  expect(schedule.filter((entry) => entry.kind === 'interest_payment').length)
    .toBeGreaterThanOrEqual(11);
  const redemptions = schedule.filter((entry) => entry.kind === 'redemption');
  expect(redemptions).toEqual([expect.objectContaining({ postedAt: null })]);
  const weekAfter = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 7);
  const redeemed = redemptions[0]?.date ?? '';
  expect(redeemed >= isoDay(due) && redeemed < isoDay(weekAfter), redeemed).toBe(true);
  expect(await valuationSnapshots(request, owner, household.id, holding!.id!)).toEqual([]);

  // The same CDB bought again is its own contract: a second Holding.
  await recordTransaction(request, owner, household.id, {
    kind: 'investment_buy',
    accountId: account.id,
    date: isoDay(today),
    amount: 500_000,
    currency: 'BRL',
    assetType: 'cdb',
    ticker: 'CDB Banco Azul',
    rate: { type: 'fixed', value: 125_000 },
    dueDate: isoDay(due),
    interestPayment: 'monthly',
  });
  const holdings = await listHoldings(request, owner, household.id, account.id);
  expect(holdings.map(({ ticker, quantity }) => ({ ticker, quantity }))).toEqual([
    { ticker: 'CDB Banco Azul', quantity: UNIT },
    { ticker: 'CDB Banco Azul', quantity: UNIT },
  ]);
});
