import type { Currency } from '@financas/api-types';
import { formatMoney, type MoneyOptions } from '../../utilities/formatting';

// The kit's amount (K29, OQ-211): money as the app shows it everywhere — the
// API's minor units written in the currency's own conventions
// (FormattingUtility), in tabular figures so columns of amounts line up. It
// sets no size or weight: amounts run from the 34px hero to 11px captions,
// so the caller's `className` sets them. Colour is opt-in: the mockups
// colour a transaction's amount by its sign, the ledger's day totals only
// when money came in, and keep balances and the In/Out Total plain. A
// coloured amount writes its `+` by default, so the colour never carries
// the meaning alone (WCAG 1.4.1).

/**
 * How the amount is coloured: `plain` takes the surrounding colour; `signed`
 * is mint above zero and coral below; `inflow` is mint above zero only.
 */
export type AmountTone = 'plain' | 'signed' | 'inflow';

/** The amount's props. */
export interface AmountProps {
  /** The amount in the currency's minor units (cents), signed, as the API sends it. */
  readonly amount: number;
  /** The amount's currency. */
  readonly currency: Currency;
  /**
   * `always` writes `+` on a positive amount, `auto` only `−` on a negative
   * one; defaults to `always` on a coloured tone, `auto` on a plain one.
   */
  readonly sign?: MoneyOptions['sign'];
  /** Defaults to `plain`. */
  readonly tone?: AmountTone | undefined;
  /** Size, weight and extra classes, e.g. `type-display-sm` or `font-semibold`. */
  readonly className?: string | undefined;
}

/**
 * Picks the colour of an amount: mint for money in on a coloured tone,
 * coral for money out on a signed one, else the surrounding colour.
 *
 * @param amount - The amount, signed.
 * @param tone - How the amount is coloured.
 * @returns The colour class, or nothing for the surrounding colour.
 */
const colorOf = (amount: number, tone: AmountTone): string | undefined => {
  if (tone === 'plain') return undefined;
  if (amount > 0) return 'text-mint';
  if (amount < 0 && tone === 'signed') return 'text-coral';
  return undefined;
};

/**
 * Builds the classes of an amount.
 *
 * @param amount - The amount, signed; it decides a coloured tone's colour.
 * @param tone - How the amount is coloured.
 * @param className - The caller's size, weight and extra classes, if any.
 * @returns The amount's classes.
 */
export const amountClasses = (amount: number, tone: AmountTone, className?: string) => [
  'tabular-nums whitespace-nowrap',
  colorOf(amount, tone),
  className,
].filter(Boolean).join(' ');

/**
 * Renders an amount of money.
 *
 * @param props - The amount, its currency, how its sign shows, its tone and classes.
 * @returns The formatted amount, e.g. `R$ 1.234,56`, `+$3,200.00`, `−$45.99`.
 */
export function Amount({
  amount, currency, sign, tone = 'plain', className,
}: AmountProps) {
  const shownSign = sign ?? (tone === 'plain' ? 'auto' : 'always');
  return (
    <span className={amountClasses(amount, tone, className)}>
      {formatMoney(amount, currency, { sign: shownSign })}
    </span>
  );
}
