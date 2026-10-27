import type { GoalWithProgress } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  contributionsOf, convert, dueInOf, fundingRowsOf, pairKey, progressOf, ratePairOf,
} from '../../../../../../src/experiences/accountSetup/flows/goalManagement/goalProgress';

// A Goal's progress (BDT: Flow-tier pure logic, unit; nothing mocked) — the
// join of contributions to funders, the conversion at a typed rate, and the
// due countdown (FR-8.4/8.5, FR-9, OQ-195).

const USD_BRL = { base: 'USD', quote: 'BRL' } as const;

/**
 * Builds a Goal with its progress, mockup 43's Trip to Japan unless overridden.
 *
 * @param over - The fields to change.
 * @returns The Goal.
 */
const goal = (over: Partial<GoalWithProgress> = {}): GoalWithProgress => ({
  id: 'trip',
  householdId: 'home',
  ownerUserId: 'jane',
  name: 'Trip to Japan',
  targetAmount: 600000,
  targetCurrency: 'USD',
  dueDate: '2028-04-01',
  visibility: 'shared',
  createdAt: '2026-01-01T00:00:00Z',
  completedAt: null,
  contributions: [
    { holdingId: 'aapl', currency: 'USD', amount: 48200 },
    { holdingId: 'xpml', currency: 'BRL', amount: 1650000 },
  ],
  fundedBy: [
    { holdingId: 'aapl', name: 'AAPL', percentage: 10 },
    { holdingId: 'xpml', name: 'XPML11', percentage: 15 },
  ],
  ...over,
});

describe('ratePairOf / pairKey', () => {
  it('puts USD first whichever currency is the target', () => {
    expect(ratePairOf('USD', 'BRL')).toEqual(USD_BRL);
    expect(ratePairOf('BRL', 'USD')).toEqual(USD_BRL);
    expect(pairKey(USD_BRL)).toBe('USD/BRL');
  });
});

describe('convert', () => {
  it('multiplies from the base and divides into it, half-up to the cent', () => {
    expect(convert(10000, 'USD', USD_BRL, 52000)).toBe(52000);
    expect(convert(1650000, 'BRL', USD_BRL, 52000)).toBe(317308);
    expect(convert(1, 'BRL', USD_BRL, 40000)).toBe(0);
    expect(convert(2, 'BRL', USD_BRL, 40000)).toBe(1);
  });
});

describe('fundingRowsOf', () => {
  it('joins each funder to its contribution, converting a foreign one at its rate', () => {
    expect(fundingRowsOf(goal(), { 'USD/BRL': 52000 })).toEqual([
      {
        holdingId: 'aapl',
        name: 'AAPL',
        percentage: 10,
        contribution: { currency: 'USD', amount: 48200 },
      },
      {
        holdingId: 'xpml',
        name: 'XPML11',
        percentage: 15,
        contribution: { currency: 'BRL', amount: 1650000 },
        converted: 317308,
      },
    ]);
  });

  it('leaves a foreign contribution unconverted without a rate', () => {
    expect(fundingRowsOf(goal(), {})[1]?.converted).toBeUndefined();
  });

  it('lists a funder the contributions lack without an amount', () => {
    const rows = fundingRowsOf(goal({ contributions: [] }), {});
    expect(rows[0]).toEqual({ holdingId: 'aapl', name: 'AAPL', percentage: 10 });
  });
});

describe('contributionsOf (OQ-206)', () => {
  it('pairs Holdings the viewer can\'t see by order, the others by id', () => {
    const hidden = goal({
      contributions: [
        { holdingId: null, currency: 'USD', amount: 100 },
        { holdingId: 'aapl', currency: 'USD', amount: 500 },
        { holdingId: null, currency: 'BRL', amount: 200 },
      ],
      fundedBy: [
        { holdingId: 'aapl', name: 'AAPL', percentage: 10 },
        { holdingId: null, name: null, percentage: 20 },
        { holdingId: null, name: null, percentage: 30 },
        { holdingId: 'xpml', name: 'XPML11', percentage: 15 },
      ],
    });

    expect(contributionsOf(hidden).map((item) => item?.amount)).toEqual([500, 100, 200, undefined]);
  });
});

