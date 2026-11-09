import type { Currency, LedgerItem } from '@financas/api-types';
import { Amount } from '../../../../../kit/amount/Amount';
import { Button } from '../../../../../kit/button/Button';
import { Icon } from '../../../../../kit/icons/Icon';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { SkeletonRows } from '../../../../../kit/skeleton/Skeleton';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import type { SourceState } from '../../../../../utilities/sourceState';
import useFormatter from '../../../../../utilities/useFormatter';
import { kindIcon, kindName } from '../../../../transactionNames';
import { signedActivityAmountOf, unitsOf } from '../holdingMaintenance';
import { DetailCard } from './DetailCard';

// Activity (FL19; mockup 51; FR-3.8, FR-5.9, OQ-222, OQ-234): a Holding's
// latest transactions — a trade with its units and the price each, a payout
// in mint — and "See in Transactions", which asks for the ledger filtered by
// this Holding. Display only; the read is the Experience's.

/** Activity's props. */
export interface ActivityCardProps {
  /** The Holding's latest transactions, newest first. */
  readonly read: SourceState<readonly LedgerItem[]>;
  readonly currency: Currency;
  /** Asks for the ledger filtered by this Holding. */
  readonly onSeeAll: () => void;
}

/** "See in Transactions": a small mint link with an arrow (mockup 51). */
const LINK = 'inline-flex items-center gap-0.5 type-caption font-medium text-mint hover:underline';

/**
 * Writes a row's title: a trade with its units, anything else by its kind.
 *
 * @param item - The transaction.
 * @param translator - The texts.
 * @returns E.g. "Buy · 400 units".
 */
export const activityTitleOf = (item: LedgerItem, translator: Translator) => {
  const kind = kindName(translator, item.kind ?? '');
  const quantity = item.ledger === 'account' ? item.quantity : undefined;
  if (!quantity) return kind;
  return translator.text('holdingMaintenance', 'activity.trade', {
    kind, units: unitsOf(quantity),
  });
};

/**
 * Draws one transaction.
 *
 * @param props - The transaction and its currency.
 * @returns The row.
 */
function ActivityRow({ item, currency }: {
  readonly item: LedgerItem;
  readonly currency: Currency;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  const amount = signedActivityAmountOf(item.kind, item.amount);
  const quantity = item.ledger === 'account' ? item.quantity : undefined;
  const date = formatter.date(item.date ?? '');
  const meta = quantity
    ? translator.text('holdingMaintenance', 'activity.each', {
      date, price: formatter.money(Math.round(Math.abs(amount) / unitsOf(quantity)), currency),
    })
    : date;
  const tint = amount > 0 ? 'bg-mint/15 text-mint' : 'bg-lilac/15 text-lilac';
  return (
    <li className="flex items-center gap-3 border-b border-line/70 py-2 last:border-b-0">
      <span
        aria-hidden="true"
        className={`grid size-7 shrink-0 place-items-center rounded-full ${tint}`}
      >
        <Icon name={kindIcon(item.kind ?? '')} className="size-[15px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-body-sm font-medium">
          {activityTitleOf(item, translator)}
        </span>
        <span className="truncate type-caption text-muted tabular-nums">{meta}</span>
      </span>
      <Amount
        amount={amount}
        currency={currency}
        tone="signed"
        sign="always"
        className="type-body-sm font-semibold"
      />
    </li>
  );
}

/**
 * Draws the list's state: placeholders, the failure with Try again, the
 * empty line or the rows.
 *
 * @param props - The read and the currency.
 * @returns The list's content.
 */
function ActivityList({ read, currency }: Pick<ActivityCardProps, 'read' | 'currency'>) {
  const translator = useI18n();
  const say = (key: 'activity.loading' | 'activity.empty') => (
    translator.text('holdingMaintenance', key)
  );
  if (read.status === 'loading') {
    return <SkeletonRows label={say('activity.loading')} count={3} />;
  }
  if (read.status === 'failed') {
    return (
      <InlineBanner
        tone="error"
        message={translator.text('holdingMaintenance', 'details.failed')}
        action={(
          <Button variant="ghost" onClick={read.retry}>
            {translator.text('holdingMaintenance', 'retry')}
          </Button>
        )}
      />
    );
  }
  if (read.data.length === 0) {
    return <p className="type-body-sm text-muted">{say('activity.empty')}</p>;
  }
  return (
    <ul className="flex flex-col">
      {read.data.map((item) => <ActivityRow key={item.id} item={item} currency={currency} />)}
    </ul>
  );
}

/**
 * Renders a Holding's latest transactions.
 *
 * @param props - The read, the currency and the link's handler.
 * @returns The card.
 */
export function ActivityCard({ read, currency, onSeeAll }: ActivityCardProps) {
  const translator = useI18n();
  return (
    <DetailCard
      icon="receipt-long-outline"
      title={translator.text('holdingMaintenance', 'activity.title')}
      action={(
        <button
          type="button"
          className={LINK}
          onClick={onSeeAll}
        >
          {translator.text('holdingMaintenance', 'activity.seeAll')}
          <Icon name="arrow-forward" className="size-3.5" />
        </button>
      )}
    >
      <ActivityList read={read} currency={currency} />
    </DetailCard>
  );
}
