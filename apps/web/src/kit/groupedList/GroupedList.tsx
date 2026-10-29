import {
  useEffect, useLayoutEffect, useRef, type ReactNode,
} from 'react';
import { groupedList } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { Button } from '../button/Button';
import { SkeletonRows } from '../skeleton/Skeleton';
import { groupByMonthAndDay, type ListDay, type ListMonth } from './groupedList';

// The kit's grouped list (K41, OQ-217): the ledger's rows under sticky month
// headers and day bands (mockups 30, 34), loaded a page at a time. The caller
// passes every item loaded so far, already ordered; the list groups them,
// names each month and day in the interface language, and draws hairlines
// between a day's rows. The asides are the caller's — the month's count, the
// day's totals. Near the end a sentinel asks for the next page once per
// page; while it loads, skeleton rows stand under the last month (no guessed
// header), and a failed page offers "Try again". The first page is the
// caller's to ask for: with nothing loaded the sentinel stays quiet, and with
// nothing more the caller's empty state shows. The list isn't a scroll
// container: the page scrolls, the headers sticking under the App Shell's
// header, so no ancestor may clip it (`overflow-clip`, not `hidden`).

/** Where the list stands with its pages. */
export type GroupedListStatus = 'idle' | 'loading' | 'error';

/** The heading level of the month headers; the day bands sit one below. */
export type GroupedListHeadingLevel = 2 | 3 | 4 | 5;

/** The grouped list's props. */
export interface GroupedListProps<Item> {
  /** Every item loaded so far, already ordered (the ledger's newest first). */
  readonly items: readonly Item[];
  /** Reads an item's date, `YYYY-MM-DD`. */
  readonly dateOf: (item: Item) => string;
  /** Reads an item's stable key. */
  readonly keyOf: (item: Item) => string;
  /** Renders an item's row, e.g. an `Expandable`. */
  readonly renderItem: (item: Item) => ReactNode;
  /** What sits at a month header's end, e.g. "7 transactions"; `YYYY-MM` in. */
  readonly monthAside?: ((month: string) => ReactNode) | undefined;
  /** What sits at a day band's end, e.g. its totals; `YYYY-MM-DD` in. */
  readonly dayAside?: ((date: string) => ReactNode) | undefined;
  /** Whether more pages follow. */
  readonly hasMore: boolean;
  /** Whether a page is loading or failed; the list asks for the next one only when `idle`. */
  readonly status: GroupedListStatus;
  /** Asks for the next page: near the end, and from "Try again". */
  readonly onReachedEnd: () => void;
  /** Shown when nothing loaded and nothing more follows, e.g. an `EmptyState`. */
  readonly empty?: ReactNode;
  /** Defaults to 3, under the caller's section heading. */
  readonly headingLevel?: GroupedListHeadingLevel | undefined;
  /**
   * Where the month headers stick, a CSS length. Defaults to under the App
   * Shell's header; a phone page adds its sticky period bar's height.
   */
  readonly stickyTop?: string | undefined;
}

/** One month's props. */
interface MonthGroupProps<Item> extends Pick<
  GroupedListProps<Item>, 'keyOf' | 'renderItem' | 'monthAside' | 'dayAside'
> {
  readonly group: ListMonth<Item>;
  readonly headingLevel: GroupedListHeadingLevel;
  readonly stickyTop: string;
}

/** One day's props. */
interface DayGroupProps<Item> extends Pick<
  GroupedListProps<Item>, 'keyOf' | 'renderItem' | 'dayAside'
> {
  readonly group: ListDay<Item>;
  readonly headingLevel: number;
}

/** The end of the list's props. */
interface ListEndProps {
  readonly status: GroupedListStatus;
  /** Whether nothing has loaded yet. */
  readonly blank: boolean;
  readonly hasMore: boolean;
  readonly empty: ReactNode;
  readonly onRetry: () => void;
}

/** The failure line's props. */
interface LoadFailureProps {
  /** Whether the last page failed. */
  readonly failed: boolean;
  readonly onRetry: () => void;
}

/** Under the App Shell's sticky header (`theme.css → --spacing-shell-header`). */
const SHELL_HEADER = 'var(--spacing-shell-header)';

const MONTH_HEADER = [
  'sticky z-1 flex items-center justify-between gap-4',
  'border-y border-line bg-card px-5 py-2.5',
].join(' ');

const DAY_BAND = [
  'flex items-center justify-between gap-4',
  'bg-raised/60 px-5 py-2 type-label text-muted',
].join(' ');

/**
 * Asks for the next page once the sentinel comes near the view, once per
 * arming: it disarms after asking, and arms again with each new page, or
 * when the list is back to idle — a short page whose sentinel stays in view
 * asks again.
 *
 * @param armed - Whether a page may be asked for now.
 * @param loaded - How many items have loaded; a change re-arms.
 * @param onReachedEnd - Asks for the next page.
 * @returns The ref for the sentinel.
 */
export const useReachedEnd = (armed: boolean, loaded: number, onReachedEnd: () => void) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const handlerRef = useRef(onReachedEnd);

  useLayoutEffect(() => {
    handlerRef.current = onReachedEnd;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!armed || !sentinel) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      handlerRef.current();
    }, { rootMargin: `0px 0px ${groupedList.prefetchMargin} 0px` });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [armed, loaded]);

  return sentinelRef;
};

