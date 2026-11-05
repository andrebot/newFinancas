import { Fragment, useState, type ReactNode } from 'react';
import { Expandable } from '../expandable/Expandable';

// The kit's table (K43, OQ-228): holdings by account (mockup 51) — a row of
// column headers, the caller's groups under small-caps rows with an aside at
// their end, and one expandable row per item on K42's `row` surface. Each
// column carries its own grid track; header and rows share one template over
// identical widths — the header mirrors K42's trigger box (same flex, gap and
// padding, a flex-1 grid of labels, an empty slot where that chevron sits) —
// so they compute the same track sizes for every track type the API accepts:
// px, %, and fr — a bare fraction is normalized to minmax(0, …), because a
// bare fr keeps an implicit auto minimum that would size against each grid's
// own content. Content-based tracks (auto, fit-content) are unsupported. The
// table holds
// each row's open state by key, so the hairline under an opened row goes away
// — mockup 51 draws `!border-0` there. Cells and panels are the caller's: a
// row's cells in column order, the panel padded by the caller (95px on
// holdings). No fetching, paging or empty state: one account's holdings is a
// single small list the Flow loads around it.

/** One column of the table's header; its track keeps header and rows aligned. */
export interface TableColumn {
  /** The header cell's label, from the caller's catalog. */
  readonly label: string;
  /**
   * This column's CSS grid track — px, % or fr, e.g., `minmax(0,2.2fr)` or
   * `110px`. A bare fraction is normalized to a zero minimum (`minmax(0,…)`);
   * other content-based tracks are unsupported: each grid resolves them from
   * its own content, so header and rows could not share them.
   */
  readonly track: string;
  /** Extra classes on the header cell, e.g., `text-right` for figures. */
  readonly className?: string | undefined;
}

/** One group of rows under its small-caps row. */
export interface TableGroup<Item> {
  /** The group's label, from the caller's catalog, e.g., "Fixed income". */
  readonly label: string;
  /** What sits at the group row's end, e.g., the group's total. */
  readonly aside?: ReactNode | undefined;
  /** The group's items, already ordered by the caller. */
  readonly items: readonly Item[];
}

/** The table's props. */
export interface TableProps<Item> {
  /** The columns, in order; each carries its grid track. */
  readonly columns: readonly TableColumn[];
  /** The groups and their rows, already ordered by the caller. */
  readonly groups: readonly TableGroup<Item>[];
  /** Reads an item's stable key; it also keys the open state. */
  readonly keyOf: (item: Item) => string;
  /** Renders a row's cells in column order, e.g., ticker + name, tag, rate… */
  readonly renderItem: (item: Item) => ReactNode;
  /** The panel under an opened row, padded by the caller. */
  readonly renderPanel: (item: Item) => ReactNode;
  /** What sits at the table's end, e.g., a count and total line. */
  readonly footer?: ReactNode | undefined;
}

// The header mirrors K42's row trigger (flex, gap-3, pl-5 pr-4) so its label
// grid gets exactly the width a row's cell grid does; the empty slot stands in
// for that chevron.
const HEADER_ROW = [
  'flex items-center gap-3 border-y border-line py-2 pl-5 pr-4',
].join(' ');

/** The header's stand-in for K42's chevron: its size-5 icon, nothing else. */
const CHEVRON_SLOT = 'size-5 shrink-0';

// The group rows wear the ledger's day-band look (K41): small caps on raised.
const GROUP_ROW = [
  'flex items-center justify-between gap-4',
  'bg-raised/60 px-5 py-2 type-label text-muted',
].join(' ');

// The table's end, under the last row: ruled off and faintly raised (mockup 51).
const FOOTER_ROW = [
  'flex items-center justify-between gap-4 border-t border-line bg-raised/40 px-5 py-3',
].join(' ');

/**
 * Gives a bare fraction track its zero minimum: a bare fr keeps an implicit
 * auto minimum (CSS Grid §7.2), which would size against each grid's own
 * content and drift header from rows.
 *
 * @param track - The column's CSS grid track, as given by the caller.
 * @returns The same track; a bare fraction wrapped in `minmax(0, …)`.
 */
const zeroMinimumOf = (track: string): string => (
  /^\s*[\d.]+fr\s*$/.test(track) ? `minmax(0,${track.trim()})` : track
);

/**
 * Builds the shared grid template of header and rows from the columns' tracks.
 *
 * @param columns - The table's columns, in order; each carries its track.
 * @returns A CSS `grid-template-columns` value joining every track; bare
 * fractions are normalized to a zero minimum.
 */
export const gridTemplateOf = (columns: readonly TableColumn[]): string => (
  columns.map((column) => zeroMinimumOf(column.track)).join(' ')
);

