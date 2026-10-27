import { describe, expect, it } from 'vitest';
import {
  goalProgress, shareOf, visibleAccountIdsOf,
} from '../../../../src/engines/reporting/goalProgress';
import {
  aGoal, aHolding, anAccount, anAllocation, aSnapshot, fakeDeps, HOUSEHOLD_ID,
} from './fakes';

const DATE = '2026-01-31';
const QUERY = { householdId: HOUSEHOLD_ID, visibleAccountIds: new Set(['checking']), date: DATE };
const TRIP = aGoal();

describe('shareOf (OQ-87)', () => {
  it('takes whole percent of a value, rounded half-up to the minor unit', () => {
    expect(shareOf(12_345, 50)).toBe(6_173);
    expect(shareOf(1_001, 33)).toBe(330);
    expect(shareOf(10_000, 100)).toBe(10_000);
  });
});

describe('visibleAccountIdsOf', () => {
  it('collects the viewer\'s Account ids', () => {
    expect(visibleAccountIdsOf([anAccount(), anAccount({ id: 'savings' })]))
      .toEqual(new Set(['checking', 'savings']));
  });
});

describe('goalProgress (FR-8.5, FR-8.7)', () => {
  it('values a market-priced Holding by its latest snapshot, in its currency', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'petr4', 50)]);
    deps.findHoldings.mockResolvedValue([aHolding()]);
    deps.latestSnapshots.mockResolvedValue([aSnapshot('petr4', 12_345)]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress).toEqual({
      goal: TRIP,
      fundedBy: [{
        holdingId: 'petr4',
        name: 'PETR4',
        percentage: 50,
        contribution: { currency: 'BRL', amount: 6_173 },
      }],
    });
    expect(deps.findHoldings).toHaveBeenCalledWith(HOUSEHOLD_ID, ['petr4']);
    expect(deps.latestSnapshots).toHaveBeenCalledWith(['petr4'], DATE);
  });

  it('reads the Goal split in effect on the day (OQ-206)', async () => {
    const deps = fakeDeps();

    await goalProgress(deps, [TRIP], QUERY);

    expect(deps.listAllocations).toHaveBeenCalledWith({ goalIds: ['trip'] }, DATE);
  });

  it('values a fixed-term Holding by its trades\' cost basis (OQ-51, OQ-206)', async () => {
    const deps = fakeDeps();
    const cdb = aHolding({
      id: 'cdb', assetType: 'cdb', ticker: 'CDB Banco X', currency: 'USD',
    });
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'cdb', 100)]);
    deps.findHoldings.mockResolvedValue([cdb]);
    deps.costBasisAsOf.mockResolvedValue([{ holdingId: 'cdb', costBasis: 500_000 }]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress?.fundedBy[0]?.contribution).toEqual({ currency: 'USD', amount: 500_000 });
    expect(deps.costBasisAsOf).toHaveBeenCalledWith(['cdb'], DATE);
    expect(deps.latestSnapshots).toHaveBeenCalledWith([], DATE);
  });

  it('counts a Holding the viewer can\'t see, with no id or name (OQ-206)', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'bea-stock', 50)]);
    deps.findHoldings.mockResolvedValue([aHolding({ id: 'bea-stock', accountId: 'bea-personal' })]);
    deps.latestSnapshots.mockResolvedValue([aSnapshot('bea-stock', 1_000_000)]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress?.fundedBy).toEqual([{
      holdingId: null,
      name: null,
      percentage: 50,
      contribution: { currency: 'BRL', amount: 500_000 },
    }]);
  });

  it('lists a Holding with no value by then with no contribution', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'petr4', 40)]);
    deps.findHoldings.mockResolvedValue([aHolding({ ticker: null })]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress?.fundedBy).toEqual([{
      holdingId: 'petr4', name: null, percentage: 40, contribution: null,
    }]);
  });

  it('skips an allocation whose Holding isn\'t found', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'gone', 40)]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress).toEqual({ goal: TRIP, fundedBy: [] });
  });

  it('splits one Holding between Goals by their shares, keeping the Goals\' order', async () => {
    const deps = fakeDeps();
    const house = aGoal({ id: 'house', name: 'House' });
    const empty = aGoal({ id: 'empty' });
    deps.listAllocations.mockResolvedValue([
      anAllocation('trip', 'petr4', 60),
      anAllocation('house', 'petr4', 40),
    ]);
    deps.findHoldings.mockResolvedValue([aHolding()]);
    deps.latestSnapshots.mockResolvedValue([aSnapshot('petr4', 10_000)]);

    const progress = await goalProgress(deps, [house, TRIP, empty], QUERY);

    expect(progress.map((goal) => goal.fundedBy.map((row) => row.contribution?.amount)))
      .toEqual([[4_000], [6_000], []]);
    expect(deps.findHoldings).toHaveBeenCalledWith(HOUSEHOLD_ID, ['petr4']);
  });
});
