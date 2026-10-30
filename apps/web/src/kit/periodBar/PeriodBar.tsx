import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Currency } from '@financas/api-types';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import useToday from '../../utilities/useToday';
import { IconButton } from '../button/IconButton';
import {
  barHeights, isFuture, stepMonth, switchYear,
  type BarHeights, type Period, type PeriodMonth,
} from './periodBar';

// The kit's period bar (K40, OQ-216): the month the Month Overview shows,
// picked from a year's twelve months, each with its money in (mint) and out
// (coral) as two small bars — the strip itself shows how each month went
// (FR-6.11). From `xl` up it is mockup 30's card: the year between two
// arrows, the twelve months in a row, the caller's summary on the right.
// Below `xl` it is mockup 34's: the month between two arrows that step a
// month at a time, across years, over a swiped strip that keeps the
// selected month in view, the summary under it; from `md` that stack is a
// card whose twelve months fit in a row, no swiping. Months after today's can't
// be picked; nor can years before the caller's `firstYear`. The caller
// fills the summary (In / Out / Total and the $ / R$ switch) and makes the
// bar sticky where it wants it. The month or year between the arrows is a
// polite live region, so an arrow's move is heard where focus stays.

/** The period bar's props. */
export interface PeriodBarProps {
  /** The selected month. */
  readonly period: Period;
  /** The selected month, already formatted, e.g. "September/2026" — shown below `xl`. */
  readonly periodLabel: string;
  /**
   * The selected year's months in one currency: the report's `yearStrip`
   * narrowed to the chosen currency, its `YYYY-MM` read as the month's
   * number. A month left out reads as empty. Undefined while the figures
   * aren't known (loading, or a failed read): every bar is empty and a
   * month is heard by its year alone — never as zeros it didn't have.
   */
  readonly months: readonly PeriodMonth[] | undefined;
  /** The currency of `months`, for the months' accessible names. */
  readonly currency: Currency;
  /** The earliest year the arrows reach. */
  readonly firstYear: number;
  /** Called with the month picked, or reached by an arrow. */
  readonly onChange: (period: Period) => void;
  /** The selected month's summary: beside the months from `xl`, under them below it. */
  readonly summary?: ReactNode;
}

/** One month button's props. */
interface MonthButtonProps {
  readonly period: Period;
  /** Its bars; both empty for a month ahead or with no money in or out. */
  readonly bars: BarHeights;
  /** What is heard after its short name: the year, and its figures when it has happened. */
  readonly heard: string;
  readonly selected: boolean;
  readonly future: boolean;
  readonly onSelect: () => void;
}

/** The arrows' props: where each leads, or nothing when it is at its end. */
interface ArrowsProps {
  readonly back: Period | undefined;
  readonly forward: Period | undefined;
  /** The arrows' names, already translated. */
  readonly backLabel: string;
  readonly forwardLabel: string;
  readonly onChange: (period: Period) => void;
  /** The text between the arrows. */
  readonly children: ReactNode;
}

const EMPTY_BARS: BarHeights = { in: 0, out: 0 };

// Literal, so Tailwind finds every class.
const BAR_COLORS = {
  mint: { selected: 'bg-mint', other: 'bg-mint/60' },
  coral: { selected: 'bg-coral', other: 'bg-coral/60' },
} as const;

const MONTH = [
  'flex w-13 shrink-0 flex-col items-center gap-1 rounded-2xl px-2 pt-2 pb-1.5 md:w-auto',
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
  // Inset, so the strip's overflow doesn't clip it.
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint',
].join(' ');

const SUMMARY = [
  'rounded-2xl border border-line bg-card px-3 py-2.5',
  'xl:min-w-62.5 xl:shrink-0 xl:rounded-none xl:border-0 xl:border-l xl:bg-transparent',
  'xl:py-0 xl:pr-0 xl:pl-8',
].join(' ');

/**
 * Picks a bar's colour: grey when it is empty or the month lies ahead, its
 * tone in full on the selected month and softened on the others.
 *
 * @param tone - Mint for money in, coral for money out.
 * @param height - The bar's height, in percent.
 * @param selected - Whether its month is the selected one.
 * @returns The bar's background class.
 */
export const barColor = (tone: 'mint' | 'coral', height: number, selected: boolean): string => {
  if (height === 0) return 'bg-line';
  return BAR_COLORS[tone][selected ? 'selected' : 'other'];
};

