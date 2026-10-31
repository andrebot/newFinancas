import type { Locator, Page } from '@playwright/test';

// Driving the kit's controls as a user does (I8): a Select is a button that
// opens a listbox, a segmented control is a radio group whose inputs are hidden
// behind their labels.

/**
 * Opens a kit Select by its label and picks one of its options.
 *
 * @param page - The browser page.
 * @param scope - Where the Select is, e.g. an open drawer.
 * @param label - The Select's label.
 * @param option - The option's text.
 * @returns Resolves once the option is picked.
 */
export const choose = async (
  page: Page,
  scope: Locator,
  label: string,
  option: string,
): Promise<void> => {
  await scope.getByRole('combobox', { name: label }).click();
  await page.getByRole('listbox', { name: label })
    .getByRole('option', { name: option, exact: true }).click();
};

/**
 * Picks a segment of a kit segmented control, through its label.
 *
 * @param scope - Where the control is.
 * @param label - The radio group's label.
 * @param option - The segment's text.
 * @returns Resolves once it is clicked.
 */
export const pick = (scope: Locator, label: string, option: string): Promise<void> => (
  scope.getByRole('radiogroup', { name: label }).getByText(option, { exact: true }).click()
);

/**
 * Types a date into a kit date input as an en-US user does: month, day, year,
 * the mask adding the slashes.
 *
 * @param field - The date input.
 * @param date - The date, as `YYYY-MM-DD`.
 * @returns Resolves once it is typed.
 */
export const typeDate = async (field: Locator, date: string): Promise<void> => {
  const [year, month, day] = date.split('-');
  await field.clear();
  await field.pressSequentially(`${month}${day}${year}`);
};

/**
 * Finds a card that opens its item: a button holding the item's name as one
 * exact text, among the rest of the card's text (its tags, its amounts). The
 * name is matched whole, so `Trip` never finds `Japan Trip`.
 *
 * @param page - The browser page.
 * @param name - The item's name.
 * @returns The card's button.
 */
export const cardNamed = (page: Page, name: string): Locator => (
  page.getByRole('button').filter({ has: page.getByText(name, { exact: true }) })
);
