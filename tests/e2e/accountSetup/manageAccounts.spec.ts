import { expect, test } from '@playwright/test';
import { listAccounts } from '../support/accountApi';
import { choose, pick } from '../support/controls';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I8 — Account & Card Management (FL11, in X5) against the real API: an
// Account with a credit card created, edited and archived (Full E2E). The
// card number never leaves the form: the API holds its network and last four.

test('an Owner adds an account with a card, edits it and archives it', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Alice', lastName: 'Accounts' });
  const household = await createHousehold(request, owner, 'Accounts Home');
  const expiryYear = String(new Date().getFullYear() + 2);
  await signInThroughUi(page, owner);
  await page.goto('/account-setup');

  await page.getByRole('button', { name: text('accountSetup', 'add') }).click();
  const create = page.getByRole('dialog', { name: text('accountSetup', 'create.title') });
  await create.getByLabel(text('accountSetup', 'field.name')).fill('Travel Checking');
  await pick(create, text('accountSetup', 'field.currency'), 'USD');
  await pick(
    create,
    text('accountSetup', 'field.visibility'),
    text('accountSetup', 'visibility.shared'),
  );
  await create.getByLabel(text('accountSetup', 'field.openingBalance')).pressSequentially('123456');
  await create.getByRole('button', { name: text('accountSetup', 'card.add') }).click();
  await create.getByLabel(text('creditCard', 'number')).pressSequentially('4111111111111111');
  await choose(page, create, text('accountSetup', 'card.closingDay'), '5');
  await choose(page, create, text('accountSetup', 'card.dueDay'), '15');
  await choose(page, create, text('accountSetup', 'card.month'), '12');
  await choose(page, create, text('accountSetup', 'card.year'), expiryYear);
  await create.getByRole('button', { name: text('accountSetup', 'create.submit') }).click();
  await expect(page.getByText(text('accountSetup', 'create.done', { name: 'Travel Checking' })))
    .toBeVisible();

  const created = (await listAccounts(request, owner, household.id))
    .find((account) => account.name === 'Travel Checking');
  expect(created).toMatchObject({
    type: 'checking',
    currency: 'USD',
    visibility: 'shared',
    currentBalance: 123_456,
    cards: [{
      network: 'visa',
      last4: '1111',
      closingDay: 5,
      dueDay: 15,
      expirationMonth: 12,
      expirationYear: Number(expiryYear),
    }],
  });
  // The number itself never reaches the API: the card carries no field for it.
  expect(Object.keys(created!.cards[0]!).sort()).toEqual([
    'accountId', 'closingDay', 'createdAt', 'dueDay', 'expirationMonth', 'expirationYear', 'id',
    'last4', 'network', 'outstandingBalance',
  ]);

  await page.getByRole('button', { name: 'Travel Checking', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Travel Checking' });
  await edit.getByLabel(text('accountSetup', 'field.name')).fill('Travel Account');
  await choose(page, edit, text('accountSetup', 'card.closingDay'), '8');
  await edit.getByRole('button', { name: text('accountSetup', 'edit.submit') }).click();
  await expect(page.getByText(text('accountSetup', 'edit.done', { name: 'Travel Account' })))
    .toBeVisible();
  expect((await listAccounts(request, owner, household.id))
    .find((account) => account.id === created!.id))
    .toMatchObject({ name: 'Travel Account', cards: [{ last4: '1111', closingDay: 8 }] });

  await page.getByRole('button', { name: 'Travel Account', exact: true }).click();
  const archive = page.getByRole('dialog', { name: 'Travel Account' });
  await archive.getByRole('button', { name: text('accountSetup', 'archive.action') }).click();
  await expect(archive.getByText(text('accountSetup', 'archive.confirm', {
    name: 'Travel Account',
  }))).toBeVisible();
  await archive.getByRole('button', { name: text('accountSetup', 'archive.action') }).last()
    .click();
  await expect(page.getByText(text('accountSetup', 'archive.done', { name: 'Travel Account' })))
    .toBeVisible();
  expect((await listAccounts(request, owner, household.id))
    .find((account) => account.id === created!.id))
    .toMatchObject({ archivedAt: expect.any(String) });
});