/**
 * Renders one day: its band (the date, the caller's aside) over its rows,
 * hairlines between them.
 *
 * @param props - The day, its heading level and the renderers.
 * @returns The day.
 */
function DayGroup<Item>({
  group, headingLevel, keyOf, renderItem, dayAside,
}: DayGroupProps<Item>) {
  const formatter = useFormatter();
  const Heading = `h${headingLevel}` as 'h3';

  return (
    <>
      <div className={DAY_BAND}>
        <Heading>{formatter.date(group.date, 'weekdayDayMonth')}</Heading>
        {dayAside && (
          <span className="flex items-center gap-1.5 tracking-normal normal-case">
            {dayAside(group.date)}
          </span>
        )}
      </div>
      <ul>
        {group.items.map((item) => (
          <li key={keyOf(item)} className="not-last:border-b not-last:border-line/70">
            {renderItem(item)}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Renders one month: its sticky header (the month, the caller's aside) over
 * its days. The headings carry the structure; a month is no landmark, so a
 * long scroll doesn't bury the page's own.
 *
 * @param props - The month, the heading level, where headers stick and the renderers.
 * @returns The month.
 */
function MonthGroup<Item>({
  group, headingLevel, stickyTop, keyOf, renderItem, monthAside, dayAside,
}: MonthGroupProps<Item>) {
  const formatter = useFormatter();
  const Heading = `h${headingLevel}` as 'h3';

  return (
    <div>
      <div className={MONTH_HEADER} style={{ top: stickyTop }}>
        <Heading className="font-display type-body font-bold text-mint first-letter:uppercase">
          {formatter.date(`${group.month}-01`, 'monthYear')}
        </Heading>
        {monthAside && (
          <span className="type-caption font-medium text-muted tabular-nums">
            {monthAside(group.month)}
          </span>
        )}
      </div>
      {group.days.map((day, index) => (
        <DayGroup
          // A day may come back after another (items out of date order).
          // eslint-disable-next-line react/no-array-index-key
          key={`${index}-${day.date}`}
          group={day}
          headingLevel={headingLevel + 1}
          keyOf={keyOf}
          renderItem={renderItem}
          dayAside={dayAside}
        />
      ))}
    </div>
  );
}

/**
 * Renders the failure line: a live region that is always there, so the
 * failure is heard when it appears, and "Try again" beside it once a page failed.
 *
 * @param props - Whether a page failed, and the retry.
 * @returns The line; an empty live region while nothing failed.
 */
function LoadFailure({ failed, onRetry }: LoadFailureProps) {
  const translator = useI18n();

  return (
    <div className={failed ? 'flex items-center justify-between gap-3 px-5 py-3' : undefined}>
      <p role="status" className="type-body-sm text-muted">
        {failed && translator.text('groupedList', 'loadFailed')}
      </p>
      {failed && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {translator.text('groupedList', 'retry')}
        </Button>
      )}
    </div>
  );
}

/**
 * Renders what follows the last row: skeleton rows while a page loads, the
 * failure line, the caller's empty state when there is nothing. "Try again"
 * hands focus to the list's end before the button goes, so the keyboard
 * isn't thrown back to the page's top.
 *
 * @param props - The status, whether anything loaded, whether more follow,
 *   the empty state and the retry.
 * @returns The list's end.
 */
function ListEnd({
  status, blank, hasMore, empty, onRetry,
}: ListEndProps) {
  const translator = useI18n();
  const endRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={endRef} tabIndex={-1} className="outline-none">
      {status === 'loading' && (
        <SkeletonRows label={translator.text('groupedList', blank ? 'loading' : 'loadingMore')} />
      )}
      <LoadFailure
        failed={status === 'error'}
        onRetry={() => {
          endRef.current?.focus();
          onRetry();
        }}
      />
      {status === 'idle' && blank && !hasMore && empty}
    </div>
  );
}

/**
 * Renders the grouped list.
 *
 * @param props - The items and how to read and render them, the asides, the
 *   paging state and handler, the empty state, the heading level and where
 *   the headers stick.
 * @returns The list.
 */
export function GroupedList<Item>({
  items, dateOf, keyOf, renderItem, monthAside, dayAside, hasMore,
  status, onReachedEnd, empty, headingLevel = 3, stickyTop = SHELL_HEADER,
}: GroupedListProps<Item>) {
  const armed = hasMore && status === 'idle' && items.length > 0;
  const sentinelRef = useReachedEnd(armed, items.length, onReachedEnd);

  return (
    <div className="flex flex-col">
      {groupByMonthAndDay(items, dateOf).map((month, index) => (
        <MonthGroup
          // A month may come back after another (items out of date order).
          // eslint-disable-next-line react/no-array-index-key
          key={`${index}-${month.month}`}
          group={month}
          headingLevel={headingLevel}
          stickyTop={stickyTop}
          keyOf={keyOf}
          renderItem={renderItem}
          monthAside={monthAside}
          dayAside={dayAside}
        />
      ))}
      <ListEnd
        status={status}
        blank={items.length === 0}
        hasMore={hasMore}
        empty={empty}
        onRetry={() => onReachedEnd()}
      />
      {armed && <div ref={sentinelRef} aria-hidden="true" />}
    </div>
  );
}
