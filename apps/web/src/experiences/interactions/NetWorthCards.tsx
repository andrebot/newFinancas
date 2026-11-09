import { Skeleton } from '../../kit/skeleton/Skeleton';
import { StatTile } from '../../kit/statTile/StatTile';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { inTileOrder, netWorthTileOf, type NetWorthEntry } from '../netWorthTiles';

// Net Worth Cards (FL18, FL21; mockups 20, 50; FR-5.3, OQ-231, OQ-233): one
// K37 tile per currency the Holdings are in, never summed, side by side from
// `md` and stacked on a phone. The grid gives each tile the width K37 needs
// (a grid track, never a plain flex row). While the report loads, two tile
// placeholders keep the page's shape. Display only.

/** Net Worth Cards' props. */
export interface NetWorthCardsProps {
  /** The report's net worth, one entry per currency; unknown while it loads. */
  readonly entries: readonly NetWorthEntry[] | undefined;
  /** The chart's height, in px; K37's default when left out (mockup 50). */
  readonly chartHeightPx?: number | undefined;
  /** Draws the chart's background lines (mockup 20). */
  readonly grid?: boolean | undefined;
}

/** How many tile placeholders show while loading: one per currency the app knows. */
const PLACEHOLDERS = ['first', 'second'] as const;

/**
 * Renders the net worth tiles.
 *
 * @param props - The entries and the chart's look.
 * @returns The tiles, their placeholders while loading, or nothing without a Holding.
 */
export function NetWorthCards({ entries, chartHeightPx, grid }: NetWorthCardsProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  if (entries?.length === 0) return null;
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-2"
      {...(entries === undefined && {
        role: 'status',
        'aria-busy': true,
        'aria-label': translator.text('netWorthCards', 'loading'),
      })}
    >
      {entries === undefined
        ? PLACEHOLDERS.map((key) => (
          <Skeleton key={key} shape="block" className="h-56" />
        ))
        : inTileOrder(entries).map((entry) => (
          <StatTile
            key={entry.currency}
            {...netWorthTileOf(entry, translator, formatter)}
            chartHeightPx={chartHeightPx}
            grid={grid}
          />
        ))}
    </div>
  );
}
