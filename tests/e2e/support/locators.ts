import type { Locator, Page } from '@playwright/test';
import text from './text';

// Locators the journeys share for panels the kit draws the same way on
// several pages — the Investments overview and the Dashboard both show the
// payout chart, the net-worth cards and Coming Due (FL18, FL21).

/**
 * A pattern matching text that starts with a literal — catalog text escaped,
 * so a message holding `.`, `(` or `?` never turns into a pattern.
 *
 * @param literal - The text to start with.
 * @returns The pattern.
 */
export const startingWith = (literal: string): RegExp => (
  new RegExp(`^${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
);

/**
 * The section its heading opens, the heading's name starting with the title —
 * not merely holding it — since a SectionHeader's hint sits inside the
 * heading (e.g. `Coming due Fixed income`).
 *
 * @param page - The browser page.
 * @param heading - The heading's title.
 * @returns The section.
 */
export const sectionOf = (page: Page, heading: string): Locator => page.locator('section', {
  has: page.getByRole('heading', { name: startingWith(heading) }),
});

/**
 * The payout panel: the section its heading opens.
 *
 * @param page - The browser page.
 * @returns The panel.
 */
export const payoutPanel = (page: Page): Locator => sectionOf(page, text('payoutPanel', 'title'));

/**
 * A holding's entry in the payout chart's legend: a list item holding just its
 * ticker (the chart's own table and the holdings picker hold no list items).
 *
 * @param panel - The payout panel.
 * @param ticker - The holding's ticker.
 * @returns The entry.
 */
export const legendEntry = (panel: Locator, ticker: string): Locator => (
  panel.getByRole('listitem').filter({ hasText: new RegExp(`^${ticker}$`) })
);

/**
 * One currency's net-worth card: the card around its heading.
 *
 * @param page - The browser page.
 * @param currency - The currency, e.g. `BRL`.
 * @returns The card.
 */
export const netWorthCard = (page: Page, currency: string): Locator => page
  .getByRole('heading', { name: text('netWorthCards', 'label', { currency }) })
  .locator('xpath=../..');
