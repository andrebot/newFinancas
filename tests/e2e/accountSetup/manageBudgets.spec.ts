import { expect, test } from '@playwright/test';
import { createBudget, listBudgets, seededCategories } from '../support/accountApi';
import { cardNamed, pick } from '../support/controls';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I8 — Budget Management (FL13, in X5) against the real API: a Budget created,
// edited and deleted (Full E2E), and Core E2E journey #9 — a Category claimed
// elsewhere while the form was open is refused by the real partial unique
// index, not an app-level pre-check, and the form says who took it.

test('an Owner creates a budget, edits it and deletes it', async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Bruno', lastName: 'Budgets' });
  const household = await createHousehold(request, owner, 'Budgets Home');
  const categories = await seededCategories(request, owner, household.id);
  const idOf = (name: string): string => categories.find((category) => category.name === name)!.id;
  await signInThroughUi(page, owner);
  await page.goto('/account-setup?tab=budgets');

  await page.getByRole('button', { name: text('budgetManagement', 'add') }).click();
  const create = page.getByRole('dialog', { name: text('budgetManagement', 'create.title') });
  await create.getByLabel(text('budgetManagement', 'field.name')).fill('Living');
  await create.getByLabel(text('budgetManagement', 'field.target')).pressSequentially('150000');
  // A new Budget starts personal (PR #145).
  await pick(
    create,
    text('budgetManagement', 'field.visibility'),
    text('budgetManagement', 'visibility.shared'),
  );
  await create.getByText('Groceries', { exact: true }).click();
  await create.getByRole('button', { name: text('budgetManagement', 'create.submit') }).click();
  await expect(page.getByText(text('budgetManagement', 'create.done', { name: 'Living' })))
    .toBeVisible();

  const [living] = await listBudgets(request, owner, household.id);
  expect(living).toMatchObject({
    name: 'Living', targetAmount: 150_000, currency: 'BRL', visibility: 'shared',
  });
  // The Categories ticked, not just how many: a wrong row's id would pass a count.
  expect(living!.targets.map((target) => target.categoryId)).toEqual([idOf('Groceries')]);

  await cardNamed(page, 'Living').click();
  const edit = page.getByRole('dialog', { name: text('budgetManagement', 'edit.title') });
  await edit.getByLabel(text('budgetManagement', 'field.name')).fill('Home & Food');
  await edit.getByText('Healthcare', { exact: true }).click();
  await edit.getByRole('button', { name: text('budgetManagement', 'edit.submit') }).click();
  await expect(page.getByText(text('budgetManagement', 'edit.done', { name: 'Home & Food' })))
    .toBeVisible();
  const [edited] = await listBudgets(request, owner, household.id);
  expect(edited).toMatchObject({ id: living!.id, name: 'Home & Food' });
  expect(edited!.targets.map((target) => target.categoryId).sort())
    .toEqual([idOf('Groceries'), idOf('Healthcare')].sort());

  await cardNamed(page, 'Home & Food').click();
  const remove = page.getByRole('dialog', { name: text('budgetManagement', 'edit.title') });
  await remove.getByRole('button', { name: text('budgetManagement', 'delete.action') }).click();
  await expect(remove.getByText(text('budgetManagement', 'delete.confirm', {
    name: 'Home & Food',
  }))).toBeVisible();
  await remove.getByRole('button', { name: text('budgetManagement', 'delete.action') }).last()
    .click();
  await expect(page.getByText(text('budgetManagement', 'delete.done', { name: 'Home & Food' })))
    .toBeVisible();
  expect(await listBudgets(request, owner, household.id)).toEqual([]);
});

test('a category claimed by another budget while the form is open is refused', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Clara', lastName: 'Claims' });
  const household = await createHousehold(request, owner, 'Claims Home');
  const groceries = (await seededCategories(request, owner, household.id))
    .find((category) => category.name === 'Groceries')!;
  await signInThroughUi(page, owner);
  await page.goto('/account-setup?tab=budgets');

  await page.getByRole('button', { name: text('budgetManagement', 'add') }).click();
  const create = page.getByRole('dialog', { name: text('budgetManagement', 'create.title') });
  await create.getByLabel(text('budgetManagement', 'field.name')).fill('Food');
  await create.getByLabel(text('budgetManagement', 'field.target')).pressSequentially('80000');
  // Shared, so it shares the constraint's scope with the other one (a new Budget starts personal).
  await pick(
    create,
    text('budgetManagement', 'field.visibility'),
    text('budgetManagement', 'visibility.shared'),
  );
  await create.getByText('Groceries', { exact: true }).click();

  // A second request claims Groceries before this form is sent — from any
  // member, since the constraint covers every shared Budget of the household.
  // The picker still shows it free, so only the database's constraint can refuse it.
  const taken = await createBudget(request, owner, household.id, {
    name: 'Supermarket', categoryIds: [groceries.id],
  });
  await create.getByRole('button', { name: text('budgetManagement', 'create.submit') }).click();

  await expect(create.getByText(text('budgetManagement', 'conflict', {
    target: 'Groceries', budget: 'Supermarket',
  }))).toBeVisible();
  expect((await listBudgets(request, owner, household.id)).map((budget) => budget.id))
    .toEqual([taken.id]);
});
