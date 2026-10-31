import { expect, test, type Page } from '@playwright/test';
import { pick } from '../support/controls';
import {
  UNIT, accountNamed, archiveHolding, getHolding, isoDay, monthStart, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I9 — a trade recorded and deleted in Manage Finances (FL15, FL16 in X6)
// against the real API: Core E2E journey #11 — selling a whole position
// archives its Holding (`system`) and deleting that sell brings it back; a
// Holding its user archived stays archived when a trade on it is deleted
// (OQ-80, FR-5.8). A user can archive only a matured Holding, and can't trade
// on one they archived, so that half deletes a partial sell of a matured CDB
// the user then archived (a redemption closes a position whole, OQ-171).

/**
 * Deletes a ledger row through its detail, behind the confirm.
 *
 * @param page - The browser page, on Transactions.
 * @param title - The row's title, e.g. `Sell · ITSA4`.
 * @returns Resolves once the deletion is toasted.
 */
const deleteRow = async (page: Page, title: string): Promise<void> => {
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await page.getByRole('button', { name: text('browseTransactions', 'delete') }).click();
  await page.getByRole('button', { name: text('browseTransactions', 'delete.confirm') }).click();
  await expect(page.getByText(text('browseTransactions', 'deleted'))).toBeVisible();
};

test('selling a whole position archives its Holding; deleting the sell restores it', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Seu', lastName: 'Seller' });
  const household = await createHousehold(request, owner, 'Seller Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const buy = await recordTransaction(request, owner, household.id, {
    kind: 'investment_buy',
    accountId: account.id,
    date: isoDay(monthStart(-1)),
    amount: 100_000,
    currency: 'BRL',
    assetType: 'stock',
    ticker: 'ITSA4',
    quantity: 10 * UNIT,
  });
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  await page.getByRole('button', { name: text('manageFinances', 'record') }).click();
  const record = page.getByRole('dialog', { name: text('recordTransaction', 'record.title') });
  await pick(
    record,
    text('recordTransaction', 'field.group'),
    text('transactions', 'group.investment'),
  );
  await pick(
    record,
    text('recordTransaction', 'field.kind'),
    text('transactions', 'kind.investment_sell'),
  );
  await pick(record, text('recordTransaction', 'field.holding'), 'ITSA4');
  await record.getByLabel(text('recordTransaction', 'quantity.investment_sell')).fill('10');
  await record.getByLabel(text('recordTransaction', 'amount.received')).pressSequentially('120000');
  await record.getByRole('button', { name: text('recordTransaction', 'record.submit') }).click();
  await expect(page.getByText(text('recordTransaction', 'recorded'))).toBeVisible();

  expect(await getHolding(request, owner, household.id, buy.holdingId!)).toMatchObject({
    quantity: 0, archivedAt: expect.any(String), archivedBy: 'system',
  });

  await deleteRow(page, text('browseTransactions', 'title.trade', {
    kind: text('transactions', 'kind.investment_sell'), ticker: 'ITSA4',
  }));

  expect(await getHolding(request, owner, household.id, buy.holdingId!)).toMatchObject({
    quantity: 10 * UNIT, archivedAt: null, archivedBy: null,
  });
});

test('a Holding its user archived stays archived when a trade on it is deleted', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Ari', lastName: 'Archive' });
  const household = await createHousehold(request, owner, 'Archive Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const buy = await recordTransaction(request, owner, household.id, {
    kind: 'investment_buy',
    accountId: account.id,
    date: isoDay(monthStart(-24)),
    amount: 200_000,
    currency: 'BRL',
    assetType: 'cdb',
    ticker: 'CDB Matured',
    quantity: 2 * UNIT,
    rate: { type: 'fixed', value: 120_000 },
    dueDate: isoDay(monthStart(-1)),
    interestPayment: 'at_maturity',
  });
  await recordTransaction(request, owner, household.id, {
    kind: 'investment_sell',
    accountId: account.id,
    date: isoDay(monthStart(-12)),
    amount: 110_000,
    currency: 'BRL',
    holdingId: buy.holdingId!,
    quantity: UNIT,
  });
  await archiveHolding(request, owner, household.id, buy.holdingId!);
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  await deleteRow(page, text('browseTransactions', 'title.trade', {
    kind: text('transactions', 'kind.investment_sell'), ticker: 'CDB Matured',
  }));

  expect(await getHolding(request, owner, household.id, buy.holdingId!)).toMatchObject({
    quantity: 2 * UNIT, archivedAt: expect.any(String), archivedBy: 'user',
  });
});
