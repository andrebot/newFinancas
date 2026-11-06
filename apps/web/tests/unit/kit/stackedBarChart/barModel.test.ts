import { describe, expect, it } from 'vitest';
import { stackedBarChart } from '../../../../src/config/constants';
import {
  buildBarsModel, seriesColors, type BarSeries,
} from '../../../../src/kit/stackedBarChart/barModel';

// The chart's arithmetic (BDT: pure functions → unit, nothing mocked).

/**
 * Builds a series.
 *
 * @param key - Its key and name.
 * @param amounts - Its amounts by month.
 * @returns The series.
 */
const series = (key: string, amounts: Record<string, number>): BarSeries => ({
  key,
  label: key,
  amounts: Object.entries(amounts).map(([month, amount]) => ({ month, amount })),
});

/**
 * Names the Others group.
 *
 * @param count - How many series it holds.
 * @returns The name.
 */
const others = (count: number) => `Others (${count})`;

const MONTHS = ['2026-01', '2026-02'];

/**
 * Builds a series paying in the first month alone.
 *
 * @param key - Its key.
 * @param amount - What it pays.
 * @returns The series.
 */
const paying = (key: string, amount: number) => series(key, { '2026-01': amount });

const SEVEN = [
  paying('g', 10), paying('a', 70), paying('b', 60), paying('c', 50),
  paying('d', 40), paying('e', 30), paying('f', 20),
];

/**
 * Builds a window of months.
 *
 * @param count - How many.
 * @returns The months, from January 2025.
 */
