import { describe, expect, it } from 'vitest';
import {
  holdingGroupsOf, holdingNameOf, monthTotalOf, payoutSeriesOf, payoutsByHolding,
} from '../../../src/experiences/payoutPanel';
import {
  holdingOf, HOLDINGS, OVERVIEW, PAYOUTS,
} from './portfolioFixtures';

// What the payout panel reads (BDT: pure helpers, unit, nothing mocked).

describe('holdingNameOf', () => {
  it('names a Holding by its ticker, and nothing when unknown', () => {
    expect(holdingNameOf(holdingOf('xpml11'))).toBe('XPML11');
    expect(holdingNameOf(undefined)).toBe('');
    expect(holdingNameOf({ id: 'bare' })).toBe('');
  });
});

describe('payoutSeriesOf', () => {
  it('keeps the switch\'s currency only, named by ticker', () => {
    expect(payoutSeriesOf(PAYOUTS, 'BRL', HOLDINGS).map((series) => [series.key, series.label]))
      .toEqual([['xpml11', 'XPML11'], ['knri11', 'KNRI11']]);
    expect(payoutSeriesOf(PAYOUTS, 'USD', HOLDINGS).map((series) => series.key)).toEqual(['aapl']);
  });

  it('hands the months on as the chart takes them', () => {
    const [xpml] = payoutSeriesOf(PAYOUTS, 'BRL', HOLDINGS);
    expect(xpml?.amounts).toEqual(PAYOUTS.series[0]!.months);
  });
});

describe('monthTotalOf', () => {
  it('adds up one month across the series', () => {
    expect(monthTotalOf(payoutSeriesOf(PAYOUTS, 'BRL', HOLDINGS), '2026-09')).toBe(110000);
  });

  it('is zero for a month nobody paid in', () => {
    expect(monthTotalOf(payoutSeriesOf(PAYOUTS, 'BRL', HOLDINGS), '2026-01')).toBe(0);
  });

  it('counts an amount below zero as nothing, as the chart does', () => {
    const series = [{ key: 'x', label: 'X', amounts: [{ month: '2026-09', amount: -500 }] }];
    expect(monthTotalOf(series, '2026-09')).toBe(0);
  });
});

describe('holdingGroupsOf', () => {
  it('groups by family in the selector\'s order, each by ticker', () => {
    expect(holdingGroupsOf(HOLDINGS).map(({ family, holdings }) => (
      [family, holdings.map((holding) => holding.ticker)]
    ))).toEqual([
      ['fii', ['KNRI11', 'OLD11', 'XPML11']],
      ['stock', ['AAPL', 'MSFT', 'VALE3']],
      ['fixedIncome', ['Tesouro IPCA+ 2035', 'Used Car Savings CD']],
    ]);
  });

  it('adds Other only when a Holding is in it', () => {
    const groups = holdingGroupsOf([holdingOf('btc', { assetType: 'crypto' })]);
    expect(groups.map((group) => group.family)).toEqual(['other']);
  });
});

describe('payoutsByHolding', () => {
  it('adds up each Holding\'s payouts this month, in its currency', () => {
    const paid = payoutsByHolding([
      ...OVERVIEW.payoutThisMonth,
      { ...OVERVIEW.payoutThisMonth[1]!, transactionId: 't-knri-2', amount: 1000 },
    ]);
    expect(paid.get('knri11')).toEqual({ currency: 'BRL', amount: 22000 });
    expect(paid.get('aapl')).toEqual({ currency: 'USD', amount: 400 });
    expect(paid.has('vale3')).toBe(false);
  });
});
