import type {
  Account, GoalWithProgress, InvestmentHolding, InvestmentsOverviewReport, PayoutsReport,
} from '@financas/api-types';
import { accountOf, goalOf } from './monthFixtures';

// What the investments suites read (FL18, its Interactions, and FL21's shared
// ones): mockup 50's household on September 2026 — FIIs and a stock in BRL at
// XP, two US stocks and a CD in USD, a Tesouro in BRL and an archived FII — its
// investments overview and a payouts report over the last months.

/**
 * Builds a Holding.
 *
 * @param id - Its id.
 * @param over - Fields to change.
 * @returns The Holding.
 */
export const holdingOf = (
  id: string,
  over: Partial<InvestmentHolding> = {},
): InvestmentHolding => ({
  id,
  accountId: 'xp',
  assetType: 'fii',
  ticker: id.toUpperCase(),
  quantity: 100,
  archivedAt: null,
  ...over,
});

/**
 * Copies a Holding without some fields, as a read that leaves them out sends it.
 *
 * @param holding - The Holding.
 * @param fields - The fields to leave out.
 * @returns The copy.
 */
export const holdingWithout = (
  holding: InvestmentHolding,
  ...fields: readonly (keyof InvestmentHolding)[]
): InvestmentHolding => {
  const copy: Partial<InvestmentHolding> = { ...holding };
  fields.forEach((field) => delete copy[field]);
  return copy;
};

export const HOLDINGS: readonly InvestmentHolding[] = [
  holdingOf('xpml11'),
  holdingOf('knri11'),
  holdingOf('vale3', { assetType: 'stock' }),
  holdingOf('aapl', { accountId: 'checking', assetType: 'stock' }),
  holdingOf('msft', { accountId: 'checking', assetType: 'stock' }),
  holdingOf('cd', {
    accountId: 'savings', assetType: 'cd', ticker: 'Used Car Savings CD', dueDate: '2026-12-15',
  }),
  holdingOf('ipca35', {
    assetType: 'tesouro_direto', ticker: 'Tesouro IPCA+ 2035', dueDate: '2035-05-15',
  }),
  holdingOf('old11', { archivedAt: '2026-03-01T12:00:00Z' }),
];

export const INVESTMENT_ACCOUNTS: readonly Account[] = [
  accountOf('xp', { name: 'XP Investimentos', type: 'investment' }),
  accountOf('checking', { name: 'Main Checking', currency: 'USD' }),
  accountOf('savings', { name: 'Emergency Fund', type: 'savings', currency: 'USD' }),
];

export const OVERVIEW: InvestmentsOverviewReport = {
  reportType: 'investments-overview',
  netWorth: [
    {
      currency: 'BRL',
      amount: 35860000,
      changeVsPreviousMonth: 3120000,
      series: [
        { month: '2026-08', amount: 32740000 },
        { month: '2026-09', amount: 35860000 },
      ],
    },
    {
      currency: 'USD',
      amount: 1913000,
      changeVsPreviousMonth: 241000,
      series: [
        { month: '2026-08', amount: 1672000 },
        { month: '2026-09', amount: 1913000 },
      ],
    },
  ],
  payoutThisMonth: [
    {
      holdingId: 'aapl',
      transactionId: 't-aapl',
      kind: 'investment_dividend',
      date: '2026-09-10',
      currency: 'USD',
      amount: 400,
    },
    {
      holdingId: 'knri11',
      transactionId: 't-knri',
      kind: 'investment_dividend',
      date: '2026-09-14',
      currency: 'BRL',
      amount: 21000,
    },
    {
      holdingId: 'xpml11',
      transactionId: 't-xpml',
      kind: 'investment_dividend',
      date: '2026-09-15',
      currency: 'BRL',
      amount: 89000,
    },
    {
      holdingId: 'cd',
      transactionId: 't-cd',
      kind: 'investment_interest',
      date: '2026-09-20',
      currency: 'USD',
      amount: 280,
    },
  ],
  allocations: [
    {
      kind: 'holding', key: 'xpml11', currency: 'BRL', amount: 11000000,
    },
    {
      kind: 'holding', key: 'knri11', currency: 'BRL', amount: 4500000,
    },
    {
      kind: 'holding', key: 'vale3', currency: 'BRL', amount: 360000,
    },
    {
      kind: 'holding', key: 'aapl', currency: 'USD', amount: 482000,
    },
    {
      kind: 'holding', key: 'msft', currency: 'USD', amount: 396000,
    },
    {
      kind: 'assetType', key: 'fii', currency: 'BRL', amount: 15500000,
    },
    {
      kind: 'assetType', key: 'stock', currency: 'BRL', amount: 360000,
    },
    {
      kind: 'assetType', key: 'stock', currency: 'USD', amount: 878000,
    },
    {
      kind: 'assetType', key: 'cd', currency: 'USD', amount: 500000,
    },
    {
      kind: 'account', key: 'checking', currency: 'USD', amount: 878000,
    },
    {
      kind: 'account', key: 'xp', currency: 'BRL', amount: 15860000,
    },
    {
      kind: 'account', key: 'savings', currency: 'USD', amount: 500000,
    },
  ],
  comingDue: [
    {
      holdingId: 'ipca35',
      name: 'Tesouro IPCA+ 2035',
      dueDate: '2035-05-15',
      currency: 'BRL',
      amount: 6000000,
    },
    {
      holdingId: 'cd',
      name: 'Used Car Savings CD',
      dueDate: '2026-12-15',
      currency: 'USD',
      amount: 500000,
    },
  ],
};

export const PAYOUTS: PayoutsReport = {
  reportType: 'payouts',
  series: [
    {
      holdingId: 'xpml11',
      currency: 'BRL',
      months: [{ month: '2026-08', amount: 85000 }, { month: '2026-09', amount: 89000 }],
    },
    {
      holdingId: 'knri11',
      currency: 'BRL',
      months: [{ month: '2026-08', amount: 20000 }, { month: '2026-09', amount: 21000 }],
    },
    {
      holdingId: 'aapl',
      currency: 'USD',
      months: [{ month: '2026-09', amount: 400 }],
    },
  ],
};

export const GOALS: readonly GoalWithProgress[] = [
  goalOf('Emergency Fund', [{
    holdingId: 'cd', name: 'CD', percentage: 64, contribution: { currency: 'USD', amount: 320000 },
  }]),
  goalOf('New Laptop Fund'),
];
