import type { InvestmentHolding } from '@financas/api-types';
import { portfolio } from '../../../../../config/constants';
import { Amount } from '../../../../../kit/amount/Amount';
import { Card } from '../../../../../kit/card/Card';
import { SectionHeader } from '../../../../../kit/sectionHeader/SectionHeader';
import { SkeletonRows } from '../../../../../kit/skeleton/Skeleton';
import { Tag } from '../../../../../kit/tag/Tag';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { categoryColor, categoryTint } from '../../../../../utilities/theme';
import type { AssetFamily } from '../../../../holdingNames';
import type { PayoutThisMonthEntry } from '../../../../payoutPanel';
import { payoutRowsOf, totalsByCurrency } from '../portfolioOverview';

// Payout This Month (FL18; mockup 50; FR-5.9, OQ-233): this month's dividend
// and interest transactions, one row each — the Holding's ticker tinted by its
// family, the kind and the amount received — R$ first, the largest first; and
// the total per currency, never summed across currencies. Display only.

/** Payout This Month's props. */
export interface PayoutThisMonthProps {
  /** The month, already formatted, e.g. "September/2026". */
  readonly period: string;
  /** This month's transactions; unknown while the report loads. */
  readonly entries: readonly PayoutThisMonthEntry[] | undefined;
  /** The household's Holdings, to name each one. */
  readonly holdings: readonly InvestmentHolding[];
}

/**
 * Draws a ticker tinted by its family (mockup 50: FIIs lilac, stocks sun).
 *
 * @param props - The ticker and its family.
 * @returns The chip.
 */
function TickerChip({ ticker, family }: { readonly ticker: string; readonly family: AssetFamily }) {
  const tone = portfolio.familyTones[family];
  return (
    <span
      className="max-w-40 shrink-0 truncate rounded-md px-1.5 py-0.5 type-caption font-bold"
      style={{ background: categoryTint(tone), color: categoryColor(tone) }}
    >
      {ticker}
    </span>
  );
}

/**
 * Renders the totals, one per currency, joined by a dot.
 *
 * @param props - The month's transactions.
 * @returns The total line.
 */
function Totals({ entries }: { readonly entries: readonly PayoutThisMonthEntry[] }) {
  const translator = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
      <span className="type-body-sm font-semibold text-ink">
        {translator.text('payoutThisMonth', 'total')}
      </span>
      <span className="flex flex-wrap justify-end gap-x-1.5 type-body-sm font-bold">
        {totalsByCurrency(entries).map(({ currency, amount }, index) => (
          <span key={currency}>
            {index > 0 && <span className="text-muted" aria-hidden="true">· </span>}
            <Amount amount={amount} currency={currency} tone="inflow" sign="auto" />
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * Renders this month's payouts.
 *
 * @param props - The month, its transactions and the Holdings.
 * @returns The panel: the rows and totals, placeholders while loading, or a line when none came in.
 */
export function PayoutThisMonth({ period, entries, holdings }: PayoutThisMonthProps) {
  const translator = useI18n();
  return (
    <Card as="section" className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        title={translator.text('payoutThisMonth', 'title')}
        actions={<Tag tone="mint">{period}</Tag>}
      />
      {entries === undefined && (
        <SkeletonRows label={translator.text('payoutThisMonth', 'loading')} count={4} />
      )}
      {entries?.length === 0 && (
        <p className="py-2 type-body-sm text-muted">
          {translator.text('payoutThisMonth', 'empty')}
        </p>
      )}
      {entries !== undefined && entries.length > 0 && (
        <>
          <ul className="divide-y divide-line">
            {payoutRowsOf(
              entries,
              holdings,
              translator.text('holdingNames', 'unknown'),
            ).map(({ entry, ticker, family }) => (
              <li key={entry.transactionId} className="flex items-center gap-3 py-2.5">
                <TickerChip ticker={ticker} family={family} />
                <span className="min-w-0 flex-1 truncate type-caption text-muted">
                  {translator.text('transactions', `kind.${entry.kind}`)}
                </span>
                <Amount
                  amount={entry.amount}
                  currency={entry.currency}
                  tone="signed"
                  className="type-body-sm font-bold"
                />
              </li>
            ))}
          </ul>
          <Totals entries={entries} />
        </>
      )}
    </Card>
  );
}
