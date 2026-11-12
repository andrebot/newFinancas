import {
  expect, test, type Locator, type Page,
} from '@playwright/test';
import {
  UNIT, accountNamed, isoDay, monthStart, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { dashboard } from '../support/insightsApi';
import brl from '../support/money';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I11 — the Dashboard's investment panels (X8, FL21; mockup 20; uc-01 View
// Dashboard) against the real API, Full E2E: a household holding a CDB and two
// stocks that paid dividends. Net worth is the Holdings' value and Coming Due
// the CDB at its principal, as the `dashboard` report gives them (OQ-236). The
// payout chart reads `reports/payouts` with the choice of Holdings made on
// Investments, which the Dashboard shares — the report sends no payouts (OQ-243).

/**
 * The section a heading opens.
 *
 * @param page - The browser page.
 * @param heading - The heading's text.
 * @returns The section.
 */
const sectionOf = (page: Page, heading: string) => page.locator('section', {
  has: page.getByRole('heading', { name: heading }),
});

/**
 * A holding's entry in the payout chart's legend: a list item holding just its ticker.
 *
 * @param panel - The payout panel.
 * @param ticker - The holding's ticker.
 * @returns The entry.
 */
const legendEntry = (panel: Locator, ticker: string) => (
  panel.getByRole('listitem').filter({ hasText: new RegExp(`^${ticker}$`) })
);

/**
 * The Holdings a payouts request asks for.
 *
 * @param url - The request's address.
 * @returns Its `holdingIds` parameter.
 */
const holdingIdsOf = (url: string) => new URL(url).searchParams.get('holdingIds');

test('the Dashboard shows net worth, Coming Due and the payouts chosen on Investments', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Dana', lastName: 'Dashboard' });
  const household = await createHousehold(request, owner, 'Dashboard Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const today = new Date();
  const cdb = await recordTransaction(request, owner, household.id, {
    kind: 'investment_buy',
    accountId: account.id,
    date: isoDay(monthStart(-2)),
    amount: 1_000_000,
    currency: 'BRL',
    assetType: 'cdb',
    ticker: 'CDB Banco Azul',
    rate: { type: 'fixed', value: 125_000 },
    dueDate: isoDay(new Date(today.getFullYear() + 2, today.getMonth(), 15)),
    interestPayment: 'at_maturity',
  });
  /** Buys a stock two months ago and records a dividend last month and this one. */
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
    // One at a time: each moves the account's balance history.
    await dividendOn(monthStart(-1));
    await dividendOn(today);
  };
  await stockPaying('ITSA4', 1_250);
  await stockPaying('TAEE11', 2_100);

  // On Investments, TAEE11 is left out of the payout chart.
  await signInThroughUi(page, owner);
  await page.goto('/investments');
  const investmentsPanel = sectionOf(page, text('payoutPanel', 'title'));
  await expect(legendEntry(investmentsPanel, 'TAEE11')).toBeVisible();
  const holdings = text('payoutPanel', 'holdings');
  await investmentsPanel.getByRole('button', { name: holdings }).click();
  const choice = page.getByRole('dialog', { name: holdings });
  const chosen = page.waitForRequest((sent) => sent.url().includes('/reports/payouts'));
  // The kit's checkbox is visually hidden behind its label, which a user clicks.
  await choice.getByText('TAEE11', { exact: true }).click();
  const chosenIds = holdingIdsOf((await chosen).url());
  await choice.getByRole('button', { name: text('multiSelect', 'done') }).click();
  await expect(legendEntry(investmentsPanel, 'TAEE11')).toHaveCount(0);

  // The Dashboard asks for the same Holdings' payouts and draws only them.
  const asked = page.waitForRequest((sent) => sent.url().includes('/reports/payouts'));
  await page.goto('/');
  expect(holdingIdsOf((await asked).url())).toBe(chosenIds);
  const panel = sectionOf(page, text('payoutPanel', 'title'));
  await expect(panel.getByRole('group', { name: text('payoutPanel', 'chart') })).toBeVisible();
  await expect(legendEntry(panel, 'ITSA4')).toBeVisible();
  await expect(legendEntry(panel, 'TAEE11')).toHaveCount(0);

  // The figures: the report's, and the report right — the Holdings' value, the
  // CDB at its principal.
  const report = await dashboard(request, owner, household.id);
  expect(report.netWorth.map(({ currency, amount }) => ({ currency, amount })))
    .toEqual([{ currency: 'BRL', amount: 1_500_000 }]);
  expect(report.comingDue).toEqual([expect.objectContaining({
    holdingId: cdb.holdingId, currency: 'BRL', amount: 1_000_000,
  })]);
  const netWorthLabel = text('netWorthCards', 'label', { currency: 'BRL' });
  const netWorth = page.getByRole('heading', { name: netWorthLabel }).locator('xpath=../..');
  await expect(netWorth).toContainText(brl(1_500_000));
  const comingDue = sectionOf(page, text('comingDue', 'title'));
  await expect(comingDue).toContainText('CDB Banco Azul');
  await expect(comingDue).toContainText(brl(1_000_000));
});
