import { describe, expect, it } from 'vitest';
import {
  accountRowsOf, familySharesOf, payoutRowsOf, totalsByCurrency, typeSharesOf,
} from '../../../../../../src/experiences/trackInvestments/flows/portfolioOverview/portfolioOverview';
import {
  holdingOf, HOLDINGS, INVESTMENT_ACCOUNTS, OVERVIEW,
} from '../../../portfolioFixtures';

// What the Portfolio Overview reads from its report (BDT: pure helpers,
// unit, nothing mocked).

describe('payoutRowsOf', () => {
  it('puts R$ first, then the largest first, each named and in its family', () => {
    expect(payoutRowsOf(OVERVIEW.payoutThisMonth, HOLDINGS, '?').map((row) => (
      [row.ticker, row.family, row.entry.amount]
    ))).toEqual([
      ['XPML11', 'fii', 89000],
      ['KNRI11', 'fii', 21000],
      ['AAPL', 'stock', 400],
      ['Used Car Savings CD', 'fixedIncome', 280],
    ]);
  });

  it('names a Holding the list lacks by the stand-in, in other', () => {
    const [row] = payoutRowsOf([OVERVIEW.payoutThisMonth[0]!], [], 'Unnamed holding');
    expect([row?.ticker, row?.family]).toEqual(['Unnamed holding', 'other']);
  });
});

describe('totalsByCurrency', () => {
  it('adds up per currency, R$ first, never across currencies', () => {
    expect(totalsByCurrency(OVERVIEW.payoutThisMonth)).toEqual([
      { currency: 'BRL', amount: 110000 },
      { currency: 'USD', amount: 680 },
    ]);
  });

  it('leaves out a currency with nothing in it', () => {
    expect(totalsByCurrency([{ currency: 'USD', amount: 5 }]))
      .toEqual([{ currency: 'USD', amount: 5 }]);
    expect(totalsByCurrency([])).toEqual([]);
  });
});

describe('familySharesOf', () => {
  it('shares out one family per currency, largest first, in whole percents', () => {
    expect(familySharesOf(OVERVIEW.allocations, HOLDINGS, 'stock')).toEqual([
      {
        currency: 'BRL',
        total: 360000,
        shares: [{
          key: 'vale3', label: 'VALE3', amount: 360000, percent: 100,
        }],
      },
      {
        currency: 'USD',
        total: 878000,
        shares: [
          {
            key: 'aapl', label: 'AAPL', amount: 482000, percent: 55,
          },
          {
            key: 'msft', label: 'MSFT', amount: 396000, percent: 45,
          },
        ],
      },
    ]);
  });

  it('puts the largest first whichever order the slices come in (R4 V4)', () => {
    const slices = [
      {
        kind: 'holding' as const, key: 'msft', currency: 'USD' as const, amount: 100,
      },
      {
        kind: 'holding' as const, key: 'aapl', currency: 'USD' as const, amount: 300,
      },
    ];
    const [usd] = familySharesOf(slices, HOLDINGS, 'stock');
    expect(usd?.shares.map((share) => share.key)).toEqual(['aapl', 'msft']);
  });

  it('keeps to the family and to Holding slices', () => {
    const [brl] = familySharesOf(OVERVIEW.allocations, HOLDINGS, 'fii');
    expect(brl?.shares.map((share) => [share.key, share.percent]))
      .toEqual([['xpml11', 71], ['knri11', 29]]);
  });

  it('has nothing for a family the household doesn\'t hold', () => {
    expect(familySharesOf(OVERVIEW.allocations, [holdingOf('xpml11')], 'stock')).toEqual([]);
  });

  it('leaves out a currency whose Holdings are worth nothing', () => {
    const slices = [{
      kind: 'holding' as const, key: 'aapl', currency: 'USD' as const, amount: 0,
    }];
    expect(familySharesOf(slices, HOLDINGS, 'stock')).toEqual([]);
  });
});

describe('typeSharesOf', () => {
  it('shares out the asset types per currency, named by the caller', () => {
    const wholes = typeSharesOf(OVERVIEW.allocations, (code) => code.toUpperCase());
    expect(wholes.map(({ currency, total, shares }) => (
      [currency, total, shares.map((share) => share.label)]
    ))).toEqual([
      ['BRL', 15860000, ['FII', 'STOCK']],
      ['USD', 1378000, ['STOCK', 'CD']],
    ]);
  });
});

describe('accountRowsOf', () => {
  it('lists each account\'s Holdings, R$ first, with its open Holdings counted', () => {
    expect(accountRowsOf(OVERVIEW.allocations, INVESTMENT_ACCOUNTS, HOLDINGS)).toEqual([
      {
        key: 'xp:BRL', name: 'XP Investimentos', currency: 'BRL', amount: 15860000, holdings: 4,
      },
      {
        key: 'checking:USD', name: 'Main Checking', currency: 'USD', amount: 878000, holdings: 2,
      },
      {
        key: 'savings:USD', name: 'Emergency Fund', currency: 'USD', amount: 500000, holdings: 1,
      },
    ]);
  });

  it('puts R$ first even when smaller, then the largest first (R4 V4)', () => {
    const slices = [
      {
        kind: 'account' as const, key: 'checking', currency: 'USD' as const, amount: 900,
      },
      {
        kind: 'account' as const, key: 'xp', currency: 'BRL' as const, amount: 100,
      },
      {
        kind: 'account' as const, key: 'savings', currency: 'USD' as const, amount: 950,
      },
    ];
    expect(accountRowsOf(slices, INVESTMENT_ACCOUNTS, []).map((row) => row.key))
      .toEqual(['xp:BRL', 'savings:USD', 'checking:USD']);
  });

  it('names an account it doesn\'t know by nothing', () => {
    const [row] = accountRowsOf(OVERVIEW.allocations, [], []);
    expect([row?.name, row?.holdings]).toEqual(['', 0]);
  });
});
