import { expect, test } from '@playwright/test';
import type { MyHousehold } from '@financas/api-types';
import { listAccounts, listBudgets, seededCategories } from '../support/accountApi';
import { registerUser, send } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I8 — Guided Setup (FL6, in X2G) against the real API, past what core journey
// #1 does: an Owner who dropped off before their first account is brought back
// to it on sign-in (FR-1.22, OQ-198), and sets a budget on the way through,
// the inline forms sending Account Setup's own requests (Full E2E).

test('an Owner who dropped off resumes Guided Setup and sets a budget', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Dora', lastName: 'Dropoff' });
  // The household Household Setup created, before any account.
  const household = await send<MyHousehold>(request, 'POST', '/households', {
    data: { name: 'Dropoff Home' },
    accessToken: owner.accessToken,
  });
  await seededCategories(request, owner, household.id);

  await signInThroughUi(page, owner);
  await expect(page).toHaveURL(/\/setup\/guided$/);
  await page.getByLabel(text('guidedSetup', 'account.name')).fill('Joint Checking');
  await page.getByRole('button', { name: text('guidedSetup', 'account.submit') }).click();
  await page.getByRole('button', { name: text('guidedSetup', 'categories.continue') }).click();

  await page.getByLabel(text('budgetManagement', 'field.name')).fill('Food');
  await page.getByLabel(text('budgetManagement', 'field.target')).pressSequentially('120000');
  await page.getByRole('group', { name: text('budgetManagement', 'covers.label') })
    .getByText('Groceries', { exact: true }).click();
  await page.getByRole('button', { name: text('guidedSetup', 'budget.create') }).click();
  // A BRL amount keeps BRL's format for an en-US user (NFR-I18N-2).
  await expect(page.getByText(text('guidedSetup', 'budget.row', {
    name: 'Food', amount: 'R$ 1.200,00',
  }))).toBeVisible();
  await page.getByRole('button', { name: text('guidedSetup', 'finish') }).click();
  await expect(page.getByRole('heading', {
    name: text('guidedSetup', 'complete.title', { household: 'Dropoff Home' }),
  })).toBeVisible();

  expect(await listAccounts(request, owner, household.id))
    .toMatchObject([{ name: 'Joint Checking', visibility: 'shared' }]);
  expect(await listBudgets(request, owner, household.id))
    .toMatchObject([{ name: 'Food', targetAmount: 120_000, visibility: 'shared' }]);
});
