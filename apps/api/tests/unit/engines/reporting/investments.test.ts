import { describe, expect, it } from 'vitest';
import {
  allocationsOf, comingDueOf, investmentsOverview, netWorthOf, payoutSeriesOf, payoutsReport,
  visibleHoldingsOf, windowOf,
} from '../../../../src/engines/reporting/investments';
import {
  aHolding, anAccount, aPayout, aSnapshot, fakeDeps, VIEWER,
} from './fakes';

// ReportingEngine's investments shapes (task 133, OQ-236), with only the
// Accessor reads beneath them faked (BDT).

const TODAY = '2026-10-13';
const CDB = aHolding({
  id: 'cdb', assetType: 'cdb', ticker: 'CDB Banco X', dueDate: '2027-03-15',
});

/**
 * Fakes the reads for a household whose viewer sees `checking` (BRL) and
 * `brokerage` (USD), holding the given Holdings.
 *
 * @param holdings - The Holdings `listHoldings` answers.
 * @returns The fakes.
 */
const householdWith = (holdings = [aHolding()]) => {
  const deps = fakeDeps();
  deps.listAccounts.mockResolvedValue([
    anAccount(), anAccount({ id: 'brokerage', currency: 'USD' }),
  ]);
  deps.listHoldings.mockResolvedValue(holdings);
  return deps;
};

describe('windowOf', () => {
  it('lists the months ending with today\'s, across a year', () => {
    expect(windowOf('2026-02-10', 4)).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
    expect(windowOf(TODAY, 1)).toEqual([{ year: 2026, month: 10 }]);
  });
});

describe('visibleHoldingsOf', () => {
  it('lists the viewer\'s Holdings, archived ones too, in their Account\'s currency', async () => {
    const deps = householdWith([aHolding(), aHolding({ id: 'aapl', accountId: 'brokerage' })]);

    const holdings = await visibleHoldingsOf(deps, VIEWER);

    expect(deps.listAccounts).toHaveBeenCalledWith(VIEWER.householdId, VIEWER.viewerUserId);
    expect(deps.listHoldings)
      .toHaveBeenCalledWith(['checking', 'brokerage'], { includeArchived: true });
    expect(holdings.map(({ id, currency }) => ({ id, currency }))).toEqual([
      { id: 'petr4', currency: 'BRL' },
      { id: 'aapl', currency: 'USD' },
    ]);
  });
});

describe('netWorthOf (FR-5.3, OQ-236)', () => {
  it('starts at the first month with value and compares with the month before', () => {
    const series = [
      { month: '2026-08', amount: 0 },
      { month: '2026-09', amount: 1_000 },
      { month: '2026-10', amount: 1_500 },
    ];

    expect(netWorthOf('BRL', series)).toEqual([{
      currency: 'BRL',
      amount: 1_500,
      changeVsPreviousMonth: 500,
      series: series.slice(1),
    }]);
  });

  it('leaves the change out when only this month holds value', () => {
    const [netWorth] = netWorthOf('BRL', [
      { month: '2026-09', amount: 0 },
      { month: '2026-10', amount: 700 },
    ]);

    expect(netWorth).toEqual({
      currency: 'BRL', amount: 700, series: [{ month: '2026-10', amount: 700 }],
    });
  });

  it('keeps a currency sold out this month, worth nothing now', () => {
    const [netWorth] = netWorthOf('USD', [
      { month: '2026-09', amount: 900 },
      { month: '2026-10', amount: 0 },
    ]);

    expect(netWorth).toMatchObject({ amount: 0, changeVsPreviousMonth: -900 });
  });

  it('leaves out a currency that never held value', () => {
    expect(netWorthOf('USD', [{ month: '2026-10', amount: 0 }])).toEqual([]);
  });
});