/** The header row's props. */
interface HeaderRowProps {
  /** The table's columns, in order. */
  readonly columns: readonly TableColumn[];
}

/**
 * Renders the column headers in a box that mirrors K42's row trigger — same
 * flex, gap and padding, an empty slot for its chevron — so the label grid gets
 * exactly the width a row's cell grid does.
 *
 * @param props - The table's columns.
 * @returns The header row.
 */
function HeaderRow({ columns }: HeaderRowProps) {
  return (
    <div className={HEADER_ROW}>
      <div
        className="grid min-w-0 flex-1 items-center gap-3"
        style={{ gridTemplateColumns: gridTemplateOf(columns) }}
      >
        {columns.map((column, index) => (
          // The header is static per render; the column's position keys it.
          // eslint-disable-next-line react/no-array-index-key
          <span key={index} className={`type-label text-muted ${column.className ?? ''}`}>
            {column.label}
          </span>
        ))}
      </div>
      <span aria-hidden="true" className={CHEVRON_SLOT} />
    </div>
  );
}

/** The group row's props. */
interface GroupRowProps {
  /** The group's label. */
  readonly label: string;
  /** What sits at the group row's end, e.g., its total. */
  readonly aside?: ReactNode | undefined;
}

/**
 * Renders a group's small-caps row: its label, and the caller's aside at its
 * end in normal case with tabular figures.
 *
 * @param props - The group's label and aside.
 * @returns The group row.
 */
function GroupRow({ label, aside }: GroupRowProps) {
  return (
    <div className={GROUP_ROW}>
      <span>{label}</span>
      {aside && (
        <span className="tracking-normal normal-case tabular-nums">{aside}</span>
      )}
    </div>
  );
}

/** One row's props. */
interface TableRowProps {
  /** The row's cells in column order, from the caller's renderItem. */
  readonly cells: ReactNode;
  /** The panel under an opened row, from the caller's renderPanel. */
  readonly panel: ReactNode;
  /** Whether the panel shows. */
  readonly open: boolean;
  /** Whether this is the table's last row (it drops its hairline). */
  readonly lastInTable: boolean;
  /** Toggles the row, reporting the state it asks for. */
  readonly onOpen: (next: boolean) => void;
}

/**
 * Renders one holding row: K42's `row` expandable over the shared grid, with a
 * hairline under it while closed and not last — an opened row is edged in mint
 * instead (mockup 51 draws `!border-0` there).
 *
 * @param props - The cells, the panel, the open state and its toggle.
 * @returns The row.
 */
function TableRow({
  cells, panel, open, lastInTable, onOpen,
}: TableRowProps) {
  return (
    <li className={open || lastInTable ? undefined : 'border-b border-line/70'}>
      <Expandable surface="row" expanded={open} onExpandedChange={onOpen} summary={cells}>
        {panel}
      </Expandable>
    </li>
  );
}

/**
 * Renders the table: its column headers, each group under its small-caps row,
 * one expandable row per item, and the caller's footer when it passes one. The
 * open state is keyed by keyOf, so a row stays open across re-renders — e.g.,
 * while the Flow switches accounts and back.
 *
 * @param props - The columns, the groups and their rows, how to read and render them,
   and the footer.
 * @returns The table.
 */
export function Table<Item>({
  columns, groups, keyOf, renderItem, renderPanel, footer,
}: TableProps<Item>) {
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const template = gridTemplateOf(columns);

  return (
    <div>
      <HeaderRow columns={columns} />
      {groups.map((group, groupIndex) => (
        // A group may come back after another; its position keys it.
        // eslint-disable-next-line react/no-array-index-key
        <Fragment key={`${groupIndex}-${group.label}`}>
          <GroupRow label={group.label} aside={group.aside} />
          <ul>
            {group.items.map((item, itemIndex) => {
              const key = keyOf(item);
              const isLastGroup = groupIndex === groups.length - 1;
              const lastInTable = isLastGroup && itemIndex === group.items.length - 1;
              return (
                <TableRow
                  key={key}
                  cells={(
                    <div
                      className="grid items-center gap-3"
                      style={{ gridTemplateColumns: template }}
                    >
                      {renderItem(item)}
                    </div>
                  )}
                  panel={renderPanel(item)}
                  open={openKeys[key] === true}
                  lastInTable={lastInTable}
                  onOpen={(next) => setOpenKeys({ ...openKeys, [key]: next })}
                />
              );
            })}
          </ul>
        </Fragment>
      ))}
      {footer && <div className={FOOTER_ROW}>{footer}</div>}
    </div>
  );
}
