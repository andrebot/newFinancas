import { expect, test } from '../support/test';
import {
  accountNamed, getAccount, isoDay, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// V3 — Full E2E: deleting a ledger row (uc-03, FR-3.2; Browse Transactions
// FL16) in the browser. Only the row asked for goes, after its confirm, and
// its account's balance goes back to how it was without it.

test('a ledger row deleted after its confirm leaves the ledger and the balance', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Del', lastName: 'Delete' });
  const household = await createHousehold(request, owner, 'Delete Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const today = isoDay(new Date());
  const spend = (amount: number, description: string) => recordTransaction(
    request,
    owner,
    household.id,
    {
      kind: 'withdrawal', accountId: account.id, date: today, amount, currency: 'BRL', description,
    },
  );
  await spend(4_500, 'Pharmacy');
  await spend(1_200, 'Bakery');
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  await page.getByRole('button', { name: /Pharmacy/ }).click();
  await page.getByRole('button', { name: text('browseTransactions', 'delete'), exact: true })
    .click();
  await page.getByRole('button', { name: text('browseTransactions', 'delete.confirm') }).click();
  await expect(page.getByText(text('browseTransactions', 'deleted'))).toBeVisible();

  await expect(page.getByRole('button', { name: /Pharmacy/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Bakery/ })).toBeVisible();
  expect(await getAccount(request, owner, household.id, account.id))
    .toMatchObject({ currentBalance: account.currentBalance - 1_200 });
});