describe('allocationsOf (OQ-233)', () => {
  it('slices today\'s value by Holding, type and Account, per currency, none empty', () => {
    const holdings = [
      { ...aHolding(), currency: 'BRL' },
      { ...aHolding({ id: 'vale3', ticker: 'VALE3' }), currency: 'BRL' },
      { ...aHolding({ id: 'aapl', accountId: 'brokerage' }), currency: 'USD' },
      { ...aHolding({ id: 'empty' }), currency: 'BRL' },
    ];
    const values = new Map([['petr4', 100], ['vale3', 50], ['aapl', 70]]);

    expect(allocationsOf(holdings, values)).toEqual([
      {
        kind: 'holding', key: 'petr4', currency: 'BRL', amount: 100,
      },
      {
        kind: 'holding', key: 'vale3', currency: 'BRL', amount: 50,
      },
      {
        kind: 'holding', key: 'aapl', currency: 'USD', amount: 70,
      },
      {
        kind: 'assetType', key: 'stock', currency: 'BRL', amount: 150,
      },
      {
        kind: 'assetType', key: 'stock', currency: 'USD', amount: 70,
      },
      {
        kind: 'account', key: 'checking', currency: 'BRL', amount: 150,
      },
      {
        kind: 'account', key: 'brokerage', currency: 'USD', amount: 70,
      },
    ]);
  });
});

describe('comingDueOf (OQ-236)', () => {
  it('lists the fixed-term Holdings with principal left, soonest first, ties by id', () => {
    const holdings = [
      aHolding(),
      CDB,
      aHolding({
        id: 'lci', assetType: 'lci', ticker: null, dueDate: '2026-12-01',
      }),
      aHolding({
        id: 'cda', assetType: 'cdb', ticker: 'A', dueDate: '2027-03-15',
      }),
      aHolding({ id: 'redeemed', assetType: 'cdb', dueDate: '2026-11-01' }),
    ];
    const values = new Map([['petr4', 10], ['cdb', 5_000], ['lci', 3_000], ['cda', 1_000]]);

    expect(comingDueOf(holdings, values)).toEqual([
      {
        holdingId: 'lci', name: '', dueDate: '2026-12-01', currency: 'BRL', amount: 3_000,
      },
      {
        holdingId: 'cda', name: 'A', dueDate: '2027-03-15', currency: 'BRL', amount: 1_000,
      },
      {
        holdingId: 'cdb',
        name: 'CDB Banco X',
        dueDate: '2027-03-15',
        currency: 'BRL',
        amount: 5_000,
      },
    ]);
  });
});

