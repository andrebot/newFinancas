import { expect, test } from '@playwright/test';
import { pick, typeDate } from '../support/controls';
import { daysAgo, isoDay, usDate } from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { indexRateValues } from '../support/investmentsApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I10 — index rate record, edit and delete (Full E2E, uc-08/09/10, OQ-238):
// Selic gets today's value through its card's Update form in Rates
// Maintenance (FL20), then the Rate History drawer (K46) edits it, adds a
// past value and deletes today's. Each write is checked in the API.

test('an index value is recorded, edited, added in the past and deleted', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Rui', lastName: 'Rates' });
  const household = await createHousehold(request, owner, 'Rates Home');
  const selic = text('holdingNames', 'index.selic');
  const valueLabel = text('ratesMaintenance', 'history.value', { unit: 'annual_percent' });
  const today = new Date();
  const pastDay = daysAgo(20);
  /** Selic's values in the API, oldest first, as day and value. */
  const selicValues = async () => (await indexRateValues(request, owner, household.id, 'selic'))
    .map(({ asOf, value }) => ({ asOf, value }))
    .reverse();

  await signInThroughUi(page, owner);
  await page.goto('/investments');
  await pick(
    page.locator('main'),
    text('trackInvestments', 'tabs.label'),
    text('trackInvestments', 'tab.rates'),
  );
  const card = page.getByRole('article')
    .filter({ has: page.getByRole('heading', { name: selic, exact: true }) });
  await expect(card).toContainText(text('ratesMaintenance', 'none'));

  // Today's value, through Update (As of starts at today).
  await card.getByRole('button', { name: text('ratesMaintenance', 'update') }).click();
  const formName = text('ratesMaintenance', 'form.name', { index: selic });
  const form = page.getByRole('form', { name: formName });
  await form.getByLabel(text('ratesMaintenance', 'form.value', { unit: 'annual_percent' }))
    .fill('10.5');
  await form.getByRole('button', { name: text('ratesMaintenance', 'form.save') }).click();
  await expect(page.getByText(text('ratesMaintenance', 'saved'))).toBeVisible();
  expect(await selicValues()).toEqual([{ asOf: isoDay(today), value: 105_000 }]);
  await expect(card).toContainText('10.50%');

  await card.getByRole('button', { name: text('ratesMaintenance', 'history') }).click();
  const drawer = page.getByRole('dialog', { name: selic });

  // Edit today's value in place.
  const editName = text('historyEditor', 'edit', { date: usDate(today) });
  await drawer.getByRole('button', { name: editName }).click();
  const editForm = drawer.getByRole('form', { name: editName });
  await editForm.getByLabel(valueLabel).fill('10.75');
  await editForm.getByRole('button', { name: text('historyEditor', 'save') }).click();
  await expect(editForm).toBeHidden();

  // Add a value twenty days back.
  await drawer.getByRole('button', { name: text('historyEditor', 'add') }).click();
  const addForm = drawer.getByRole('form', { name: text('historyEditor', 'newValue') });
  await typeDate(addForm.getByLabel(text('historyEditor', 'date')), isoDay(pastDay));
  await addForm.getByLabel(valueLabel).fill('10.25');
  await addForm.getByRole('button', { name: text('historyEditor', 'save') }).click();
  await expect(addForm).toBeHidden();
  await expect.poll(selicValues).toEqual([
    { asOf: isoDay(pastDay), value: 102_500 },
    { asOf: isoDay(today), value: 107_500 },
  ]);

  // Delete today's, behind the confirm: the past value is the latest again.
  const deleteName = text('historyEditor', 'delete', { date: usDate(today) });
  await drawer.getByRole('button', { name: deleteName }).click();
  await drawer.getByRole('button', { name: text('historyEditor', 'deleteConfirm'), exact: true })
    .click();
  await expect(page.getByText(text('ratesMaintenance', 'deleted'))).toBeVisible();
  expect(await selicValues()).toEqual([{ asOf: isoDay(pastDay), value: 102_500 }]);
  await drawer.getByRole('button', { name: text('ratesMaintenance', 'history.done') }).click();
  await expect(card).toContainText('10.25%');
});
