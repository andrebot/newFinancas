import type { Currency, InvestmentHolding } from '@financas/api-types';
import { KeyValueList } from '../../../../../kit/keyValueList/KeyValueList';
import { useI18n } from '../../../../../utilities/I18nProvider';
import useFormatter from '../../../../../utilities/useFormatter';
import { averagePriceOf, monthlyYieldOf, unitsOf } from '../holdingMaintenance';
import { DetailCard } from './DetailCard';

// Position (FL19; mockup 51; FR-5.2, FR-5.9, OQ-234): a market-priced
// Holding's read-only position — units, average price and what it cost, all
// from its trades — and what it paid out this month with that payout's yield
// on today's value. The mockup's "71% of this account's FIIs" is left out:
// nothing defines what it measures. Display only.

/** Position's props. */
export interface PositionCardProps {
  readonly holding: InvestmentHolding;
  readonly currency: Currency;
  /** Today's value, for the yield. */
  readonly value: number;
  /** What it paid this month (FR-5.9). */
  readonly payout: number;
}

/** Percent × 10,000 per unit of a ratio: the rate formatter's scale (OQ-86). */
const RATE_SCALE = 1_000_000;

/**
 * Renders a market-priced Holding's position.
 *
 * @param props - The Holding, its currency, today's value and this month's payout.
 * @returns The card.
 */
export function PositionCard({
  holding, currency, value, payout,
}: PositionCardProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const say = (key: string, params?: Record<string, string | number>) => (
    translator.text('holdingMaintenance', key as 'position.title', params)
  );
  const average = averagePriceOf(holding);
  const yieldRatio = monthlyYieldOf(payout, value);
  return (
    <DetailCard icon="pie-chart-outline" title={say('position.title')} mode="readOnly">
      <KeyValueList
        size="lg"
        columns={2}
        emptyLabel={say('contract.unknown')}
        items={[
          {
            label: say('position.quantity'),
            value: say('quantity', { units: unitsOf(holding.quantity) }),
            numeric: true,
          },
          {
            label: say('position.averagePrice'),
            value: average === null ? undefined : formatter.money(average, currency),
            numeric: true,
          },
          {
            label: say('position.invested'),
            value: formatter.money(holding.costBasis ?? 0, currency),
            numeric: true,
          },
          {
            label: say('position.payout'),
            value: formatter.money(payout, currency),
            suffix: say('position.perMonth'),
            tone: payout > 0 ? 'mint' : 'ink',
            numeric: true,
          },
        ]}
      />
      <p className="mt-auto type-caption text-muted">
        {yieldRatio === null
          ? say('position.noPayout')
          : say('position.yield', { yield: formatter.rate(Math.round(yieldRatio * RATE_SCALE)) })}
      </p>
    </DetailCard>
  );
}