describe('investmentsOverview (FR-5.3, FR-5.9)', () => {
  it('values each month on its last day, this one today, archived Holdings too', async () => {
    const archived = aHolding({ id: 'sold', archivedAt: new Date('2026-09-20') });
    const deps = householdWith([aHolding(), archived, CDB]);
    deps.latestSnapshots.mockImplementation(async (_ids, date) => (
      date === TODAY ? [aSnapshot('petr4', 300)] : [aSnapshot('petr4', 200), aSnapshot('sold', 50)]
    ));
    deps.costBasisAsOf.mockImplementation(async () => [{ holdingId: 'cdb', costBasis: 1_000 }]);

    const overview = await investmentsOverview(deps, VIEWER, { today: TODAY, months: 2 });

    expect(overview.netWorth).toEqual([{
      currency: 'BRL',
      amount: 1_300,
      changeVsPreviousMonth: 50,
      series: [{ month: '2026-09', amount: 1_250 }, { month: '2026-10', amount: 1_300 }],
    }]);
    expect(deps.latestSnapshots).toHaveBeenCalledWith(['petr4', 'sold'], '2026-09-30');
    expect(deps.latestSnapshots).toHaveBeenCalledWith(['petr4', 'sold'], TODAY);
    // Today's slices and Coming Due read the active Holdings only.
    expect(deps.latestSnapshots).toHaveBeenCalledWith(['petr4'], TODAY);
    expect(overview.allocations.filter((slice) => slice.kind === 'holding')).toEqual([
      {
        kind: 'holding', key: 'petr4', currency: 'BRL', amount: 300,
      },
      {
        kind: 'holding', key: 'cdb', currency: 'BRL', amount: 1_000,
      },
    ]);
    expect(overview.comingDue).toEqual([{
      holdingId: 'cdb', name: 'CDB Banco X', dueDate: '2027-03-15', currency: 'BRL', amount: 1_000,
    }]);
  });

  it('lists this month\'s payouts of every visible Holding, one entry each', async () => {
    const deps = householdWith([aHolding(), CDB]);
    deps.listPayouts.mockResolvedValue([
      aPayout(),
      aPayout({
        id: 'coupon', kind: 'investment_interest', holdingId: 'cdb', amount: 400,
      }),
    ]);

    const overview = await investmentsOverview(deps, VIEWER, { today: TODAY, months: 6 });

    expect(deps.listPayouts).toHaveBeenCalledWith(['petr4', 'cdb'], '2026-10-01', '2026-10-31');
    expect(overview.payoutThisMonth).toEqual([
      {
        holdingId: 'petr4',
        transactionId: 'payout',
        kind: 'investment_dividend',
        date: '2026-10-05',
        currency: 'BRL',
        amount: 1_000,
      },
      {
        holdingId: 'cdb',
        transactionId: 'coupon',
        kind: 'investment_interest',
        date: '2026-10-05',
        currency: 'BRL',
        amount: 400,
      },
    ]);
  });

  it('answers empty lists for a household with no Holding', async () => {
    const deps = householdWith([]);

    expect(await investmentsOverview(deps, VIEWER, { today: TODAY, months: 6 })).toEqual({
      netWorth: [], payoutThisMonth: [], allocations: [], comingDue: [],
    });
  });
});

describe('payoutSeriesOf (FR-5.9)', () => {
  it('sums each Holding\'s payouts by month and currency, every month filled', () => {
    const window = windowOf(TODAY, 3);

    expect(payoutSeriesOf([
      aPayout({ date: '2026-08-05', amount: 100 }),
      aPayout({ date: '2026-10-01', amount: 30 }),
      aPayout({ date: '2026-10-20', amount: 20 }),
      aPayout({
        holdingId: 'aapl', currency: 'USD', date: '2026-09-15', amount: 7,
      }),
    ], window)).toEqual([
      {
        holdingId: 'petr4',
        currency: 'BRL',
        months: [
          { month: '2026-08', amount: 100 },
          { month: '2026-09', amount: 0 },
          { month: '2026-10', amount: 50 },
        ],
      },
      {
        holdingId: 'aapl',
        currency: 'USD',
        months: [
          { month: '2026-08', amount: 0 },
          { month: '2026-09', amount: 7 },
          { month: '2026-10', amount: 0 },
        ],
      },
    ]);
  });
});

describe('payoutsReport (FR-5.9, OQ-233)', () => {
  it('reads every visible Holding over the window when none is chosen', async () => {
    const deps = householdWith([aHolding(), CDB]);

    expect(await payoutsReport(deps, VIEWER, { months: 12, today: TODAY })).toEqual([]);
    expect(deps.listPayouts).toHaveBeenCalledWith(['petr4', 'cdb'], '2025-11-01', '2026-10-31');
  });

  it('ignores a chosen id the viewer can\'t see or that no longer exists', async () => {
    const deps = householdWith([aHolding(), CDB]);
    deps.listPayouts.mockResolvedValue([aPayout()]);

    const series = await payoutsReport(deps, VIEWER, {
      holdingIds: ['cdb', 'hidden'], months: 1, today: TODAY,
    });

    expect(deps.listPayouts).toHaveBeenCalledWith(['cdb'], '2026-10-01', '2026-10-31');
    expect(series).toHaveLength(1);
  });
});
