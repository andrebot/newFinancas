import { expect, test, type Page } from '@playwright/test';
import type { InvestmentHolding } from '@financas/api-types';
import { pick } from '../support/controls';
import { accountNamed, isoDay, recordTransaction } from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import {
  indexRateValues, projectedHolding, recordIndexRate,
} from '../support/investmentsApi';
import brl from '../support/money';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I10 — Core E2E journey #6, its last part (OQ-238): a CDB at 110% of CDI,
// bought through the API (I9 records one in the browser and checks its
// schedule), shows on the Holdings tab what InvestmentProductEngine projects
// from CDI's latest value — expected payout, expected taxes and the net in the
// estimate's note. A newer CDI value recorded in the Rates tab moves the
// projection: the card follows the latest value, not the one the buy saw.

/** CDI when the CDB is bought: 10.00% a year, percent × 10,000. */
const FIRST_CDI = 100_000;

/** CDI as the browser records it today: 12.50% a year. */
const NEWER_CDI = 125_000;

/** What the CDB costs: R$ 10.000,00. */
const COST = 1_000_000;

/**
 * A day some days before today, as the API takes it.
 *
 * @param days - How many days back.
 * @returns It as `YYYY-MM-DD`.
 */
const daysAgo = (days: number): string => {
  const today = new Date();
  return isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
};

/**
 * Opens the Holdings tab's row of a fixed-term Holding, showing its cards.
 *
 * @param page - The browser page.
 * @param ticker - The Holding's identifier, as the buy typed it.
 * @returns The open row's Contract card.
 */
const openHoldingRow = async (page: Page, ticker: string) => {
  await pick(
    page.locator('main'),
    text('trackInvestments', 'tabs.label'),
    text('trackInvestments', 'tab.holdings'),
  );
  const row = page.getByRole('button').filter({ hasText: ticker });
  await row.click();
  const region = page.getByRole('region', { name: new RegExp(ticker) });
  return region.locator('section', {
    has: page.getByRole('heading', { name: text('holdingMaintenance', 'contract.title') }),
  });
};

/**
 * The Contract card's projection, as it should read for a Holding the API projected.
 *
 * @param holding - The Holding, as the household list reads it.
 * @param cdi - CDI's latest value, percent × 10,000.
 * @returns The expected payout, the taxes as the card signs them, and the estimate's note.
 */
const contractTexts = (holding: InvestmentHolding, cdi: number) => {
  const payout = holding.expectedPayout!;
  const taxes = holding.expectedTaxes!.amount!;
  const lead = text('holdingMaintenance', 'contract.estimateIf', {
    code: 'cdi',
    index: text('holdingNames', 'index.cdi'),
    rate: `${(cdi / 10_000).toFixed(2)}%`,
    unit: 'annual_percent',
  });
  const net = text('holdingMaintenance', 'contract.net', { amount: brl(payout - taxes) });
  return { payout: brl(payout), taxes: brl(-taxes), note: `${lead} · ${net}` };
};

test('the Holdings view projects a CDI-linked CDB from CDI\'s latest value', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Pia', lastName: 'Projection' });
  const household = await createHousehold(request, owner, 'Projection Home');
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  await recordIndexRate(request, owner, household.id, {
    index: 'cdi', value: FIRST_CDI, asOf: daysAgo(30),
  });
  const today = new Date();
  const buy = await recordTransaction(request, owner, household.id, {
    kind: 'investment_buy',
    accountId: account.id,
    date: daysAgo(5),
    amount: COST,
    currency: 'BRL',
    assetType: 'cdb',
    ticker: 'CDB Liquidez',
    rate: { type: 'cdi', value: 1_100_000 },
    dueDate: isoDay(new Date(today.getFullYear() + 2, today.getMonth(), 15)),
    interestPayment: 'at_maturity',
  });
  const holdingId = buy.holdingId!;
  const before = await projectedHolding(request, owner, household.id, holdingId);
  expect(before.expectedPayout).toBeGreaterThan(0);
  expect(before.expectedTaxes).toMatchObject({ estimated: true });

  await signInThroughUi(page, owner);
  await page.goto('/investments');
  const contract = await openHoldingRow(page, 'CDB Liquidez');
  const first = contractTexts(before, FIRST_CDI);
  await expect(contract).toContainText(first.payout);
  await expect(contract).toContainText(first.taxes);
  await expect(contract).toContainText(first.note);

  // A newer CDI value, recorded as of today in the Rates tab.
  await pick(
    page.locator('main'),
    text('trackInvestments', 'tabs.label'),
    text('trackInvestments', 'tab.rates'),
  );
  const cdi = text('holdingNames', 'index.cdi');
  const cdiCard = page.getByRole('article')
    .filter({ has: page.getByRole('heading', { name: cdi, exact: true }) });
  await cdiCard.getByRole('button', { name: text('ratesMaintenance', 'update') }).click();
  const formName = text('ratesMaintenance', 'form.name', { index: cdi });
  const form = page.getByRole('form', { name: formName });
  await form.getByLabel(text('ratesMaintenance', 'form.value', { unit: 'annual_percent' }))
    .fill('12.5');
  await form.getByRole('button', { name: text('ratesMaintenance', 'form.save') }).click();
  await expect(page.getByText(text('ratesMaintenance', 'saved'))).toBeVisible();
  expect((await indexRateValues(request, owner, household.id, 'cdi'))[0])
    .toMatchObject({ value: NEWER_CDI, asOf: isoDay(today) });

  const after = await projectedHolding(request, owner, household.id, holdingId);
  expect(after.expectedPayout).toBeGreaterThan(before.expectedPayout!);
  expect(after.expectedTaxes!.amount).toBeGreaterThan(before.expectedTaxes!.amount!);
  const reopened = await openHoldingRow(page, 'CDB Liquidez');
  const second = contractTexts(after, NEWER_CDI);
  await expect(reopened).toContainText(second.payout);
  await expect(reopened).toContainText(second.taxes);
  await expect(reopened).toContainText(second.note);
});