/**
 * Builds a month button's look: selected in mint, otherwise quiet.
 *
 * @param selected - Whether it is the selected month.
 * @returns The button's classes.
 */
export const monthClasses = (selected: boolean): string => [
  MONTH,
  selected ? 'bg-mintdeep ring-1 ring-mint/50' : 'enabled:hover:bg-ink/5',
].join(' ');

/**
 * Renders one month: its two bars over its short name. The name heard adds
 * the year and, for a month that has happened, its money in and out.
 *
 * @param props - The month, its bars, what is heard and its state.
 * @returns The month's button.
 */
function MonthButton({
  period, bars, heard, selected, future, onSelect,
}: MonthButtonProps) {
  const formatter = useFormatter();
  const first = `${period.year}-${String(period.month).padStart(2, '0')}-01`;

  return (
    <button
      type="button"
      className={monthClasses(selected)}
      aria-current={selected ? 'true' : undefined}
      disabled={future}
      onClick={onSelect}
    >
      <span className="flex h-4.5 items-end gap-0.5 xl:h-5.5" aria-hidden="true">
        <span
          className={`min-h-1 w-1 rounded-full xl:w-1.25 ${barColor('mint', bars.in, selected)}`}
          style={{ height: `${bars.in}%` }}
        />
        <span
          className={`min-h-1 w-1 rounded-full xl:w-1.25 ${barColor('coral', bars.out, selected)}`}
          style={{ height: `${bars.out}%` }}
        />
      </span>
      <span className={`type-caption ${selected ? 'font-semibold text-mint' : 'text-muted'}`}>
        {formatter.date(first, 'monthShort')}
        {' '}
        <span className="sr-only">{heard}</span>
      </span>
    </button>
  );
}

/**
 * Renders text between a back and a forward arrow; an arrow at its end is disabled.
 *
 * @param props - Where each arrow leads, their names, the change handler and the text.
 * @returns The arrows around the text.
 */
function Arrows({
  back, forward, backLabel, forwardLabel, onChange, children,
}: ArrowsProps) {
  return (
    <>
      <IconButton
        icon="chevron-left"
        size="md"
        label={backLabel}
        disabled={back === undefined}
        onClick={() => back !== undefined && onChange(back)}
      />
      {children}
      <IconButton
        icon="chevron-right"
        size="md"
        label={forwardLabel}
        disabled={forward === undefined}
        onClick={() => forward !== undefined && onChange(forward)}
      />
    </>
  );
}

/**
 * Keeps an arrow's destination only when its year may be shown: not before
 * `firstYear`, not one that hasn't started yet.
 *
 * @param target - Where the arrow leads.
 * @param firstYear - The earliest year allowed.
 * @param today - Today, `YYYY-MM-DD`.
 * @returns The destination, or nothing when the arrow is at its end.
 */
export const reachable = (
  target: Period,
  firstYear: number,
  today: string,
): Period | undefined => (
  target.year < firstYear || isFuture({ year: target.year, month: 1 }, today) ? undefined : target
);

/**
 * Leads a year arrow to another year, keeping the month (held back to
 * today's), or nowhere when that year can't be shown.
 *
 * @param period - The selected month.
 * @param year - The year the arrow leads to.
 * @param firstYear - The earliest year allowed.
 * @param today - Today, `YYYY-MM-DD`.
 * @returns The month to select, or nothing when the arrow is at its end.
 */
export const yearArrow = (
  period: Period,
  year: number,
  firstYear: number,
  today: string,
): Period | undefined => (
  reachable({ year, month: period.month }, firstYear, today) && switchYear(period, year, today)
);

/**
 * Binds the writer of what is heard after a month's short name: its year and
 * its money in and out (a month with none reads zero for both).
 *
 * @param currency - The figures' currency.
 * @returns The writer, taking the month and its figures, if any moved.
 */
const useHeardMonth = (currency: Currency) => {
  const translator = useI18n();
  const formatter = useFormatter();
  return (period: Period, figures: PeriodMonth | undefined) => translator.text(
    'periodBar',
    'figures',
    {
      year: period.year,
      in: formatter.money(figures?.in ?? 0, currency),
      out: formatter.money(figures?.out ?? 0, currency),
    },
  );
};

