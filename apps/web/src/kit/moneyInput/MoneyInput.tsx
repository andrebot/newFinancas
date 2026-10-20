import type { Currency } from '@financas/api-types';
import {
  useId, useMemo, type InputHTMLAttributes, type ReactNode, type Ref,
} from 'react';
import { moneyInput } from '../../config/constants';
import { moneyConventions } from '../../utilities/formatting';
import {
  FieldLabel, FieldMessage, fieldAria, messageIdOf, type FieldTexts,
} from '../field/Field';
import { useMaskedInput } from '../maskedInput/useMaskedInput';
import { TextField, joinIds } from '../textField/TextField';
import {
  amountToClean, exceedsMaxDigits, formatMoneyDigits, moneyMask, readAmount,
} from './money';

// The money input (K7, OQ-188): an amount typed in its currency's own
// conventions, cents first, giving the caller minor units. Two looks: the
// `field`, the kit's text field with the symbol as its prefix (a market
// value, mockup 52); and the `hero`, the mockups' amount panel, its label
// inside and the number in display type (record drawer, starting balance,
// budget and goal targets). A `direction` signs the prefix for an amount the
// transaction kind signs: −R$ in coral for money out, +R$ in mint for money in.

/** Which way an amount moves, when its kind gives it a sign. */
export type MoneyDirection = 'in' | 'out';

/** The money input's props: the field texts, the amount, its currency and the look. */
export interface MoneyInputProps
  extends FieldTexts,
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'value' | 'onChange' | 'children' | 'defaultValue'
  > {
  /** Minor units (cents), or `null` while empty. */
  readonly value: number | null;
  /** Gets the new amount in minor units, or `null` once every digit is deleted. */
  readonly onChange: (amount: number | null) => void;
  readonly currency: Currency;
  /** Lets `-` flip the sign, e.g. an overdrawn starting balance. Off by default. */
  readonly allowNegative?: boolean | undefined;
  /** Signs and tones the prefix: `out` −R$ coral, `in` +R$ mint. */
  readonly direction?: MoneyDirection | undefined;
  /** `field` (the default) or the big `hero` panel. */
  readonly variant?: 'field' | 'hero' | undefined;
  /** Layout only, on the whole field, e.g. `w-48`, `flex-1`. */
  readonly className?: string | undefined;
}

const DIRECTION_STYLE: Record<MoneyDirection, { readonly sign: string; readonly tone: string }> = {
  in: { sign: '+', tone: 'text-mint' },
  out: { sign: '−', tone: 'text-coral' },
};

/**
 * Builds the prefix's text and tone: the symbol, signed and coloured when
 * the amount has a direction.
 *
 * @param symbol - The currency's symbol, e.g. `R$`.
 * @param direction - Which way the amount moves, if its kind signs it.
 * @returns The prefix's text and its colour class.
 */
export const prefixOf = (symbol: string, direction?: MoneyDirection) => {
  if (!direction) {
    return { text: symbol, tone: 'text-muted' };
  }
  const { sign, tone } = DIRECTION_STYLE[direction];
  return { text: `${sign}${symbol}`, tone };
};

/**
 * Builds the classes of the hero panel: the field's border and focus halo
 * (mint, or coral while invalid) on the mockups' amount panel.
 *
 * @param invalid - Whether the amount shows an error.
 * @returns The panel's classes.
 */
export const heroClasses = (invalid: boolean) => [
  'flex flex-col gap-1 rounded-2xl border bg-bg px-5 py-4',
  'transition-[border-color,box-shadow] duration-150 focus-within:ring-3',
  invalid
    ? 'border-coral focus-within:ring-coral/15'
    : 'border-line focus-within:border-mint focus-within:ring-mint/15',
  'has-disabled:cursor-not-allowed has-disabled:opacity-50',
].join(' ');

