import { useId } from 'react';
import type { Currency, InvestmentHolding } from '@financas/api-types';
import { isFixedTerm } from '@financas/reference';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { CHIP } from '../../../../../kit/chipGroup/ChipGroup';
import { FieldMessage, messageIdOf } from '../../../../../kit/field/Field';
import { LockedField } from '../../../../../kit/field/LockedField';
import { Icon } from '../../../../../kit/icons/Icon';
import { KIND_SCALE } from '../../../../../kit/numberInput/decimal';
import { NumberInput } from '../../../../../kit/numberInput/NumberInput';
import { SkeletonRows } from '../../../../../kit/skeleton/Skeleton';
import type { Formatter } from '../../../../../utilities/formatting';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import useFormatter from '../../../../../utilities/useFormatter';
import type { Load } from '../recordTransactionState';
import { isTrade } from '../transactionForm';
import { assetTypeName, rateText, recordText } from '../recordText';

/** One unit of a Holding, in the × 10⁸ fixed point quantities travel in (OQ-189). */
const UNIT = 10 ** KIND_SCALE.quantity;

// Holding Selection (FL15, mockup 35; FR-3.8, OQ-201 D10): a sell, a
// redemption, a dividend, interest or tax picks the account's Holding — two
// fixed-term contracts can share a name, so it is picked, never typed — each
// row its name, what it is and what it cost. A sell or redemption also takes
// the units, no more than held. The Holdings are the Experience's, read
// through the Flow; on an edit the Holding is shown, never changed (D6).

/** HoldingSelection's props. */
export interface HoldingSelectionProps {
  /** The kind's code: a trade asks for the units. */
  readonly kind: string;
  /** The account's Holdings, as read; nothing while no account is chosen. */
  readonly holdings?: Load<readonly InvestmentHolding[]> | undefined;
  /** The account's currency, for the cost. */
  readonly currency: Currency | undefined;
  readonly holdingId: string | undefined;
  /** Units × 10⁸, `null` while empty. */
  readonly quantity: number | null;
  readonly holdingError?: string | undefined;
  readonly quantityError?: string | undefined;
  /** An edit: the Holding shown, with this name (OQ-201 D6). */
  readonly lockedName?: string | undefined;
  readonly onHolding: (holding: InvestmentHolding) => void;
  readonly onQuantity: (quantity: number | null) => void;
  /** Asks for the Holdings again after a failed read. */
  readonly onRetry: () => void;
}

/**
 * Writes a fixed-term rate the way the contract quotes it: "110% of CDI",
 * its spread on top.
 *
 * @param rate - The Holding's rate.
 * @param translator - The texts.
 * @param formatter - Numbers in the interface language.
 * @returns The rate's text.
 */
export const rateTextOf = (
  rate: NonNullable<InvestmentHolding['rate']>,
  translator: Translator,
  formatter: Formatter,
) => rateText(translator, formatter, rate);

/**
 * Describes a Holding: its asset type and units, or a fixed-term contract's
 * rate and due date (mockup 35).
 *
 * @param holding - The Holding.
 * @param translator - The texts.
 * @param formatter - Numbers and dates in the interface language.
 * @returns The row's second line.
 */
export const holdingMetaOf = (
  holding: InvestmentHolding,
  translator: Translator,
  formatter: Formatter,
) => {
  const assetType = assetTypeName(translator, holding.assetType);
  const { rate } = holding;
  if (!rate || !isFixedTerm(holding.assetType ?? '')) {
    return recordText(translator, 'holding.units', {
      assetType, units: (holding.quantity ?? 0) / UNIT,
    });
  }
  return recordText(translator, 'holding.contract', {
    assetType,
    rate: rateTextOf(rate, translator, formatter),
    dueDate: holding.dueDate ? formatter.date(holding.dueDate) : '—',
  });
};

/** The rows' props. */
interface HoldingRowsProps {
  readonly holdings: readonly InvestmentHolding[];
  readonly currency: Currency | undefined;
  readonly holdingId: string | undefined;
  readonly error?: string | undefined;
  readonly onHolding: (holding: InvestmentHolding) => void;
}

/**
 * Renders the Holdings as radio rows, or the note that the account has none.
 *
 * @param props - The Holdings, the currency, the choice, the error and the handler.
 * @returns The rows.
 */
