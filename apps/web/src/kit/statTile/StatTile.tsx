import type { Currency } from '@financas/api-types';
import { statTile } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { Amount } from '../amount/Amount';
import { Card } from '../card/Card';
import type { IconName } from '../icons/Icon';
import { LineChart, type LinePoint } from '../lineChart/LineChart';
import { Tag, type TagTone } from '../tag/Tag';

// The kit's Stat tile (K37, OQ-231): one currency's net worth, the same on the
// Dashboard and Investments (mockups 20 and 50) — a label, the change against
// the previous month, the big number and its chart. It only displays: the
// caller loads the figures and formats each point (FormattingUtility).

/** The change against an earlier month. */
export interface StatTileChange {
  /** The difference in minor units, signed. */
  readonly amount: number;
  /** The month it compares against, already formatted, e.g. "Aug". */
  readonly comparedTo: string;
}

/** The Stat tile's props. */
export interface StatTileProps {
  /** What the figure is, already translated; it names the chart too. */
  readonly label: string;
  /** The figure, in the currency's minor units. */
  readonly amount: number;
  /** The figure's currency, which also sets the chart's colour. */
  readonly currency: Currency;
  /** The change to show; without it there is no pill. */
  readonly change?: StatTileChange | undefined;
  /** The chart's series, as K38 takes it. */
  readonly points: readonly LinePoint[];
  /** The chart's height, in px. Defaults to `statTile.defaultChartHeightPx`. */
  readonly chartHeightPx?: number | undefined;
  /** Draws dashed background lines on the chart (mockup 20). */
  readonly grid?: boolean | undefined;
}

/** How a change's pill looks. */
interface PillLook {
  readonly tone: TagTone;
  readonly icon: IconName | undefined;
}

/**
 * Picks how a change's pill looks: mint and up for a rise, coral and down for a
 * fall, neutral with no arrow for no change.
 *
 * @param amount - The difference, signed.
 * @returns The pill's tone and glyph.
 */
export const pillLookOf = (amount: number): PillLook => {
  if (amount > 0) {
    return { tone: 'mint', icon: 'arrow-upward' };
  }
  if (amount < 0) {
    return { tone: 'coral', icon: 'arrow-downward' };
  }
  return { tone: 'neutral', icon: undefined };
};

/**
 * Draws the change's pill.
 *
 * @param props - The change and its currency.
 * @returns The pill.
 */
function ChangePill({ change, currency }: {
  readonly change: StatTileChange;
  readonly currency: Currency;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  const { amount, comparedTo } = change;
  const { tone, icon } = pillLookOf(amount);
  return (
    <Tag tone={tone} icon={icon} className="tabular-nums">
      {amount === 0
        ? translator.text('statTile', 'unchanged', { month: comparedTo })
        : translator.text('statTile', 'change', {
          amount: formatter.money(amount, currency, { sign: 'always' }),
          month: comparedTo,
        })}
    </Tag>
  );
}

/**
 * Renders a Stat tile.
 *
 * @param props - The label, the figure, its change and its chart.
 * @returns The tile.
 */
export function StatTile({
  label, amount, currency, change, points, chartHeightPx, grid,
}: StatTileProps) {
  return (
    <Card className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="type-label text-muted">{label}</span>
        {change && <ChangePill change={change} currency={currency} />}
      </div>
      <Amount
        amount={amount}
        currency={currency}
        className="type-display-sm @xs:type-display-lg"
      />
      <LineChart
        points={points}
        ariaLabel={label}
        shape="trend"
        tone={statTile.chartTones[currency]}
        heightPx={chartHeightPx ?? statTile.defaultChartHeightPx}
        grid={grid}
      />
    </Card>
  );
}
