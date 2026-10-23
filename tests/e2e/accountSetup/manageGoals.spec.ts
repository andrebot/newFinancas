import { expect, test, type Page } from '@playwright/test';
import { listGoals } from '../support/accountApi';
import { pick } from '../support/controls';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I8 — Goal Management (FL14, in X5) against the real API: a Goal created,
// edited, marked completed, reopened and deleted (Full E2E). Its progress
// waits for M4 (OQ-195): the definitions show alone, under a banner.

/**
 * Opens a goal's edit drawer from its card and takes one of the drawer's
 * confirmed steps — Mark completed, Reopen or Delete.
 *
 * @param page - The browser page, on the Goals tab.
 * @param name - The goal's name.
 * @param action - The step.
 * @returns Resolves once the step's success shows.
 */
const takeStep = async (
  page: Page,
  name: string,
  action: 'complete' | 'reopen' | 'delete',
): Promise<void> => {
  await page.getByRole('button', { name: new RegExp(name) }).click();
  const drawer = page.getByRole('dialog', { name: text('goalManagement', 'edit.title') });
  await drawer.getByRole('button', { name: text('goalManagement', `${action}.action`) }).click();
  await expect(drawer.getByText(text('goalManagement', `${action}.confirm`, { name })))
    .toBeVisible();
  await drawer.getByRole('button', { name: text('goalManagement', `${action}.action`) }).last()
    .click();
  await expect(page.getByText(text('goalManagement', `${action}.done`, { name }))).toBeVisible();
};

test('an Owner creates a goal, edits it, completes, reopens and deletes it', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Gabi', lastName: 'Goals' });
  const household = await createHousehold(request, owner, 'Goals Home');
  const dueYear = new Date().getFullYear() + 3;
  await signInThroughUi(page, owner);
  await page.goto('/account-setup?tab=goals');

  await page.getByRole('button', { name: text('goalManagement', 'add') }).click();
  const create = page.getByRole('dialog', { name: text('goalManagement', 'create.title') });
  await create.getByLabel(text('goalManagement', 'field.name')).fill('Trip');
  await pick(create, text('goalManagement', 'field.currency'), 'USD');
  await create.getByLabel(text('goalManagement', 'field.target')).pressSequentially('500000');
  await create.getByLabel(text('goalManagement', 'field.dueDate'))
    .pressSequentially(`0615${dueYear}`);
  await create.getByRole('button', { name: text('goalManagement', 'create.submit') }).click();
  await expect(page.getByText(text('goalManagement', 'create.done', { name: 'Trip' })))
    .toBeVisible();
  const [trip] = await listGoals(request, owner, household.id);
  expect(trip).toMatchObject({
    name: 'Trip',
    targetAmount: 500_000,
    targetCurrency: 'USD',
    visibility: 'shared',
    dueDate: `${dueYear}-06-15`,
    completedAt: null,
  });

  await page.getByRole('button', { name: /Trip/ }).click();
  const edit = page.getByRole('dialog', { name: text('goalManagement', 'edit.title') });
  await edit.getByLabel(text('goalManagement', 'field.name')).fill('Japan Trip');
  await edit.getByRole('button', { name: text('goalManagement', 'edit.submit') }).click();
  await expect(page.getByText(text('goalManagement', 'edit.done', { name: 'Japan Trip' })))
    .toBeVisible();

  await takeStep(page, 'Japan Trip', 'complete');
  expect(await listGoals(request, owner, household.id)).toEqual([]);
  expect(await listGoals(request, owner, household.id, 'completed'))
    .toMatchObject([{ id: trip!.id, name: 'Japan Trip', completedAt: expect.any(String) }]);

  // The status segments carry their counts ("Completed 1"): matched by their start.
  const statuses = page.getByRole('radiogroup', { name: text('goalManagement', 'status.label') });
  await statuses.getByText(text('goalManagement', 'status.completed')).click();
  await takeStep(page, 'Japan Trip', 'reopen');
  expect(await listGoals(request, owner, household.id))
    .toMatchObject([{ id: trip!.id, completedAt: null }]);

  await statuses.getByText(text('goalManagement', 'status.active')).click();
  await takeStep(page, 'Japan Trip', 'delete');
  expect(await listGoals(request, owner, household.id)).toEqual([]);
});