const windowOf = (count: number) => Array.from({ length: count }, (_, index) => (
  `${2025 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
));

const { seriesTones, topInsetPercent, barSlotShare } = stackedBarChart;

describe('buildBarsModel', () => {
  it('ranks by the total over the months shown, not the newest month', () => {
    const model = buildBarsModel(MONTHS, [
      series('recent', { '2026-02': 50 }),
      series('steady', { '2026-01': 40, '2026-02': 40 }),
    ], others);
    expect(model.legend.map((entry) => entry.key)).toEqual(['steady', 'recent']);
  });

  it('ignores amounts outside the months shown', () => {
    const model = buildBarsModel(MONTHS, [
      series('old', { '2025-01': 900, '2026-01': 1 }),
      series('new', { '2026-01': 2 }),
    ], others);
    expect(model.legend.map((entry) => entry.key)).toEqual(['new', 'old']);
  });

  it('breaks a tie by key', () => {
    const model = buildBarsModel(MONTHS, [paying('b', 5), paying('a', 5)], others);
    expect(model.legend.map((entry) => entry.key)).toEqual(['a', 'b']);
  });

  it('colours the largest by rank and groups the rest as Others', () => {
    const { legend } = buildBarsModel(MONTHS, SEVEN, others);
    expect(legend.map((entry) => entry.label)).toEqual(['a', 'b', 'c', 'd', 'e', 'Others (2)']);
    expect(legend.slice(0, 5).map((entry) => entry.color)).toEqual(
      seriesTones.map((tone) => `var(--c-cat-${tone})`),
    );
    expect(legend[5]?.color).toBe('var(--c-faint)');
  });

  it('has no Others when every series keeps a colour', () => {
    const { legend } = buildBarsModel(MONTHS, SEVEN.slice(0, 5), others);
    expect(legend.map((entry) => entry.key)).not.toContain('others');
  });

  it('leaves out a series that paid nothing, even from the Others count', () => {
    const { legend } = buildBarsModel(MONTHS, [...SEVEN, paying('zero', 0)], others);
    expect(legend.at(-1)?.label).toBe('Others (2)');
  });

  it('sums Others and stacks the largest at the bottom', () => {
    const { columns } = buildBarsModel(MONTHS, SEVEN, others);
    const [first] = columns;
    expect(first?.segments.map((segment) => segment.amount)).toEqual([70, 60, 50, 40, 30, 30]);
    expect(first?.total).toBe(280);
  });

  it('adds up several amounts in one month', () => {
    const { columns } = buildBarsModel(MONTHS, [{
      key: 'a',
      label: 'a',
      amounts: [{ month: '2026-01', amount: 5 }, { month: '2026-01', amount: 7 }],
    }], others);
    expect(columns[0]?.total).toBe(12);
  });

  it('treats a negative month as nothing', () => {
    const { columns } = buildBarsModel(MONTHS, [
      series('a', { '2026-01': -50, '2026-02': 10 }),
    ], others);
    expect(columns.map((column) => column.total)).toEqual([0, 10]);
    expect(columns[0]?.segments).toEqual([]);
  });

  it('keeps zeros for the table but draws no segment for them', () => {
    const { columns } = buildBarsModel(MONTHS, [
      series('a', { '2026-01': 10 }),
      series('b', { '2026-02': 10 }),
    ], others);
    expect(columns[0]?.amounts).toEqual([{ key: 'a', amount: 10 }, { key: 'b', amount: 0 }]);
    expect(columns[0]?.segments.map((segment) => segment.key)).toEqual(['a']);
  });

  it('scales every bar to the tallest, leaving room on top', () => {
    const { columns } = buildBarsModel(MONTHS, [
      series('a', { '2026-01': 100, '2026-02': 50 }),
      series('b', { '2026-01': 100 }),
    ], others);
    const room = 100 - topInsetPercent;
    const heights = columns[0]?.segments.map((segment) => segment.heightPercent);
    expect(heights).toEqual([room / 2, room / 2]);
    expect(columns[1]?.segments[0]?.heightPercent).toBeCloseTo(room / 4);
  });

  it('draws nothing when nothing was paid', () => {
    const { legend, columns } = buildBarsModel(MONTHS, [paying('a', 0)], others);
    expect(legend).toEqual([]);
    expect(columns.map((column) => column.segments)).toEqual([[], []]);
  });

  it('sorts the months, whatever order they come in', () => {
    const { columns } = buildBarsModel(['2026-03', '2026-01'], [paying('a', 1)], others);
    expect(columns.map((column) => column.key)).toEqual(['2026-01', '2026-03']);
  });

  it('spreads the bars so the outer ones touch the sides', () => {
    const months = windowOf(12);
    const { columns, barWidthPercent } = buildBarsModel(months, [paying('a', 1)], others);
    expect(barWidthPercent).toBeCloseTo((barSlotShare * 100) / (11 + barSlotShare));
    expect(columns[0]?.left).toBeCloseTo(barWidthPercent / 2);
    expect(columns[11]?.left).toBeCloseTo(100 - barWidthPercent / 2);
    expect(columns[1]!.left - columns[0]!.left).toBeCloseTo(columns[2]!.left - columns[1]!.left);
  });

  it('caps a short window and centres a lone bar', () => {
    const { columns, barWidthPercent } = buildBarsModel(['2026-01'], [paying('a', 1)], others);
    expect(barWidthPercent).toBe(stackedBarChart.maxBarWidthPercent);
    expect(columns[0]?.left).toBe(50);
  });

  it('labels every month up to the limit', () => {
    const months = windowOf(12);
    const model = buildBarsModel(months, [paying('a', 1)], others);
    expect(model.longWindow).toBe(false);
    expect(model.columns.every((column) => column.labelled)).toBe(true);
  });

  it('marks every other label, counted from the newest, to give way on a narrow plot', () => {
    const { columns } = buildBarsModel(windowOf(12), [paying('a', 1)], others);
    expect(columns.at(-1)?.labelWide).toBe(false);
    expect(columns.at(-2)?.labelWide).toBe(true);
    expect(columns.at(-3)?.labelWide).toBe(false);
  });

  it('keeps every label on a window that fits a narrow plot', () => {
    const { columns } = buildBarsModel(windowOf(6), [paying('a', 1)], others);
    expect(columns.some((column) => column.labelWide)).toBe(false);
  });

  it('thins a long window back from the newest', () => {
    const months = windowOf(13);
    const model = buildBarsModel(months, [paying('a', 1)], others);
    expect(model.longWindow).toBe(true);
    const labelled = model.columns.filter((column) => column.labelled);
    expect(labelled.at(-1)?.key).toBe('2026-01');
    expect(labelled.length).toBeLessThanOrEqual(stackedBarChart.longWindowLabels);
    expect(model.columns.at(-3)?.labelled).toBe(false);
    expect(model.columns.some((column) => column.labelWide)).toBe(false);
  });
});

describe('seriesColors', () => {
  it('gives each drawn series its colour and the rest Others grey', () => {
    const colors = seriesColors(MONTHS, SEVEN);
    expect(colors.get('a')).toBe(`var(--c-cat-${seriesTones[0]})`);
    expect(colors.get('f')).toBe('var(--c-faint)');
    expect(colors.get('g')).toBe('var(--c-faint)');
  });

  it('gives no colour to a series that paid nothing', () => {
    expect(seriesColors(MONTHS, [paying('zero', 0)]).has('zero')).toBe(false);
  });
});
