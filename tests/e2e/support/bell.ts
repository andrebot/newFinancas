import type { Locator, Page } from '@playwright/test';
import { startingWith } from './locators';
import text from './text';

// The header's bell, as the journeys that read or act on a notification open
// it — the inbox's own (I11) and the shell's routing (I12, OQ-245).

/**
 * Opens the bell's inbox.
 *
 * @param page - The browser page, signed in.
 * @returns The inbox panel.
 */
const openInbox = async (page: Page): Promise<Locator> => {
  const bell = text('shell', 'header.notifications');
  // Named by its label and, while there are any, the unseen count, e.g. `Notifications 1 unseen`.
  await page.getByRole('button', { name: startingWith(bell) }).click();
  return page.getByRole('dialog', { name: bell });
};

export default openInbox;
