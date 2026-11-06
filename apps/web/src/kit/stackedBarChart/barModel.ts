import { stackedBarChart } from '../../config/constants';
import { categoryColor } from '../../utilities/theme';

// What a stacked bar chart draws (K39, OQ-230), worked out from the months and
// the series. The largest series by their total over the months shown keep a
// colour, by rank; the rest are one grey group. Amounts are whole minor units, so
// they add up exactly. Pure, so the arithmetic is tested directly.

/** One month's amount in a series, as the payouts report sends it. */
export interface BarAmount {
  /** The month, `YYYY-MM`. */
  readonly month: string;
  /** In minor units. */
  readonly amount: number;
}

/** One series of the chart, e.g., a Holding's payouts. */
export interface BarSeries {
  /** The series' stable key. */
  readonly key: string;
  /** Its name, e.g., a ticker. */
  readonly label: string;
  /** Its amounts; a month with none counts as zero. */
  readonly amounts: readonly BarAmount[];
}

/** A coloured group of series: one of the largest, or Others. */
interface SeriesGroup {
  readonly key: string;
  /** The CSS colour, which follows the theme. */
  readonly color: string;
  readonly members: readonly BarSeries[];
}

/** One row of the legend. */
export interface BarLegendEntry {
  readonly key: string;
  readonly label: string;
  readonly color: string;
}

/** One group's slice of a bar. */
export interface BarSegment extends BarLegendEntry {
  /** In minor units. */
  readonly amount: number;
  /** In percent of the plot's height. */
  readonly heightPercent: number;
}

/** What one group paid in a month. */
export interface GroupAmount {
  readonly key: string;
  /** In minor units. */
  readonly amount: number;
}

/** One month's bar. */
export interface BarColumn {
  /** The month, `YYYY-MM`. */
  readonly key: string;
  /** Where the bar's centre sits, in percent of the plot's width. */
  readonly left: number;
  /** The month's total, in minor units. */
  readonly total: number;
  /** Bottom to top: the largest group first, Others last. */
  readonly segments: readonly BarSegment[];
  /** Whether the month gets a label under the plot. */
  readonly labelled: boolean;
  /** Whether that label gives way on a narrow plot, where every other one fits. */
  readonly labelWide: boolean;
  /** Each group's amount for the hidden table, in the legend's order, zeros included. */
  readonly amounts: readonly GroupAmount[];
}

/** The whole chart, ready to draw. */
export interface BarsModel {
  readonly columns: readonly BarColumn[];
  readonly legend: readonly BarLegendEntry[];
  /** A bar's width, in percent of the plot's width. */
  readonly barWidthPercent: number;
  /** Whether the window is too long to write its months by name. */
  readonly longWindow: boolean;
}

/** The Others group's key; a series' key is an id, so they can't meet. */
const OTHERS_KEY = 'others';

/**
 * Reads one month of a series. Nothing but money received is drawn, so a month
 * can't go below zero.
 *
 * @param series - The series.
 * @param month - The month, `YYYY-MM`.
 * @returns Its amount, in minor units.
 */
const amountIn = (series: BarSeries, month: string) => Math.max(
  0,
  series.amounts
    .filter((entry) => entry.month === month)
    .reduce((sum, entry) => sum + entry.amount, 0),
);

/**
 * Sorts the series that paid anything over the window, largest first; a tie goes
 * by key, so the order never flickers.
 *
 * @param months - The months shown.
 * @param series - The series.
 * @returns The series with something to draw.
 */
const rankSeries = (months: readonly string[], series: readonly BarSeries[]) => series
  .map((item) => ({
    item,
    total: months.reduce((sum, month) => sum + amountIn(item, month), 0),
  }))
  .filter(({ total }) => total > 0)
  .sort((first, second) => (
    second.total - first.total || first.item.key.localeCompare(second.item.key)
  ))
  .map(({ item }) => item);

/**
 * Splits the series into the largest, each in its rank's colour, and Others.
 *
 * @param months - The months shown.
 * @param series - The series.
 * @returns The groups, largest first, Others last and only when it has members.
 */
