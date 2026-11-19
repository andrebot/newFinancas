import { type Locator } from '@playwright/test';
import { expect, test } from '../support/test';
import { createAccount } from '../support/accountApi';
import { pick, typeDate } from '../support/controls';
import {
  accountTransactions, daysAgo, isoDay, usDate,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// Record Transaction keeps what the last record left (OQ-257), against the
// real API (Full E2E): "Record and add another" records and opens a fresh
// drawer on the same kind, account and date, the amount empty; after a plain
// record the next new drawer opens on them too, until the page reloads.

/**
 * Checks that the drawer stands on a withdrawal from an account, on a date,
 * its amount empty.
 *
 * @param record - The open drawer.
 * @param account - The account's name.
 * @param date - The date, as `YYYY-MM-DD`.
 * @returns Resolves once all four hold.
 */
const expectPrefilled = async (record: Locator, account: string, date: Date) => {
  await expect(record.getByRole('radiogroup', { name: text('recordTransaction', 'field.kind') })
    .getByRole('radio', { name: text('transactions', 'kind.withdrawal'), exact: true }))
    .toBeChecked();
  await expect(record.getByRole('radiogroup', {
    name: text('recordTransaction', 'field.account.out'),
  }).getByRole('radio', { name: new RegExp(`^${account}`) })).toBeChecked();
  await expect(record.getByLabel(text('recordTransaction', 'field.date')))
    .toHaveValue(usDate(date));
  await expect(record.getByLabel(text('recordTransaction', 'amount.label'))).toHaveValue('');
};

test('a batch of similar transactions keeps its kind, account and date', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Bia', lastName: 'Batch' });
  const household = await createHousehold(request, owner, 'Batch Home');
  const savings = await createAccount(request, owner, household.id, {
    name: 'Savings', visibility: 'shared',
  });
  const day = daysAgo(3);
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  const openRecord = () => page.getByRole('button', { name: text('manageFinances', 'record') })
    .first().click();
  const record = page.getByRole('dialog', { name: text('recordTransaction', 'record.title') });
  const amount = record.getByLabel(text('recordTransaction', 'amount.label'));

  await openRecord();
  await pick(
    record,
    text('recordTransaction', 'field.kind'),
    text('transactions', 'kind.withdrawal'),
  );
  // An account option carries its currency tag: its label is clicked, found by its radio.
  await record.getByRole('radiogroup', { name: text('recordTransaction', 'field.account.out') })
    .locator('label', { has: page.getByRole('radio', { name: /^Savings/ }) }).click();
  await typeDate(record.getByLabel(text('recordTransaction', 'field.date')), isoDay(day));
  await amount.pressSequentially('1000');
  await record.getByRole('button', { name: text('recordTransaction', 'record.another') }).click();

  await expect(page.getByText(text('recordTransaction', 'recorded'))).toBeVisible();
  await expectPrefilled(record, 'Savings', day);
  await amount.pressSequentially('2500');
  await record.getByRole('button', { name: text('recordTransaction', 'record.submit') }).click();
  await expect(record).toBeHidden();

  // A plain record closes; the next new drawer still opens on what it left.
  await openRecord();
  await expectPrefilled(record, 'Savings', day);

  const recorded = await accountTransactions(request, owner, household.id, savings.id);
  expect(recorded.map(({ kind, amount: value, date }) => ({ kind, amount: value, date })))
    .toEqual(expect.arrayContaining([
      { kind: 'withdrawal', amount: 1000, date: isoDay(day) },
      { kind: 'withdrawal', amount: 2500, date: isoDay(day) },
    ]));
  expect(recorded).toHaveLength(2);
});
