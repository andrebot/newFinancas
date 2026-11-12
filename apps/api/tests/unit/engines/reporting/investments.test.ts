import { describe, expect, it } from 'vitest';
import {
  activeOn, allocationsOf, comingDueOf, dashboardInvestments, investmentsOverview, netWorthOf,
  payoutSeriesOf, payoutsReport, visibleHoldingsOf, windowOf,
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

describe('activeOn (OQ-236)', () => {
  it('counts a Holding until the day it was archived, in the app\'s time zone', () => {
    // 02:00 UTC on 1 October is still 30 September in São Paulo.
    const archived = aHolding({ archivedAt: new Date('2026-10-01T02:00:00Z') });

    expect(activeOn(archived, '2026-09-29')).toBe(true);
    expect(activeOn(archived, '2026-09-30')).toBe(false);
    expect(activeOn(aHolding(), '2030-01-01')).toBe(true);
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
  it('values each month on its last day, this one today', async () => {
    const deps = householdWith([aHolding(), CDB]);
    deps.latestSnapshots.mockImplementation(async (ids, date) => (
      ids.includes('petr4') ? [aSnapshot('petr4', date === TODAY ? 300 : 200)] : []
    ));
    deps.costBasisAsOf.mockImplementation(async (ids) => (
      ids.includes('cdb') ? [{ holdingId: 'cdb', costBasis: 1_000 }] : []
    ));

    const overview = await investmentsOverview(deps, VIEWER, { today: TODAY, months: 2 });

    expect(overview.netWorth).toEqual([{
      currency: 'BRL',
      amount: 1_300,
      changeVsPreviousMonth: 100,
      series: [{ month: '2026-09', amount: 1_200 }, { month: '2026-10', amount: 1_300 }],
    }]);
    expect(deps.latestSnapshots).toHaveBeenCalledWith(['petr4'], '2026-09-30');
    expect(deps.costBasisAsOf).toHaveBeenCalledWith(['cdb'], TODAY);
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

  it('counts an archived Holding only before the day it was archived (OQ-236)', async () => {
    // A stock sold out in September, and a matured CDB archived by hand in
    // October with its redemption never recorded: its principal is still there.
    const sold = aHolding({ id: 'sold', archivedAt: new Date('2026-09-20T12:00:00Z') });
    const matured = aHolding({
      id: 'matured',
      assetType: 'cdb',
      dueDate: '2026-08-15',
      archivedAt: new Date('2026-10-02T12:00:00Z'),
    });
    const deps = householdWith([aHolding(), sold, matured]);
    deps.latestSnapshots.mockImplementation(async (ids) => [
      aSnapshot('petr4', 200), aSnapshot('sold', 50),
    ].filter(({ holdingId }) => ids.includes(holdingId)));
    deps.costBasisAsOf.mockImplementation(async (ids) => (
      ids.includes('matured') ? [{ holdingId: 'matured', costBasis: 1_000 }] : []
    ));

    const overview = await investmentsOverview(deps, VIEWER, { today: TODAY, months: 3 });

    expect(overview.netWorth).toEqual([{
      currency: 'BRL',
      amount: 200,
      changeVsPreviousMonth: -1_000,
      series: [
        { month: '2026-08', amount: 1_250 },
        { month: '2026-09', amount: 1_200 },
        { month: '2026-10', amount: 200 },
      ],
    }]);
    // Net worth today is what today's slices add up to.
    expect(overview.allocations.filter((slice) => slice.kind === 'holding')).toEqual([
      {
        kind: 'holding', key: 'petr4', currency: 'BRL', amount: 200,
      },
    ]);
    expect(overview.comingDue).toEqual([]);
  });

  it('keeps a currency whose Holdings were all archived, at nothing since', async () => {
    const sold = aHolding({ id: 'aapl', archivedAt: new Date('2026-10-01T12:00:00Z') });
    const deps = householdWith([{ ...sold, accountId: 'brokerage' }]);
    deps.latestSnapshots.mockImplementation(async (ids) => (
      ids.includes('aapl') ? [aSnapshot('aapl', 70)] : []
    ));

    const overview = await investmentsOverview(deps, VIEWER, { today: TODAY, months: 2 });

    expect(overview.netWorth).toEqual([{
      currency: 'USD',
      amount: 0,
      changeVsPreviousMonth: -70,
      series: [{ month: '2026-09', amount: 70 }, { month: '2026-10', amount: 0 }],
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

describe('dashboardInvestments (OQ-242, OQ-243)', () => {
  it('answers the overview\'s net worth and Coming Due, reading no payouts', async () => {
    const deps = householdWith([aHolding(), CDB]);
    deps.latestSnapshots.mockImplementation(async (ids) => (
      ids.includes('petr4') ? [aSnapshot('petr4', 300)] : []
    ));
    deps.costBasisAsOf.mockImplementation(async (ids) => (
      ids.includes('cdb') ? [{ holdingId: 'cdb', costBasis: 1_000 }] : []
    ));

    const panels = await dashboardInvestments(deps, VIEWER, { today: TODAY, months: 2 });
    const overview = await investmentsOverview(deps, VIEWER, { today: TODAY, months: 2 });

    expect(panels).toEqual({ netWorth: overview.netWorth, comingDue: overview.comingDue });
    expect(panels.comingDue).toHaveLength(1);
    expect(deps.listPayouts).toHaveBeenCalledTimes(1);
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
