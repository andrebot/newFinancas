import {
  expect, test, type Locator, type Page,
} from '@playwright/test';
import {
  UNIT, accountNamed, isoDay, monthStart, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I10 — the payout chart's holding selection (Full E2E, OQ-233, OQ-238): two
// stocks that paid dividends, both drawn at first; unticking one asks again
// for the payouts report alone, with the other's id (the overview and the
// Holdings are not fetched again), the chart's legend keeps only the one
// chosen, and the choice is kept across a reload (the per-household storage is
// usePayoutSelection's unit tests').

/**
 * A holding's entry in the payout chart's legend: a list item holding just its
 * ticker (the chart's own table and the holdings picker hold no list items).
 *
 * @param panel - The payout panel.
 * @param ticker - The holding's ticker.
 * @returns The entry.
 */
const legendEntry = (panel: Locator, ticker: string) => (
  panel.getByRole('listitem').filter({ hasText: new RegExp(`^${ticker}$`) })
);

/**
 * The payout panel: the section its heading opens.
 *
 * @param page - The browser page.
 * @returns The panel.
 */
const payoutPanel = (page: Page) => page.locator('section', {
  has: page.getByRole('heading', { name: text('payoutPanel', 'title') }),
});

test('the payout chart draws only the holdings chosen, and remembers them', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Paulo', lastName: 'Payout' });
  const household = await createHousehold(request, owner, 'Payout Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  /** Buys a stock two months ago and records a dividend in each month since, one at a time. */
  const stockPaying = async (ticker: string, dividend: number) => {
    const buy = await recordTransaction(request, owner, household.id, {
      kind: 'investment_buy',
      accountId: account.id,
      date: isoDay(monthStart(-2)),
      amount: 250_000,
      currency: 'BRL',
      assetType: 'stock',
      ticker,
      quantity: 25 * UNIT,
    });
    const dividendOn = (date: Date) => recordTransaction(request, owner, household.id, {
      kind: 'investment_dividend',
      accountId: account.id,
      date: isoDay(date),
      amount: dividend,
      currency: 'BRL',
      holdingId: buy.holdingId!,
    });
    await dividendOn(monthStart(-1));
    await dividendOn(new Date());
    return buy.holdingId!;
  };
  const itsa = await stockPaying('ITSA4', 1_250);
  await stockPaying('TAEE11', 2_100);

  await signInThroughUi(page, owner);
  await page.goto('/investments');
  const panel = payoutPanel(page);
  await expect(panel.getByRole('group', { name: text('payoutPanel', 'chart') })).toBeVisible();
  await expect(legendEntry(panel, 'ITSA4')).toBeVisible();
  await expect(legendEntry(panel, 'TAEE11')).toBeVisible();

  // From here on, every report or Holdings read the page asks for.
  const asked: string[] = [];
  page.on('request', (sent) => {
    const url = new URL(sent.url());
    if (/\/(reports\/[\w-]+|holdings)$/.test(url.pathname)) asked.push(url.pathname + url.search);
  });
  const holdings = text('payoutPanel', 'holdings');
  await panel.getByRole('button', { name: holdings }).click();
  const choice = page.getByRole('dialog', { name: holdings });
  const payoutsAsked = page.waitForRequest((sent) => sent.url().includes('/reports/payouts'));
  const taee = choice.getByRole('checkbox', { name: /TAEE11/ });
  // The kit's checkbox is visually hidden behind its label, which a user clicks.
  await choice.getByText('TAEE11', { exact: true }).click();
  await expect(taee).not.toBeChecked();
  await payoutsAsked;
  await choice.getByRole('button', { name: text('multiSelect', 'done') }).click();

  await expect(legendEntry(panel, 'TAEE11')).toHaveCount(0);
  await expect(legendEntry(panel, 'ITSA4')).toBeVisible();
  await expect(panel).toContainText(text('payoutPanel', 'summary', { count: 1, total: 2 }));
  expect(asked).toHaveLength(1);
  expect(new URL(asked[0]!, 'http://e2e').searchParams.get('holdingIds')).toBe(itsa);

  // The choice is kept across a reload.
  await page.reload();
  await expect(panel).toContainText(text('payoutPanel', 'summary', { count: 1, total: 2 }));
  await expect(legendEntry(panel, 'ITSA4')).toBeVisible();
  await expect(legendEntry(panel, 'TAEE11')).toHaveCount(0);
});