/** What the hero panel draws around its input. */
interface MoneyHeroProps extends FieldTexts {
  readonly controlId: string;
  readonly prefix: ReactNode;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * Renders the hero panel: the label inside at the top, the prefix and the
 * amount on one baseline, and the hint or error under them.
 *
 * @param props - The input's id, the texts, the prefix, layout classes and the input.
 * @returns The panel.
 */
function MoneyHero({
  controlId, label, labelAction, hint, error, prefix, className, children,
}: MoneyHeroProps) {
  return (
    <div className={[heroClasses(Boolean(error)), className].filter(Boolean).join(' ')}>
      <FieldLabel controlId={controlId} label={label} labelAction={labelAction} />
      <div className="flex items-baseline gap-2">
        {prefix}
        {children}
      </div>
      <FieldMessage id={messageIdOf(controlId)} hint={hint} error={error} />
    </div>
  );
}

/** The props both looks take once the amount is masked. */
type LookProps = Omit<
  MoneyInputProps,
  'value' | 'onChange' | 'currency' | 'allowNegative' | 'direction' | 'variant'
> & {
  readonly ref: Ref<HTMLInputElement>;
  readonly shown: string;
  readonly change: (typed: string) => void;
  readonly currencyPrefix: ReactNode;
};

/** The input classes of the hero's amount: display type that fills the row. */
const HERO_INPUT_CLASSES = [
  'min-w-0 flex-1 bg-transparent type-display-lg tabular-nums text-ink outline-none',
  'placeholder:text-faint disabled:cursor-not-allowed',
].join(' ');

/**
 * Renders the field look: the kit's text field, the prefix in its leading slot.
 *
 * @param props - The masked text, its handler, the currency prefix, field texts and native props.
 * @returns The money field.
 */
function MoneyField({
  ref, shown, change, currencyPrefix, ...rest
}: LookProps) {
  return (
    <TextField
      inputMode="numeric"
      autoComplete="off"
      {...rest}
      ref={ref}
      value={shown}
      onChange={change}
      leading={currencyPrefix}
      inputClassName="tabular-nums"
    />
  );
}

/**
 * Renders the hero look: the amount panel around a bare input in display type.
 *
 * @param props - The masked text, its handler, the currency prefix, field texts and native props.
 * @returns The hero money input.
 */
function MoneyHeroInput({
  ref, shown, change, currencyPrefix, label, labelAction, hint, error, className, id,
  'aria-describedby': describedBy, ...native
}: LookProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const aria = fieldAria(controlId, { hint, error });
  return (
    <MoneyHero
      controlId={controlId}
      label={label}
      labelAction={labelAction}
      hint={hint}
      error={error}
      className={className}
      prefix={currencyPrefix}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        {...native}
        {...aria}
        aria-describedby={joinIds(describedBy, aria['aria-describedby'])}
        id={controlId}
        ref={ref}
        className={HERO_INPUT_CLASSES}
        value={shown}
        onChange={(event) => change(event.target.value)}
      />
    </MoneyHero>
  );
}

/**
 * Renders a labelled money input in the field or hero look. It holds no
 * state: `value` is minor units (or `null`) and `onChange` gets the new ones.
 * Every digit typed shifts the amount left, cents first; a digit past the
 * cap is refused, and only a changed amount is reported.
 *
 * @param props - The amount, its handler, currency, look, field texts and native props.
 * @returns The money input.
 */
export function MoneyInput({
  value, onChange, currency, allowNegative = false, direction, variant = 'field', ...rest
}: MoneyInputProps) {
  const conventions = useMemo(() => moneyConventions(currency), [currency]);
  const mask = useMemo(() => moneyMask(conventions, allowNegative), [conventions, allowNegative]);
  const { ref, value: shown, onChange: change } = useMaskedInput({
    value: amountToClean(value),
    mask,
    onChange: (clean) => {
      const amount = readAmount(clean);
      if (!exceedsMaxDigits(clean, moneyInput.maxDigits) && amount !== value) {
        onChange(amount);
      }
    },
  });
  const { text, tone } = prefixOf(conventions.symbol, direction);
  const Look = variant === 'hero' ? MoneyHeroInput : MoneyField;
  const prefixType = variant === 'hero' ? 'type-heading-lg' : 'type-body-lg font-semibold';

  return (
    <Look
      placeholder={formatMoneyDigits('0', conventions)}
      {...rest}
      ref={ref}
      shown={shown}
      change={change}
      currencyPrefix={<span className={`${prefixType} ${tone}`}>{text}</span>}
    />
  );
}
