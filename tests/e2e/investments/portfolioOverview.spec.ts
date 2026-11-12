import { expect, test } from '@playwright/test';
import {
  UNIT, accountNamed, isoDay, monthStart, recordTransaction,
} from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import { investmentsOverview } from '../support/investmentsApi';
import { netWorthCard, sectionOf } from '../support/locators';
import brl from '../support/money';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// X7 — the Investments page (Track Investments) against the real API: the
// overview of a household holding a stock that paid dividends, read through
// the investments-overview and payouts reports and the household's Holdings
// (OQ-233), with the payout chart drawn. Its figures are the report's — net
// worth the Holding's value, its buy's snapshot (OQ-236), and this month's
// payout the one dividend (uc-12, R4 E1). At phone width nothing on it may
// push the page sideways (OQ-230, moved here from FL18 by OQ-233).

/** The narrowest phone the layout supports. */
const PHONE = { width: 320, height: 720 };

test('the overview draws the payout chart and never scrolls sideways at phone width', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Ines', lastName: 'Investor' });
  const household = await createHousehold(request, owner, 'Investor Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const buy = await recordTransaction(request, owner, household.id, {
    kind: 'investment_buy',
    accountId: account.id,
    date: isoDay(monthStart(-2)),
    amount: 250_000,
    currency: 'BRL',
    assetType: 'stock',
    ticker: 'ITSA4',
    quantity: 25 * UNIT,
  });
  const payDividend = (date: Date, amount: number) => recordTransaction(
    request,
    owner,
    household.id,
    {
      kind: 'investment_dividend',
      accountId: account.id,
      date: isoDay(date),
      amount,
      currency: 'BRL',
      holdingId: buy.holdingId!,
    },
  );
  await payDividend(monthStart(-1), 1_250);
  await payDividend(new Date(), 1_400);

  await page.setViewportSize(PHONE);
  await signInThroughUi(page, owner);
  await page.goto('/investments');

  await expect(page.getByRole('heading', { level: 1, name: text('trackInvestments', 'title') }))
    .toBeVisible();
  const chart = page.getByRole('group', { name: text('payoutPanel', 'chart') });
  await expect(chart).toBeVisible();
  await expect(page.getByText('ITSA4').first()).toBeVisible();

  // The figures: the report's, and the report right — the buy's R$ 2.500,00
  // and this month's R$ 14,00 dividend.
  const overview = await investmentsOverview(request, owner, household.id);
  expect(overview.netWorth.map(({ currency, amount }) => ({ currency, amount })))
    .toEqual([{ currency: 'BRL', amount: 250_000 }]);
  expect(overview.payoutThisMonth.map(({ currency, amount }) => ({ currency, amount })))
    .toEqual([{ currency: 'BRL', amount: 1_400 }]);
  await expect(netWorthCard(page, 'BRL')).toContainText(brl(250_000));
  const payout = sectionOf(page, text('payoutThisMonth', 'title'));
  await expect(payout).toContainText(brl(1_400));

  // An expression, not a function: the E2E code compiles without the DOM's types.
  const overflow = await page.evaluate<number>(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  );
  expect(overflow).toBe(0);
});
