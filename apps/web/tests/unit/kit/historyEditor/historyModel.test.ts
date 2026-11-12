import { describe, expect, it } from 'vitest';
import {
  changeOf, chartPointsOf, draftErrorsOf, formatValueOf, impactDateOf, isCompleteDate,
  isDraftValid, pendingOf, withChanges, type HistoryDraftContext, type HistoryEntry,
  type HistoryValueKind,
} from '../../../../src/kit/historyEditor/historyModel';
import { createFormatter } from '../../../../src/utilities/formatting';

// Kit arithmetic (BDT: Interaction tier → unit): pure, nothing mocked; the
// real FormattingUtility writes the labels.

const BRL: HistoryValueKind = { kind: 'money', currency: 'BRL' };
const RATE: HistoryValueKind = { kind: 'rate' };
const formatter = createFormatter('en-US');

const ENTRIES: HistoryEntry[] = [
  { key: 'aug', date: '2026-08-31', value: 11000000 },
  {
    key: 'jul', date: '2026-07-31', value: 11165000, lockedReason: 'From a buy',
  },
  { key: 'jun', date: '2026-06-30', value: 10807000 },
];

/**
 * Builds a draft's context over the entries above.
 *
 * @param overrides - What to change in the defaults.
 * @returns The context.
 */
const contextOf = (overrides: Partial<HistoryDraftContext> = {}): HistoryDraftContext => ({
  today: '2026-09-30',
  valueKind: BRL,
  entries: ENTRIES,
  uniqueDays: false,
  ...overrides,
});

describe('changeOf', () => {
  it('has no change for the first value', () => {
    expect(changeOf(100, undefined, BRL)).toBeUndefined();
  });

  it('reads money as a ratio of the value before', () => {
    expect(changeOf(98500, 100000, BRL)).toEqual({ unit: 'ratio', amount: -0.015 });
  });

  it('has no ratio after a money value of zero', () => {
    expect(changeOf(100, 0, BRL)).toBeUndefined();
  });

  it('reads a rate as a difference in points, even from zero', () => {
    expect(changeOf(107500, 105000, RATE)).toEqual({ unit: 'points', amount: 2500 });
    expect(changeOf(2500, 0, RATE)).toEqual({ unit: 'points', amount: 2500 });
  });
});

describe('withChanges', () => {
  it('compares each value with the next one down, the last with nothing', () => {
    const changes = withChanges(ENTRIES, RATE).map(({ entry, change }) => [entry.key, change]);

    expect(changes).toEqual([
      ['aug', { unit: 'points', amount: -165000 }],
      ['jul', { unit: 'points', amount: 358000 }],
      ['jun', undefined],
    ]);
  });
});

describe('formatValueOf', () => {
  it('writes money in its currency and a rate as a percent', () => {
    expect(formatValueOf(11000000, BRL, formatter)).toBe('R$\u00a0110.000,00');
    expect(formatValueOf(105000, RATE, formatter)).toBe('10.50%');
  });
});

describe('chartPointsOf', () => {
  it('turns the newest-first list into an oldest-first series, a locked value unpickable', () => {
    const points = chartPointsOf(ENTRIES, BRL, formatter);

    expect(points.map((point) => [point.key, point.selectable])).toEqual([
      ['jun', true], ['jul', false], ['aug', true],
    ]);
    expect(points[0]).toMatchObject({
      date: '2026-06-30',
      value: 10807000,
      valueLabel: 'R$\u00a0108.070,00',
      dateLabel: '06/30/2026',
    });
  });

  it('keeps same-day values with the newest saved last, the one that counts', () => {
    const sameDay = [
      { key: 'later', date: '2026-08-31', value: 2 },
      { key: 'earlier', date: '2026-08-31', value: 1 },
    ];

    expect(chartPointsOf(sameDay, BRL, formatter).map((point) => point.key))
      .toEqual(['earlier', 'later']);
  });
});

