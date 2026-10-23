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