const groupSeries = (
  months: readonly string[],
  series: readonly BarSeries[],
): readonly SeriesGroup[] => {
  const { seriesTones, othersColor } = stackedBarChart;
  const ranked = rankSeries(months, series);
  const rest = ranked.slice(seriesTones.length);
  const largest = ranked.slice(0, seriesTones.length).map((item, rank) => ({
    key: item.key,
    color: categoryColor(seriesTones[rank]!),
    members: [item],
  }));
  return rest.length > 0
    ? [...largest, { key: OTHERS_KEY, color: othersColor, members: rest }]
    : largest;
};

/**
 * Tells which colour each series gets, for what shows them next to the chart:
 * the swatches in the holdings selector (mockup 50).
 *
 * @param months - The months shown.
 * @param series - The series.
 * @returns Each drawn series' colour by key; a series that paid nothing has none.
 */
export const seriesColors = (
  months: readonly string[],
  series: readonly BarSeries[],
): ReadonlyMap<string, string> => new Map(
  groupSeries(months, series).flatMap(({ color, members }) => (
    members.map((member) => [member.key, color] as const)
  )),
);

/**
 * Sizes a bar: its slot's share of the width, spread so the first and last bars
 * touch the plot's sides (mockup 50), never wider than the cap.
 *
 * @param count - How many months there are.
 * @returns The bar's width, in percent of the plot's width.
 */
const barWidthOf = (count: number) => {
  const { barSlotShare, maxBarWidthPercent } = stackedBarChart;
  return Math.min(maxBarWidthPercent, (barSlotShare * 100) / (count - 1 + barSlotShare));
};

/**
 * Places a bar's centre.
 *
 * @param index - The month's place, oldest first.
 * @param count - How many months there are.
 * @param width - A bar's width, in percent.
 * @returns The centre, in percent of the plot's width; a lone bar sits in the middle.
 */
const centreOf = (index: number, count: number, width: number) => (
  count === 1 ? 50 : width / 2 + (index * (100 - width)) / (count - 1)
);

/**
 * Tells how often a month gets a label, counted back from the newest: every
 * month, or on a long window only enough of them to fit.
 *
 * @param count - How many months there are.
 * @returns The step between labels.
 */
const labelStepOf = (count: number) => (
  count > stackedBarChart.maxNamedMonths
    ? Math.ceil(count / stackedBarChart.longWindowLabels)
    : 1
);

/**
 * Works out what a chart draws.
 *
 * @param months - The months shown, in any order, a repeat ignored; each gets a
 * bar, even an empty one.
 * @param series - The series.
 * @param othersLabel - Names the Others group, from how many series it holds.
 * @returns The bars and the legend.
 */
export const buildBarsModel = (
  months: readonly string[],
  series: readonly BarSeries[],
  othersLabel: (count: number) => string,
): BarsModel => {
  const ordered = [...new Set(months)].sort();
  const count = ordered.length;
  const legendGroups = groupSeries(ordered, series).map((group) => ({
    ...group,
    label: group.key === OTHERS_KEY ? othersLabel(group.members.length) : group.members[0]!.label,
  }));
  const amountsOf = (month: string) => legendGroups.map((group) => ({
    key: group.key,
    label: group.label,
    color: group.color,
    amount: group.members.reduce((sum, member) => sum + amountIn(member, month), 0),
  }));
  const tallest = Math.max(0, ...ordered.map((month) => (
    amountsOf(month).reduce((sum, { amount }) => sum + amount, 0)
  )));
  const barWidthPercent = barWidthOf(count);
  const labelStep = labelStepOf(count);
  const plotShare = 100 - stackedBarChart.topInsetPercent;

  return {
    barWidthPercent,
    longWindow: count > stackedBarChart.maxNamedMonths,
    legend: legendGroups.map(({ key, label, color }) => ({ key, label, color })),
    columns: ordered.map((month, index) => {
      const amounts = amountsOf(month);
      return {
        key: month,
        left: centreOf(index, count, barWidthPercent),
        total: amounts.reduce((sum, { amount }) => sum + amount, 0),
        labelled: (count - 1 - index) % labelStep === 0,
        labelWide: labelStep === 1
          && count > stackedBarChart.monthsFittingNarrow
          && (count - 1 - index) % 2 === 1,
        amounts: amounts.map(({ key, amount }) => ({ key, amount })),
        segments: amounts
          .filter(({ amount }) => amount > 0)
          .map((entry) => ({
            ...entry,
            heightPercent: (entry.amount / tallest) * plotShare,
          })),
      };
    }),
  };
};
