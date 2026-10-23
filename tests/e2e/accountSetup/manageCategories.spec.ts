import { expect, test } from '@playwright/test';
import { listCategories, seededCategories } from '../support/accountApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I8 — Category Management (FL12, in X5) against the real API: a Category
// created, given a Subcategory through its own atomic edit, renamed, and
// archived with its Subcategories behind the confirm that counts them (Full E2E).

test('an Owner adds a category and a subcategory, renames it and archives both', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Carla', lastName: 'Categories' });
  const household = await createHousehold(request, owner, 'Categories Home');
  await seededCategories(request, owner, household.id);
  await signInThroughUi(page, owner);
  await page.goto('/account-setup?tab=categories');

  await page.getByRole('button', { name: text('categoryManagement', 'add') }).click();
  await page.getByLabel(text('categoryManagement', 'field.name')).fill('Hobbies');
  // A swatch is its label; the radio inside is visually hidden.
  await page.getByRole('radiogroup', { name: text('categoryManagement', 'color.label') })
    .getByRole('radio', { name: 'Coral' }).locator('xpath=..').click();
  await page.getByRole('button', { name: text('categoryManagement', 'create.submit'), exact: true })
    .click();
  await expect(page.getByText(text('categoryManagement', 'create.done', { name: 'Hobbies' })))
    .toBeVisible();

  // The card is the innermost block holding both its Edit button and its own
  // Add-subcategory pill.
  const addSubcategory = { name: text('categoryManagement', 'sub.add.open') };
  const editHobbies = { name: text('categoryManagement', 'card.edit', { name: 'Hobbies' }) };
  await page.locator('div')
    .filter({ has: page.getByRole('button', editHobbies) })
    .filter({ has: page.getByRole('button', addSubcategory) })
    .last()
    .getByRole('button', addSubcategory)
    .click();
  await page.getByPlaceholder(text('categoryManagement', 'sub.add.placeholder')).fill('Painting');
  await page.getByRole('button', { name: text('categoryManagement', 'sub.add') }).click();
  await expect(page.getByText(text('categoryManagement', 'addSubcategory.done', {
    name: 'Painting',
  }))).toBeVisible();

  await page.getByRole('button', editHobbies).click();
  await page.getByLabel(text('categoryManagement', 'field.name')).fill('Hobbies & Crafts');
  await page.getByRole('button', { name: text('categoryManagement', 'edit.submit') }).click();
  await expect(page.getByText(text('categoryManagement', 'edit.done', {
    name: 'Hobbies & Crafts',
  }))).toBeVisible();

  const hobbies = (await listCategories(request, owner, household.id))
    .find((category) => category.name === 'Hobbies & Crafts');
  expect(hobbies).toMatchObject({ color: 'coral', subcategories: [{ name: 'Painting' }] });

  await page.getByRole('button', {
    name: text('categoryManagement', 'card.archive', { name: 'Hobbies & Crafts' }),
  }).click();
  await expect(page.getByText(text('categoryManagement', 'archive.confirm', {
    name: 'Hobbies & Crafts', count: 1,
  }))).toBeVisible();
  await page.getByRole('button', {
    name: text('categoryManagement', 'archive.action'), exact: true,
  }).click();
  await expect(page.getByText(text('categoryManagement', 'archiveCategory.done', {
    name: 'Hobbies & Crafts',
  }))).toBeVisible();
  expect((await listCategories(request, owner, household.id))
    .map((category) => category.id)).not.toContain(hobbies!.id);
});