describe('isCompleteDate', () => {
  it('accepts only a whole, real day', () => {
    expect(isCompleteDate('2026-08-31')).toBe(true);
    expect(isCompleteDate('')).toBe(false);
    expect(isCompleteDate('2026-0-')).toBe(false);
    expect(isCompleteDate('2026-02-30')).toBe(false);
  });
});

describe('pendingOf', () => {
  it('draws nothing until the draft is complete', () => {
    expect(pendingOf({ date: '2026-08-3', value: 1 }, undefined)).toBeUndefined();
    expect(pendingOf({ date: '2026-08-31', value: null }, undefined)).toBeUndefined();
  });

  it('draws a complete new value', () => {
    expect(pendingOf({ date: '2026-08-31', value: 1 }, undefined))
      .toEqual({ date: '2026-08-31', value: 1 });
  });

  it('draws an edit only once it differs from the saved value', () => {
    const original = ENTRIES[0];

    expect(pendingOf({ date: '2026-08-31', value: 11000000 }, original)).toBeUndefined();
    expect(pendingOf({ date: '2026-08-30', value: 11000000 }, original))
      .toEqual({ date: '2026-08-30', value: 11000000 });
    expect(pendingOf({ date: '2026-08-31', value: 5 }, original))
      .toEqual({ date: '2026-08-31', value: 5 });
  });
});

describe('impactDateOf', () => {
  it('takes the typed day for a new value, nothing while it is incomplete', () => {
    expect(impactDateOf('2026-07-15', undefined)).toBe('2026-07-15');
    expect(impactDateOf('2026-07', undefined)).toBeUndefined();
  });

  it('takes the earlier of the old and new day for an edit', () => {
    expect(impactDateOf('2026-06-15', '2026-07-31')).toBe('2026-06-15');
    expect(impactDateOf('2026-08-15', '2026-07-31')).toBe('2026-07-31');
  });

  it('keeps the old day while the new one is incomplete', () => {
    expect(impactDateOf('', '2026-07-31')).toBe('2026-07-31');
  });
});

describe('draftErrorsOf', () => {
  it('passes a complete draft', () => {
    const errors = draftErrorsOf({ date: '2026-09-30', value: 0 }, contextOf());

    expect(errors).toEqual({});
    expect(isDraftValid(errors)).toBe(true);
  });

  it('requires both fields', () => {
    const errors = draftErrorsOf({ date: '', value: null }, contextOf());

    expect(errors).toEqual({ date: { code: 'field.required' }, value: { code: 'field.required' } });
    expect(isDraftValid(errors)).toBe(false);
  });

  it('holds back a draft whose only problem is its value (R4 V5)', () => {
    expect(isDraftValid({ value: { code: 'number.min' } })).toBe(false);
  });

  it('refuses a malformed day and one after today', () => {
    expect(draftErrorsOf({ date: '2026-0-', value: 1 }, contextOf()).date)
      .toEqual({ code: 'string.format', params: { format: 'date' } });
    expect(draftErrorsOf({ date: '2026-10-01', value: 1 }, contextOf()).date)
      .toMatchObject({ code: 'date.max' });
  });

  it('refuses money below zero but lets a rate go there', () => {
    expect(draftErrorsOf({ date: '2026-09-30', value: -1 }, contextOf()).value)
      .toMatchObject({ code: 'number.min' });
    expect(draftErrorsOf({ date: '2026-09-30', value: -1 }, contextOf({ valueKind: RATE })))
      .toEqual({});
  });

  it('refuses a taken day only when days are unique, and not the value\'s own', () => {
    const draft = { date: '2026-08-31', value: 1 };

    expect(draftErrorsOf(draft, contextOf()).date).toBeUndefined();
    expect(draftErrorsOf(draft, contextOf({ uniqueDays: true })).date).toBe('duplicateDay');
    expect(draftErrorsOf(draft, contextOf({ uniqueDays: true, editingKey: 'aug' })).date)
      .toBeUndefined();
    expect(isDraftValid({ date: 'duplicateDay' })).toBe(false);
  });
});
