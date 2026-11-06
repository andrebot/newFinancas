import { useMemo } from 'react';
import { stackedBarChart } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import useChartReadout from '../chartReadout/useChartReadout';
import { buildBarsModel, type BarColumn, type BarSeries } from './barModel';
import {
  Bar, BarLegend, BarsTable, MonthReadout,
} from './StackedBarChartParts';

// The kit's stacked bar chart and its legend (K39, OQ-230): payout over time on
// the Dashboard and Investments (mockups 20 and 50). It is drawn by hand, like
// the line chart. Each month is a bar stacked from the largest series up, the
// largest five by their total over the months shown in a colour each, by rank,
// the rest grey as Others. The newest month is at full strength.
//
// A month is read as on the line chart, on hover, on a tap and from the keyboard,
// through the same hook: its bar comes to full strength and a chip lists what
// each series paid.
//
// It only displays. The caller loads one currency's series, sends every month it
// wants a bar for, writes the amounts (FormattingUtility) and handles the empty
// case: with nothing paid, it renders nothing. `seriesColors` tells the caller
// which colour each series got, for the selector beside the chart.

export { seriesColors, type BarAmount, type BarSeries } from './barModel';

/** The stacked bar chart's props. */
export interface StackedBarChartProps {
  /** The months to draw, `YYYY-MM`, in any order; each gets a bar, even an empty one. */
  readonly months: readonly string[];
  /** The series, in one currency, amounts in minor units. */
  readonly series: readonly BarSeries[];
  /** The chart's accessible name, already translated. */
  readonly ariaLabel: string;
  /** Writes an amount, in the series' currency. */
  readonly formatValue: (amount: number) => string;
  /** The plot's height, in px; defaults to the mockups'. */
  readonly heightPx?: number | undefined;
}

const PLOT = [
  'relative touch-pan-y rounded-sm border-b border-line outline-mint',
  'focus-visible:outline-2 focus-visible:outline-offset-4',
].join(' ');

/** Nothing on this chart can be picked: reading a month is all a press does. */
const NOTHING_TO_PICK = () => false;

/**
 * Puts the words of a month's reading together, for the live region.
 *
 * @param column - The month.
 * @param monthLabel - Its written name.
 * @param formatValue - Writes an amount.
 * @returns The sentence to announce.
 */
const spokenReading = (
  column: BarColumn,
  monthLabel: string,
  formatValue: (amount: number) => string,
) => [
  `${monthLabel} ${formatValue(column.total)}`,
  ...column.segments.map((segment) => `${segment.label} ${formatValue(segment.amount)}`),
].join(', ');

/**
 * Draws the month labels under the plot. The month in focus is in mint. A plot
 * too narrow for twelve labels keeps every other one, counted from the newest.
 *
 * @param props - The months, the month in focus and how to write a label.
 * @returns The labels.
 */
function MonthLabels({ columns, focusedKey, labelOf }: {
  readonly columns: readonly BarColumn[];
  readonly focusedKey: string | undefined;
  readonly labelOf: (month: string) => string;
}) {
  return (
    <div aria-hidden className="relative h-3.5 @container">
      {columns.filter((column) => column.labelled).map((column) => (
        <span
          key={column.key}
          className={[
            'absolute -translate-x-1/2 whitespace-nowrap type-label',
            column.labelWide ? '@max-md:hidden' : '',
            column.key === focusedKey ? 'text-mint' : 'text-muted',
          ].join(' ')}
          style={{ left: `${column.left}%` }}
        >
          {labelOf(column.key)}
        </span>
      ))}
    </div>
  );
}

/**
 * Draws a stacked bar chart and its legend: see the top of this file.
 *
 * @param props - The months, the series and how to write them.
 * @returns The chart, or nothing when nothing was paid.
 */
export function StackedBarChart({
  months, series, ariaLabel, formatValue, heightPx,
}: StackedBarChartProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const model = useMemo(
    () => buildBarsModel(
      months,
      series,
      (count) => translator.text('stackedBarChart', 'others', { count }),
    ),
    [months, series, translator],
  );
  const {
    columns, legend, barWidthPercent, longWindow,
  } = model;
  const { activeKey, plotRef, handlers } = useChartReadout({
    marks: columns.map((column) => ({ key: column.key, position: { left: column.left } })),
    onPick: NOTHING_TO_PICK,
    startKey: undefined,
    pickable: false,
  });
  if (legend.length === 0) {
    return null;
  }

  /**
   * Writes a month in full.
   *
   * @param month - The month, `YYYY-MM`.
   * @returns Its name and year.
   */
  const fullMonth = (month: string) => formatter.date(`${month}-01`, 'monthYear');

  /**
   * Writes a month's label under the plot: its name, or on a long window, whose
   * names would repeat, its number.
   *
   * @param month - The month, `YYYY-MM`.
   * @returns The label.
   */
  const shortMonth = (month: string) => formatter.date(
    `${month}-01`,
    longWindow ? 'monthYearNumeric' : 'monthShort',
  );
  const active = columns.find((column) => column.key === activeKey);
  const focusedKey = activeKey ?? columns.at(-1)?.key;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={plotRef}
        role="group"
        aria-label={ariaLabel}
        // The plot is one tab stop: the arrows read its months.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={PLOT}
        style={{ height: heightPx ?? stackedBarChart.defaultHeightPx }}
        {...handlers}
      >
        <span aria-hidden>
          {columns.map((column) => (
            <Bar
              key={column.key}
              column={column}
              widthPercent={barWidthPercent}
              focused={column.key === focusedKey}
            />
          ))}
        </span>
        {active && (
          <MonthReadout
            column={active}
            monthLabel={fullMonth(active.key)}
            widthPercent={barWidthPercent}
            formatValue={formatValue}
          />
        )}
      </div>
      <MonthLabels columns={columns} focusedKey={focusedKey} labelOf={shortMonth} />
      <BarLegend entries={legend} />
      <BarsTable
        caption={ariaLabel}
        model={model}
        monthLabelOf={fullMonth}
        formatValue={formatValue}
      />
      <span className="sr-only" aria-live="polite">
        {active && spokenReading(active, fullMonth(active.key), formatValue)}
      </span>
    </div>
  );
}