describe('progressOf', () => {
  it('blends a mixed goal into an estimate once its rate is typed (mockup 43)', () => {
    expect(progressOf(goal(), { 'USD/BRL': 52000 })).toMatchObject({
      funded: 365508,
      percent: 61,
      toGo: 234492,
      mixed: true,
      estimate: true,
      pairs: [USD_BRL],
      missingPairs: [],
    });
  });

  it('counts only the target currency and names the missing pair without a rate', () => {
    expect(progressOf(goal(), {})).toMatchObject({
      funded: 48200,
      percent: 8,
      mixed: true,
      estimate: false,
      pairs: [USD_BRL],
      missingPairs: [USD_BRL],
    });
  });

  it('names a missing pair once, however many holdings need it', () => {
    const twoBrl = goal({
      contributions: [
        { holdingId: 'aapl', currency: 'BRL', amount: 100 },
        { holdingId: 'xpml', currency: 'BRL', amount: 200 },
      ],
    });
    expect(progressOf(twoBrl, {}).missingPairs).toEqual([USD_BRL]);
  });

  it('adds a single-currency goal exactly, with nothing to estimate', () => {
    const house = goal({
      targetAmount: 15000000,
      targetCurrency: 'BRL',
      contributions: [{ holdingId: 'selic', currency: 'BRL', amount: 8500000 }],
      fundedBy: [{ holdingId: 'selic', name: 'Tesouro Selic 2029', percentage: 45 }],
    });
    expect(progressOf(house, {})).toMatchObject({
      funded: 8500000, percent: 57, toGo: 6500000, mixed: false, estimate: false,
    });
  });

  it('reads an unfunded goal as 0% with the whole target to go', () => {
    expect(progressOf(goal({ contributions: [], fundedBy: [] }), {})).toMatchObject({
      rows: [], funded: 0, percent: 0, toGo: 600000, mixed: false, pairs: [],
    });
  });

  it('holds what is left at zero once the target is passed', () => {
    const over = goal({ contributions: [{ holdingId: 'aapl', currency: 'USD', amount: 700000 }] });
    expect(progressOf(over, {})).toMatchObject({ percent: 117, toGo: 0 });
  });
});

describe('dueInOf', () => {
  it('counts calendar months and years ahead (mockup 43)', () => {
    expect(dueInOf('2027-12-31', '2026-09-30')).toEqual({ kind: 'ahead', years: 1, months: 3 });
    expect(dueInOf('2027-03-01', '2026-09-30')).toEqual({ kind: 'ahead', years: 0, months: 6 });
    expect(dueInOf('2029-06-30', '2026-09-30')).toEqual({ kind: 'ahead', years: 2, months: 9 });
  });

  it('reads a date later this calendar month as this month', () => {
    expect(dueInOf('2026-09-30', '2026-09-01')).toEqual({ kind: 'thisMonth' });
  });

  it('reads any day of next month as a month ahead, however near', () => {
    expect(dueInOf('2026-10-01', '2026-09-30')).toEqual({ kind: 'ahead', years: 0, months: 1 });
    expect(dueInOf('2026-11-05', '2026-10-22')).toEqual({ kind: 'ahead', years: 0, months: 1 });
    expect(dueInOf('2026-11-30', '2026-10-01')).toEqual({ kind: 'ahead', years: 0, months: 1 });
  });

  it('counts a year across December by its months', () => {
    expect(dueInOf('2027-01-02', '2026-12-31')).toEqual({ kind: 'ahead', years: 0, months: 1 });
    expect(dueInOf('2027-12-01', '2026-12-31')).toEqual({ kind: 'ahead', years: 1, months: 0 });
  });

  it('reads today as this month and yesterday as overdue', () => {
    expect(dueInOf('2026-09-30', '2026-09-30')).toEqual({ kind: 'thisMonth' });
    expect(dueInOf('2026-09-29', '2026-09-30')).toEqual({ kind: 'overdue' });
  });
});
