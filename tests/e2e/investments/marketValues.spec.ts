import { expect, test } from '@playwright/test';
import { pick, typeDate } from '../support/controls';
import {
  UNIT, accountNamed, isoDay, recordTransaction, valuationSnapshots,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I10 — market value record, edit and delete with the Value History (Full E2E,
// uc-05/06/07, OQ-238): a stock bought through the API gets today's value in
// Holding Maintenance's Market value card (FL19), then the history drawer
// (K46) edits it, adds a past value and deletes today's. The buy's own
// snapshot is listed, locked "From a trade" (OQ-56). Each write is checked
// in the API.

/** What the stock cost: R$ 2.500,00. */
const COST = 250_000;

/**
 * A day some days before today, local time.
 *
 * @param days - How many days back.
 * @returns The day.
 */
const daysAgo = (days: number): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
};

/**
 * Writes a day as the en-US interface does.
 *
 * @param date - The day.
 * @returns E.g. `11/03/2026`.
 */
const usDate = (date: Date): string => new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

test('a market value is recorded, edited, added in the past and deleted', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Vera', lastName: 'Value' });
  const household = await createHousehold(request, owner, 'Value Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const bought = daysAgo(30);
  const buy = await recordTransaction(request, owner, household.id, {
    kind: 'investment_buy',
    accountId: account.id,
    date: isoDay(bought),
    amount: COST,
    currency: 'BRL',
    assetType: 'stock',
    ticker: 'ITSA4',
    quantity: 25 * UNIT,
  });
  const holdingId = buy.holdingId!;
  const today = new Date();
  const pastDay = daysAgo(10);

  await signInThroughUi(page, owner);
  await page.goto('/investments');
  await pick(
    page.locator('main'),
    text('trackInvestments', 'tabs.label'),
    text('trackInvestments', 'tab.holdings'),
  );
  await page.getByRole('button').filter({ hasText: 'ITSA4' }).click();
  const value = page.getByRole('region', { name: /ITSA4/ }).locator('section', {
    has: page.getByRole('heading', { name: text('holdingMaintenance', 'value.title') }),
  });

  // Today's value, in the card (As of starts at today).
  await value.getByLabel(text('holdingMaintenance', 'value.newValue', { symbol: 'R$' }))
    .pressSequentially('275000');
  await value.getByRole('button', { name: text('holdingMaintenance', 'value.save') }).click();
  await expect(page.getByText(text('holdingMaintenance', 'value.saved'))).toBeVisible();
  const recorded = (await valuationSnapshots(request, owner, household.id, holdingId))
    .find((snapshot) => snapshot.source === 'manual');
  expect(recorded).toMatchObject({ asOfDate: isoDay(today), valuation: 275_000 });

  await value.getByRole('button', { name: text('holdingMaintenance', 'value.editHistory') })
    .click();
  const drawer = page.getByRole('dialog', { name: 'ITSA4' });
  const saved = drawer.getByRole('list', { name: text('historyEditor', 'list') });
  await expect(saved.getByRole('listitem').filter({
    hasText: usDate(bought),
  })).toContainText(text('holdingMaintenance', 'history.trade'));

  // Edit today's value in place.
  const editName = text('historyEditor', 'edit', { date: usDate(today) });
  await drawer.getByRole('button', { name: editName }).click();
  const editForm = drawer.getByRole('form', { name: editName });
  const editValue = editForm.getByLabel(text('historyEditor', 'valueMoney', { symbol: 'R$' }));
  await editValue.clear();
  await editValue.pressSequentially('280000');
  await editForm.getByRole('button', { name: text('historyEditor', 'save') }).click();
  await expect(editForm).toBeHidden();

  // Add a value ten days back.
  await drawer.getByRole('button', { name: text('historyEditor', 'add') }).click();
  const addForm = drawer.getByRole('form', { name: text('historyEditor', 'newValue') });
  await typeDate(addForm.getByLabel(text('historyEditor', 'date')), isoDay(pastDay));
  await addForm.getByLabel(text('historyEditor', 'valueMoney', { symbol: 'R$' }))
    .pressSequentially('260000');
  await addForm.getByRole('button', { name: text('historyEditor', 'save') }).click();
  await expect(addForm).toBeHidden();
  await expect(saved.getByRole('listitem').filter({ hasText: usDate(pastDay) })).toBeVisible();
  await expect.poll(async () => (await valuationSnapshots(request, owner, household.id, holdingId))
    .filter((snapshot) => snapshot.source === 'manual')
    .map(({ asOfDate, valuation }) => ({ asOfDate, valuation }))
    .sort((first, second) => first.asOfDate!.localeCompare(second.asOfDate!)))
    .toEqual([
      { asOfDate: isoDay(pastDay), valuation: 260_000 },
      { asOfDate: isoDay(today), valuation: 280_000 },
    ]);

  // Delete today's, behind the confirm.
  const deleteName = text('historyEditor', 'delete', { date: usDate(today) });
  await drawer.getByRole('button', { name: deleteName }).click();
  await drawer.getByRole('button', { name: text('historyEditor', 'deleteConfirm'), exact: true })
    .click();
  await expect(page.getByText(text('holdingMaintenance', 'history.deleted'))).toBeVisible();
  const left = await valuationSnapshots(request, owner, household.id, holdingId);
  expect(left.map(({ source, asOfDate, valuation }) => ({ source, asOfDate, valuation }))
    .sort((first, second) => first.asOfDate!.localeCompare(second.asOfDate!)))
    .toEqual([
      { source: 'transaction', asOfDate: isoDay(bought), valuation: COST },
      { source: 'manual', asOfDate: isoDay(pastDay), valuation: 260_000 },
    ]);
});
