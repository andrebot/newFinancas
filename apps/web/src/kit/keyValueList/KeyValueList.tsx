// The kit's key–value list (K44, OQ-210): labelled read-only facts in a grid —
// a transaction's details when its row is open (mockups 30–35), a holding's
// Contract and Position cards (51/52). Each pair is a `<div>` holding its
// `<dt>` and `<dd>`, so assistive tech pairs them right (the transaction
// mockups put the captions in one row and the values in the next). It only
// displays: values arrive formatted (FormattingUtility), the caller picks the
// tone.

/** A value's colour: the ink, mint for money in (a payout), coral for money out (taxes). */
export type KeyValueTone = 'ink' | 'mint' | 'coral';

/**
 * The list's size: `sm` body values (a transaction's details), `lg` display
 * values (a holding's cards).
 */
export type KeyValueSize = 'sm' | 'lg';

/** How many pairs sit side by side. */
export type KeyValueColumns = 2 | 3;

/** One labelled fact. */
export interface KeyValueItem {
  /** The caption, already translated. */
  readonly label: string;
  /**
   * The value, already formatted; empty or absent renders a muted "—",
   * which screen readers hear as the list's `emptyLabel`.
   */
  readonly value?: string | undefined;
  /** Defaults to `ink`. */
  readonly tone?: KeyValueTone | undefined;
  /** A small muted unit after the value, e.g. "/mo". */
  readonly suffix?: string | undefined;
  /** Tabular figures, for numbers, money and dates. */
  readonly numeric?: boolean | undefined;
}

/** The key–value list's props. */
export interface KeyValueListProps {
  /** The pairs, in reading order. */
  readonly items: readonly KeyValueItem[];
  /** Defaults to `sm`. */
  readonly size?: KeyValueSize | undefined;
  /** Defaults to 2. */
  readonly columns?: KeyValueColumns | undefined;
  /** What a screen reader says for a missing value, already translated, e.g. "Not set". */
  readonly emptyLabel: string;
}

/** The placeholder for a missing value. */
export const EMPTY_VALUE = '—';

/** The caption: the mockups' `.cap`, in muted — `faint` is not a text colour (OQ-121). */
export const KV_CAPTION = 'type-label text-muted';

/** The suffix after a value, at caption size in body weight. */
export const KV_SUFFIX = 'type-caption font-normal text-muted';

const TONES: Record<KeyValueTone, string> = {
  ink: 'text-ink',
  mint: 'text-mint',
  coral: 'text-coral',
};

const COLUMNS: Record<KeyValueColumns, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
};

const SIZES: Record<KeyValueSize, { list: string; pair: string; value: string }> = {
  sm: { list: 'gap-x-3 gap-y-3 md:gap-x-6', pair: 'gap-1', value: 'type-body-sm' },
  lg: { list: 'gap-x-4 gap-y-3', pair: '', value: 'type-heading-sm' },
};

/**
 * Builds the classes of a value: its size, colour, figures, and a single
 * truncated line so a long value can't widen its column.
 *
 * @param item - The pair whose value it styles.
 * @param size - The list's size.
 * @returns The `<dd>`'s classes.
 */
export const valueClasses = (item: KeyValueItem, size: KeyValueSize): string => {
  const tone = item.value ? TONES[item.tone ?? 'ink'] : 'text-muted';
  return [
    'm-0 truncate',
    SIZES[size].value,
    tone,
    item.numeric && 'tabular-nums',
  ].filter(Boolean).join(' ');
};

/**
 * Spells a value out whole, suffix included, for the tooltip of a value cut
 * short — the suffix is what truncation hides first.
 *
 * @param item - The pair whose value it spells out.
 * @returns The value and its suffix, or `undefined` when there is no value.
 */
export const fullValue = (item: KeyValueItem): string | undefined => (
  item.value ? `${item.value}${item.suffix ?? ''}` : undefined
);

/** The pair value's props. */
interface PairValueProps {
  readonly item: KeyValueItem;
  readonly emptyLabel: string;
}

/**
 * Renders what goes in a `<dd>`: the value and its suffix, or the dash
 * (hidden from screen readers, which hear `emptyLabel` instead).
 *
 * @param props - The pair and the missing value's spoken label.
 * @returns The value's content.
 */
function PairValue({ item, emptyLabel }: PairValueProps) {
  if (!item.value) {
    return (
      <>
        <span aria-hidden="true">{EMPTY_VALUE}</span>
        <span className="sr-only">{emptyLabel}</span>
      </>
    );
  }
  return (
    <>
      {item.value}
      {item.suffix && <span className={KV_SUFFIX}>{item.suffix}</span>}
    </>
  );
}

/**
 * Renders labelled facts as a description list, `columns` pairs to a row.
 * It holds no state.
 *
 * @param props - The pairs, size, column count and missing value's label.
 * @returns The key–value list.
 */
export function KeyValueList({
  items, size = 'sm', columns = 2, emptyLabel,
}: KeyValueListProps) {
  const sizing = SIZES[size];

  return (
    <dl className={`m-0 grid ${COLUMNS[columns]} ${sizing.list}`}>
      {items.map((item, position) => (
        <div
          // The list never reorders; a pair's position is its key.
          // eslint-disable-next-line react/no-array-index-key
          key={position}
          className={`flex min-w-0 flex-col ${sizing.pair}`.trimEnd()}
        >
          <dt className={KV_CAPTION}>{item.label}</dt>
          <dd className={valueClasses(item, size)} title={fullValue(item)}>
            <PairValue item={item} emptyLabel={emptyLabel} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
