import { describe, expect, it } from 'vitest';
import { goalProgress, shareOf } from '../../../../src/engines/reporting/goalProgress';
import {
  aGoal, aHolding, anAllocation, aSnapshot, fakeDeps, HOUSEHOLD_ID,
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

describe('goalProgress (FR-8.5, FR-8.7)', () => {
  it('values a market-priced Holding by its latest snapshot, in its currency', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'petr4', 50)]);
    deps.findHoldings.mockResolvedValue([aHolding()]);
    deps.latestSnapshots.mockResolvedValue([aSnapshot('petr4', 12_345)]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress).toEqual({
      goal: TRIP,
      contributions: [{ holdingId: 'petr4', currency: 'BRL', amount: 6_173 }],
      fundedBy: [{ holdingId: 'petr4', name: 'PETR4', percentage: 50 }],
    });
    expect(deps.listAllocations).toHaveBeenCalledWith({ goalIds: ['trip'] });
    expect(deps.findHoldings).toHaveBeenCalledWith(HOUSEHOLD_ID, ['petr4']);
    expect(deps.latestSnapshots).toHaveBeenCalledWith(['petr4'], DATE);
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

    expect(progress?.contributions)
      .toEqual([{ holdingId: 'cdb', currency: 'USD', amount: 500_000 }]);
    expect(deps.costBasisAsOf).toHaveBeenCalledWith(['cdb'], DATE);
    expect(deps.latestSnapshots).toHaveBeenCalledWith([], DATE);
  });

  it('counts a Holding the viewer can\'t see, with no id or name (OQ-206)', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'bea-stock', 50)]);
    deps.findHoldings.mockResolvedValue([aHolding({ id: 'bea-stock', accountId: 'bea-personal' })]);
    deps.latestSnapshots.mockResolvedValue([aSnapshot('bea-stock', 1_000_000)]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress?.contributions)
      .toEqual([{ holdingId: null, currency: 'BRL', amount: 500_000 }]);
    expect(progress?.fundedBy).toEqual([{ holdingId: null, name: null, percentage: 50 }]);
  });

  it('leaves out a hidden Holding with no value, so hidden rows pair up in order', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([
      anAllocation('trip', 'bea-new', 10),
      anAllocation('trip', 'bea-stock', 20),
    ]);
    deps.findHoldings.mockResolvedValue([
      aHolding({ id: 'bea-new', accountId: 'bea-personal' }),
      aHolding({ id: 'bea-stock', accountId: 'bea-personal' }),
    ]);
    deps.latestSnapshots.mockResolvedValue([aSnapshot('bea-stock', 1_000)]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress?.fundedBy).toEqual([{ holdingId: null, name: null, percentage: 20 }]);
    expect(progress?.contributions).toEqual([{ holdingId: null, currency: 'BRL', amount: 200 }]);
  });

  it('lists a Holding with no value by then as funding, with no contribution', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'petr4', 40)]);
    deps.findHoldings.mockResolvedValue([aHolding({ ticker: null })]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress?.contributions).toEqual([]);
    expect(progress?.fundedBy).toEqual([{ holdingId: 'petr4', name: null, percentage: 40 }]);
  });

  it('skips an allocation whose Holding isn\'t found', async () => {
    const deps = fakeDeps();
    deps.listAllocations.mockResolvedValue([anAllocation('trip', 'gone', 40)]);

    const [progress] = await goalProgress(deps, [TRIP], QUERY);

    expect(progress).toEqual({ goal: TRIP, contributions: [], fundedBy: [] });
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

    expect(progress.map((goal) => goal.contributions)).toEqual([
      [{ holdingId: 'petr4', currency: 'BRL', amount: 4_000 }],
      [{ holdingId: 'petr4', currency: 'BRL', amount: 6_000 }],
      [],
    ]);
    expect(deps.findHoldings).toHaveBeenCalledWith(HOUSEHOLD_ID, ['petr4']);
  });
});
