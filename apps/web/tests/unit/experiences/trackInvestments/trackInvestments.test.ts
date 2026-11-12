import { describe, expect, it } from 'vitest';
import {
  marketValueBodyOf, overviewReadOf, readsMarketDetails, tabOf, TABS,
} from '../../../../src/experiences/trackInvestments/trackInvestments';
import { payoutsReadOf } from '../../../../src/experiences/payoutPanel';
import { transactionsOfHolding } from '../../../../src/experiences/trackInvestments/useInvestmentRequests';
import {
  HOLDINGS, holdingOf, holdingWithout, INVESTMENT_ACCOUNTS, OVERVIEW, PAYOUTS,
} from '../portfolioFixtures';

// What the Track Investments Experience reads its queries into (BDT: unit,
// pure — nothing to mock).

const LOADED = {
  report: { data: OVERVIEW, isError: false },
  holdings: { data: HOLDINGS, isError: false },
  accounts: { data: INVESTMENT_ACCOUNTS, isError: false },
};

describe('tabOf', () => {
  it('reads the tab the address names, Overview otherwise', () => {
    expect(TABS).toEqual(['overview', 'holdings', 'rates']);
    expect(tabOf('rates')).toBe('rates');
    expect(tabOf('builder')).toBe('overview');
    expect(tabOf(null)).toBe('overview');
  });
});

describe('overviewReadOf (OQ-233)', () => {
  it('is loaded once the report, the Holdings and the accounts are in', () => {
    expect(overviewReadOf(LOADED)).toEqual({
      status: 'loaded', report: OVERVIEW, holdings: HOLDINGS,
    });
  });

  it.each(['report', 'holdings', 'accounts'] as const)('loads while the %s load', (read) => {
    expect(overviewReadOf({ ...LOADED, [read]: { isError: false } })).toEqual({
      status: 'loading',
    });
  });

  it.each(['report', 'holdings', 'accounts'] as const)('fails when the %s failed', (read) => {
    expect(overviewReadOf({ ...LOADED, [read]: { isError: true } })).toEqual({
      status: 'failed',
    });
  });
});

describe('payoutsReadOf', () => {
  it('reads the current choice\'s answer only', () => {
    expect(payoutsReadOf({ currentData: PAYOUTS, isError: false })).toEqual({
      status: 'loaded', report: PAYOUTS,
    });
    expect(payoutsReadOf({ isError: false })).toEqual({ status: 'loading' });
    expect(payoutsReadOf({ isError: true })).toEqual({ status: 'failed' });
  });
});

describe('marketValueBodyOf', () => {
  it('words a market value as the contract does', () => {
    expect(marketValueBodyOf({ asOfDate: '2026-09-30', valuation: 1_000 }))
      .toEqual({ value: 1_000, asOf: '2026-09-30' });
  });
});

describe('readsMarketDetails (OQ-234)', () => {
  it('reads a market-priced Holding\'s history and activity, never a fixed-term one\'s', () => {
    expect(readsMarketDetails(holdingOf('vale3', { assetType: 'stock' }))).toBe(true);
    expect(readsMarketDetails(holdingOf('cdb', { assetType: 'cdb' }))).toBe(false);
    expect(readsMarketDetails(holdingWithout(holdingOf('x'), 'assetType'))).toBe(true);
  });
});

describe('transactionsOfHolding (OQ-222)', () => {
  it('addresses the ledger filtered by the Holding', () => {
    expect(transactionsOfHolding('h 1')).toBe('/transactions?holding=h+1');
  });
});