/**
 * Scrolls the strip so its selected month sits in the middle; with every
 * month showing (from `xl` up) there is nothing to scroll.
 *
 * @param strip - The months' strip, once mounted.
 * @param behavior - `instant` to jump there, `auto` to follow the strip's
 *   own smooth scrolling (kept off when the user asks for less motion).
 */
export const centreSelected = (strip: HTMLElement | null, behavior: ScrollBehavior) => {
  const selected = strip?.querySelector<HTMLElement>('[aria-current="true"]');
  if (!strip || !selected) return;
  const left = selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2;
  strip.scrollTo({ left, behavior });
};

/**
 * Keeps the selected month in view on the swiped strip: it is there from the
 * first paint, and glides to a month picked later.
 *
 * @param period - The selected month.
 * @returns The ref for the strip.
 */
const useSelectedInView = (period: Period) => {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    centreSelected(stripRef.current, mountedRef.current ? 'auto' : 'instant');
    mountedRef.current = true;
  }, [period.year, period.month]);

  return stripRef;
};

/**
 * Renders the period bar.
 *
 * @param props - The selected month, its label, the year's months, their
 *   currency, the earliest year, the change handler and the summary.
 * @returns The bar.
 */
export function PeriodBar({
  period, periodLabel, months, currency, firstYear, onChange, summary,
}: PeriodBarProps) {
  const translator = useI18n();
  const today = useToday();
  const stripRef = useSelectedInView(period);
  const heardMonth = useHeardMonth(currency);
  const heights = barHeights(months ?? []);
  const figures = new Map(months?.map((entry) => [entry.month, entry]));
  const nextMonth = stepMonth(period, 1);

  return (
    <section
      aria-label={translator.text('periodBar', 'label')}
      className={[
        'flex flex-col gap-3 border-b border-line py-3',
        // From md, a card whose twelve months fit in a row; from xl, one line (mockup 30).
        'md:gap-4 md:rounded-card md:border md:bg-card md:p-4',
        'xl:flex-row xl:items-center xl:gap-8 xl:p-5',
      ].join(' ')}
    >
      <div className="flex items-center justify-between px-3 md:px-0 xl:hidden">
        <Arrows
          back={reachable(stepMonth(period, -1), firstYear, today)}
          forward={isFuture(nextMonth, today) ? undefined : nextMonth}
          backLabel={translator.text('periodBar', 'previousMonth')}
          forwardLabel={translator.text('periodBar', 'nextMonth')}
          onChange={onChange}
        >
          <span className="type-heading-md tabular-nums" aria-live="polite">{periodLabel}</span>
        </Arrows>
      </div>
      <div className="hidden shrink-0 items-center gap-2 xl:flex">
        <Arrows
          back={yearArrow(period, period.year - 1, firstYear, today)}
          forward={yearArrow(period, period.year + 1, firstYear, today)}
          backLabel={translator.text('periodBar', 'previousYear')}
          forwardLabel={translator.text('periodBar', 'nextYear')}
          onChange={onChange}
        >
          <span className="type-heading-lg tabular-nums" aria-live="polite">{period.year}</span>
        </Arrows>
      </div>
      <div
        ref={stripRef}
        role="group"
        aria-label={translator.text('periodBar', 'months', { year: period.year })}
        className={[
          // The padding keeps the selected tile clear of the scroller's clip.
          'relative flex gap-1.5 overflow-x-auto px-3 py-1 [scrollbar-width:none]',
          'motion-safe:scroll-smooth',
          'md:grid md:grid-cols-12 md:overflow-visible md:px-0 md:py-0 xl:flex-1',
        ].join(' ')}
      >
        {Array.from({ length: 12 }, (_, index) => {
          const shown = { year: period.year, month: index + 1 };
          const future = isFuture(shown, today);
          const unknown = future || months === undefined;
          return (
            <MonthButton
              key={shown.month}
              period={shown}
              bars={(!unknown && heights.get(shown.month)) || EMPTY_BARS}
              heard={unknown ? String(shown.year) : heardMonth(shown, figures.get(shown.month))}
              selected={shown.month === period.month}
              future={future}
              onSelect={() => onChange(shown)}
            />
          );
        })}
      </div>
      {summary !== undefined && <div className={`mx-3 md:mx-0 ${SUMMARY}`}>{summary}</div>}
    </section>
  );
}
