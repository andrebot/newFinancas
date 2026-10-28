import {
  useId, useMemo, useState, type InputHTMLAttributes, type Ref,
} from 'react';
import { numberInput } from '../../config/constants';
import { decimalSeparator } from '../../utilities/formatting';
import { useI18n } from '../../utilities/I18nProvider';
import {
  FieldLabel, FieldMessage, fieldAria, messageIdOf, type FieldTexts,
} from '../field/Field';
import { useMaskedInput } from '../maskedInput/useMaskedInput';
import { TextField, joinIds } from '../textField/TextField';
import {
  KIND_SCALE, cleanToShow, decimalMask, exceedsDigits, normalizeDecimal, readScaled,
  type NumberKind,
} from './decimal';

// The number input (K8, OQ-189): a quantity, a rate or a whole percent, typed
// with its decimal point in the interface language, giving the caller the
// API's fixed-point integer — units × 10⁸, percent × 10,000 (OQ-86), or the
// percent itself (OQ-87) — or an exchange rate, × 10,000 and never sent
// (OQ-195). Rates and percents carry a `%` after the number; the label says
// the rest ("% a.a.", "% of CDI"). A quantity and an exchange rate carry none. Two sizes: the kit's
// `field`, and the `compact` box of a Goal allocation row (mockups 32, 51),
// its label for screen readers only.

/** The kinds that are percents: they carry a `%` after the number. */
const PERCENT_KINDS: ReadonlySet<NumberKind> = new Set(['rate', 'percent']);

/** The number input's props: the field texts, the number, its kind and the size. */
export interface NumberInputProps
  extends FieldTexts,
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'value' | 'onChange' | 'children' | 'defaultValue' | 'size'
  > {
  /** The fixed-point integer of the kind (105000 is a 10.5% rate), or `null` while empty. */
  readonly value: number | null;
  /** Gets the new integer, or `null` once nothing but a sign or a point is left. */
  readonly onChange: (value: number | null) => void;
  /**
   * `quantity` (units × 10⁸), `rate` (percent × 10,000), `percent` (whole) or
   * `exchange` (× 10,000).
   */
  readonly kind: NumberKind;
  /** Lets `-` flip the sign, e.g. an index in deflation. Off by default. */
  readonly allowNegative?: boolean | undefined;
  /** `field` (the default) or the small `compact` box, its label hidden. */
  readonly size?: 'field' | 'compact' | undefined;
  /** Layout only, on the whole field, e.g. `w-48`, `flex-1`. */
  readonly className?: string | undefined;
}

/** The props both sizes take once the number is masked. */
type LookProps = Omit<
  NumberInputProps,
  'value' | 'onChange' | 'kind' | 'allowNegative' | 'size'
> & {
  readonly ref: Ref<HTMLInputElement>;
  readonly shown: string;
  readonly change: (typed: string) => void;
  readonly suffix: string | undefined;
};

/**
 * Builds the compact box's classes: the field's border and focus halo (mint,
 * or coral while invalid) on a small right-aligned input.
 *
 * @param invalid - Whether the number shows an error.
 * @returns The input's classes.
 */
export const compactClasses = (invalid: boolean) => [
  'h-9 w-14 rounded-lg border bg-bg px-2 text-right type-body-sm tabular-nums text-ink',
  'outline-none transition-[border-color,box-shadow] duration-150 focus:ring-3',
  invalid
    ? 'border-coral focus:ring-coral/15'
    : 'border-line focus:border-mint focus:ring-mint/15',
  'placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

/**
 * Renders the field size: the kit's text field, the suffix in its trailing slot.
 *
 * @param props - The masked text, its handler, the suffix, field texts and native props.
 * @returns The number field.
 */
function NumberField({
  ref, shown, change, suffix, ...rest
}: LookProps) {
  return (
    <TextField
      {...rest}
      ref={ref}
      value={shown}
      onChange={change}
      trailing={suffix}
      inputClassName="tabular-nums"
    />
  );
}

/**
 * Renders the compact size: a small box with the suffix beside it, the label
 * for screen readers only and the hint or error under it.
 *
 * @param props - The masked text, its handler, the suffix, field texts and native props.
 * @returns The compact number input.
 */
function CompactNumber({
  ref, shown, change, suffix, label, labelAction, hint, error, className, id,
  'aria-describedby': describedBy, ...native
}: LookProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const aria = fieldAria(controlId, { hint, error });
  return (
    <div className={['flex flex-col gap-1', className].filter(Boolean).join(' ')}>
      <FieldLabel controlId={controlId} label={label} labelAction={labelAction} labelHidden />
      <span className="flex items-center gap-1.5">
        <input
          type="text"
          {...native}
          {...aria}
          aria-describedby={joinIds(describedBy, aria['aria-describedby'])}
          id={controlId}
          ref={ref}
          className={compactClasses(Boolean(error))}
          value={shown}
          onChange={(event) => change(event.target.value)}
        />
        {suffix && <span className="type-body-sm text-muted">{suffix}</span>}
      </span>
      <FieldMessage id={messageIdOf(controlId)} hint={hint} error={error} />
    </div>
  );
}

/**
 * Renders a labelled number input in the field or compact size. The caller
 * holds the number: `value` is the kind's fixed-point integer (or `null`)
 * and `onChange` gets the new one. What was typed is kept while it still
 * reads as that number, so `10,` keeps its comma until the next digit. A
 * digit past the kind's whole digits or decimals is refused, and only a
 * changed number is reported.
 *
 * @param props - The number, its handler, kind, size, field texts and native props.
 * @returns The number input.
 */
export function NumberInput({
  value, onChange, kind, allowNegative = false, size = 'field', ...rest
}: NumberInputProps) {
  const { locale } = useI18n();
  const scale = KIND_SCALE[kind];
  const mask = useMemo(
    () => decimalMask(decimalSeparator(locale), scale, allowNegative),
    [locale, scale, allowNegative],
  );
  const [draft, setDraft] = useState('');
  const { ref, value: shown, onChange: change } = useMaskedInput({
    value: cleanToShow(draft, value, scale),
    mask,
    onChange: (clean) => {
      const next = normalizeDecimal(clean);
      if (exceedsDigits(next, scale, numberInput.maxWholeDigits[kind])) {
        return;
      }
      setDraft(next);
      const number = readScaled(next, scale);
      if (number !== value) {
        onChange(number);
      }
    },
  });
  const Look = size === 'compact' ? CompactNumber : NumberField;

  return (
    <Look
      inputMode={scale === 0 ? 'numeric' : 'decimal'}
      autoComplete="off"
      {...rest}
      ref={ref}
      shown={shown}
      change={change}
      suffix={PERCENT_KINDS.has(kind) ? '%' : undefined}
    />
  );
}
