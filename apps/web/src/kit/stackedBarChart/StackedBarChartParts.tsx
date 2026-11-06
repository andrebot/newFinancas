import type { CSSProperties } from 'react';
import { stackedBarChart } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import type { BarColumn, BarLegendEntry, BarsModel } from './barModel';

// The pieces a stacked bar chart is drawn from (K39, OQ-230). All HTML on percent
// coordinates, so a bar keeps its rounded corners however the plot stretches.

const SWATCH = 'size-2.5 shrink-0 rounded-sm';
// The transparent border is the gap between segments: it comes out of a segment's
// own height, so a bar stays exactly as tall as its amounts, on any surface.
const SEGMENT = 'block w-full shrink-0 rounded-[4px] border-t border-transparent bg-clip-padding';
const READOUT_CHIP = [
  'pointer-events-none absolute top-0 z-10 flex flex-col gap-0.5 whitespace-nowrap',
  'rounded-lg bg-ink px-2 py-1 type-caption font-medium text-bg shadow-overlay',
].join(' ');
const READOUT_ROW = 'flex items-center gap-1.5';

/**
 * Draws one month's bar: at full strength when it is the month in focus.
 *
 * @param props - The month, the bar's width and whether it is in focus.
 * @returns The bar.
 */
export function Bar({ column, widthPercent, focused }: {
  readonly column: BarColumn;
  readonly widthPercent: number;
  readonly focused: boolean;
}) {
  return (
    <span
      data-testid="stacked-bar"
      className={`absolute inset-y-0 flex flex-col-reverse ${focused ? '' : 'opacity-55'}`}
      style={{ left: `${column.left - widthPercent / 2}%`, width: `${widthPercent}%` }}
    >
      {column.segments.map((segment) => (
        <span
          key={segment.key}
          data-testid="stacked-bar-segment"
          className={SEGMENT}
          style={{ height: `${segment.heightPercent}%`, backgroundColor: segment.color }}
        />
      ))}
    </span>
  );
}

/**
 * Places the chip beside its bar, on the side with more room. On a plot too
 * narrow for that it stops at the far side, staying inside the plot, even if it
 * covers the bar it reads.
 *
 * @param column - The month.
 * @param widthPercent - A bar's width, in percent.
 * @returns The chip's horizontal place and width limit.
 */
const beside = ({ left }: BarColumn, widthPercent: number): CSSProperties => {
  const { readoutGapPx, readoutMaxWidthRem } = stackedBarChart;
  const maxWidth = `${readoutMaxWidthRem}rem`;
  const offset = (side: number) => (
    `min(calc(${side + widthPercent / 2}% + ${readoutGapPx}px), calc(100% - ${maxWidth}))`
  );
  return left <= 50
    ? { maxWidth, left: offset(left) }
    : { maxWidth, right: offset(100 - left) };
};

/**
 * Draws the chip that reads a month: its name and total, then what each group
 * paid, in the legend's order, which is the stack's: by the total over the window,
 * not by that month. It is hidden from assistive tech, which hears the same from
 * the plot's live region.
 *
 * @param props - The month, its written name, a bar's width and the written amounts.
 * @returns The chip.
 */
export function MonthReadout({
  column, monthLabel, widthPercent, formatValue,
}: {
  readonly column: BarColumn;
  readonly monthLabel: string;
  readonly widthPercent: number;
  readonly formatValue: (amount: number) => string;
}) {
  return (
    <span
      aria-hidden
      data-testid="stacked-bar-readout"
      className={READOUT_CHIP}
      style={beside(column, widthPercent)}
    >
      <span className="block font-normal">{monthLabel}</span>
      <span className="block tabular-nums">{formatValue(column.total)}</span>
      {column.segments.map((segment) => (
        <span key={segment.key} className={READOUT_ROW}>
          <span className={SWATCH} style={{ background: segment.color }} />
          <span className="truncate font-normal">{segment.label}</span>
          <span className="ml-auto pl-3 tabular-nums">{formatValue(segment.amount)}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Draws the legend, largest first. A long name without spaces breaks rather than
 * running out of the row.
 *
 * @param props - The legend's rows.
 * @returns The legend.
 */
export function BarLegend({ entries }: { readonly entries: readonly BarLegendEntry[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-muted">
      {entries.map((entry) => (
        <li key={entry.key} className="flex min-w-0 items-center gap-1.5">
          <span className={SWATCH} style={{ background: entry.color }} />
          <span className="min-w-0 break-words">{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Lists every amount for assistive tech: the plot itself is a drawing. The wrapper
 * is what's visually hidden, since a table grows to fit its cells whatever width it
 * is given, and a hidden one that wide would make the page scroll sideways.
 *
 * @param props - The caption, the chart, each month's written name and the written amounts.
 * @returns The hidden table.
 */
export function BarsTable({
  caption, model, monthLabelOf, formatValue,
}: {
  readonly caption: string;
  readonly model: BarsModel;
  readonly monthLabelOf: (month: string) => string;
  readonly formatValue: (amount: number) => string;
}) {
  const translator = useI18n();
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{translator.text('stackedBarChart', 'month')}</th>
            {model.legend.map((entry) => <th key={entry.key} scope="col">{entry.label}</th>)}
            <th scope="col">{translator.text('stackedBarChart', 'total')}</th>
          </tr>
        </thead>
        <tbody>
          {model.columns.map((column) => (
            <tr key={column.key}>
              <th scope="row">{monthLabelOf(column.key)}</th>
              {column.amounts.map(({ key, amount }) => <td key={key}>{formatValue(amount)}</td>)}
              <td>{formatValue(column.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