function HoldingRows({
  holdings, currency, holdingId, error, onHolding,
}: HoldingRowsProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const name = useId();
  const messageId = messageIdOf(name);
  if (holdings.length === 0) {
    return <p className="type-body-sm text-muted">{recordText(translator, 'holding.none')}</p>;
  }
  return (
    <>
      <div
        role="radiogroup"
        aria-label={recordText(translator, 'field.holding')}
        className="flex flex-col gap-1.5"
      >
        {holdings.map((holding, index) => (
          <label
            key={holding.id}
            htmlFor={`${name}-${holding.id}`}
            className={`${CHIP} !h-auto justify-between py-2`}
          >
            <input
              id={`${name}-${holding.id}`}
              type="radio"
              className="sr-only"
              name={name}
              checked={holding.id === holdingId}
              onChange={() => onHolding(holding)}
              aria-describedby={messageId}
              aria-invalid={error && index === 0 ? true : undefined}
            />
            <span className="flex min-w-0 flex-col items-start">
              <span className="truncate font-semibold">{holding.ticker}</span>
              <span className="type-caption text-muted">
                {holdingMetaOf(holding, translator, formatter)}
              </span>
            </span>
            {currency && (
              <span className="num type-body-sm text-muted">
                {formatter.money(holding.costBasis ?? 0, currency)}
              </span>
            )}
          </label>
        ))}
      </div>
      <FieldMessage
        id={messageId}
        hint={recordText(translator, 'holding.hint')}
        error={error}
      />
    </>
  );
}

/**
 * Renders the Holding picker for its read's state: a loading row, a failure
 * with Try again, or the rows; before an account is chosen, a note.
 *
 * @param props - The read and the rows' props.
 * @returns The picker.
 */
function HoldingPicker({ holdings, onRetry, ...rows }: Omit<HoldingRowsProps, 'holdings'> & {
  readonly holdings?: Load<readonly InvestmentHolding[]> | undefined;
  readonly onRetry: () => void;
}) {
  const translator = useI18n();
  if (holdings === undefined) {
    return (
      <p className="type-body-sm text-muted">{recordText(translator, 'holding.pickAccount')}</p>
    );
  }
  if (holdings.status === 'loading') {
    return <SkeletonRows label={recordText(translator, 'holding.loading')} count={2} />;
  }
  if (holdings.status === 'failed') {
    return (
      <InlineBanner
        tone="error"
        message={recordText(translator, 'holding.failed')}
        action={(
          <Button variant="ghost" onClick={onRetry}>{recordText(translator, 'retry')}</Button>
        )}
      />
    );
  }
  const open = holdings.data.filter((holding) => !holding.archivedAt);
  return <HoldingRows {...rows} holdings={open} />;
}

/**
 * Tells how many units the chosen Holding holds.
 *
 * @param holdings - The account's Holdings, as read.
 * @param holdingId - The Holding chosen.
 * @returns Its units × 10⁸, or nothing.
 */
const heldOf = (holdings: HoldingSelectionProps['holdings'], holdingId: string | undefined) => (
  holdings?.status === 'loaded'
    ? holdings.data.find((holding) => holding.id === holdingId)?.quantity
    : undefined
);

/**
 * Renders the Holding section: the picker — or the locked Holding of an edit —
 * and a trade's units, with how many are held.
 *
 * @param props - The kind, the read, the choices, the errors, the lock and the handlers.
 * @returns The section.
 */
export function HoldingSelection({
  kind, holdings, currency, holdingId, quantity, holdingError, quantityError, lockedName,
  onHolding, onQuantity, onRetry,
}: HoldingSelectionProps) {
  const translator = useI18n();
  const held = heldOf(holdings, holdingId);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex items-center gap-2 type-body-sm font-semibold">
        <Icon name="inventory-2-outline" className="size-4.5 text-muted" />
        {recordText(translator, 'field.holding')}
      </div>
      {lockedName === undefined
        ? (
          <HoldingPicker
            holdings={holdings}
            currency={currency}
            holdingId={holdingId}
            error={holdingError}
            onHolding={onHolding}
            onRetry={onRetry}
          />
        )
        : <LockedField label={recordText(translator, 'field.holding')} value={lockedName} />}
      {isTrade(kind) && (
        <NumberInput
          kind="quantity"
          className="sm:w-48"
          label={recordText(translator, `quantity.${kind}`)}
          hint={held === undefined
            ? undefined
            : recordText(translator, 'quantity.held', { held: held / UNIT })}
          error={quantityError}
          value={quantity}
          onChange={onQuantity}
        />
      )}
    </section>
  );
}
