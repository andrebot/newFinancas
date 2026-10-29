import type { Currency } from '@financas/api-types';
import { formatMoney, type MoneyOptions } from '../../utilities/formatting';

// The kit's amount (K29, OQ-211): money as the app shows it everywhere — the
// API's minor units written in the currency's own conventions
// (FormattingUtility), in tabular figures so columns of amounts line up. It
// sets no size or weight: amounts run from the 34px hero to 11px captions,
// so the caller's `className` sets them. Colour is opt-in: the mockups
// colour a transaction's amount by its sign but keep balances, the In/Out
// Total and the ledger's day totals in the surrounding colour.

/** How the amount is coloured: the surrounding colour, or mint / coral by its sign. */
export type AmountTone = 'plain' | 'signed';

/** The amount's props. */
export interface AmountProps {
  /** The amount in the currency's minor units (cents), signed, as the API sends it. */
  readonly amount: number;
  /** The amount's currency. */
  readonly currency: Currency;
  /** `always` writes `+` on a positive amount; defaults to `auto`, only `−` on a negative one. */
  readonly sign?: MoneyOptions['sign'];
  /** Defaults to `plain`. */
  readonly tone?: AmountTone | undefined;
  /** Size, weight and extra classes, e.g. `type-display-sm` or `font-semibold`. */
  readonly className?: string | undefined;
}

/**
 * Picks the colour of a signed amount: mint for money in, coral for money
 * out, the surrounding colour at zero.
 *
 * @param amount - The amount, signed.
 * @returns The colour class, or nothing at zero.
 */
const signedColor = (amount: number): string | undefined => {
  if (amount > 0) return 'text-mint';
  if (amount < 0) return 'text-coral';
  return undefined;
};

/**
 * Builds the classes of an amount.
 *
 * @param amount - The amount, signed; it decides a signed tone's colour.
 * @param tone - How the amount is coloured.
 * @param className - The caller's size, weight and extra classes, if any.
 * @returns The amount's classes.
 */
export const amountClasses = (amount: number, tone: AmountTone, className?: string) => [
  'tabular-nums whitespace-nowrap',
  tone === 'signed' && signedColor(amount),
  className,
].filter(Boolean).join(' ');

/**
 * Renders an amount of money.
 *
 * @param props - The amount, its currency, how its sign shows, its tone and classes.
 * @returns The formatted amount, e.g. `R$ 1.234,56`, `+$3,200.00`, `−$45.99`.
 */
export function Amount({
  amount, currency, sign = 'auto', tone = 'plain', className,
}: AmountProps) {
  return (
    <span className={amountClasses(amount, tone, className)}>
      {formatMoney(amount, currency, { sign })}
    </span>
  );
}
