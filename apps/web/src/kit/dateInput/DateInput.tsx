import { useMemo, useState, type InputHTMLAttributes } from 'react';
import { dateConventions } from '../../utilities/formatting';
import { useI18n } from '../../utilities/I18nProvider';
import type { FieldTexts } from '../field/Field';
import { useMaskedInput } from '../maskedInput/useMaskedInput';
import { TextField } from '../textField/TextField';
import {
  cleanToShow, cleanToValue, dateLayout, dateMask, datePlaceholder,
} from './dateMask';

// The date input (K9, OQ-190): a calendar date typed in the interface
// language's order (`14/09/2026`, `09/14/2026`), giving the caller the
// contract's `YYYY-MM-DD`. It is the kit's text field with a mask, as the
// mockups draw it (Record, Due date, As of, the history editor); whether the
// date exists and its bounds are the ValidationUtility's `isoDate` rule
// (OQ-119). A native `type="date"` writes the browser's format, not the
// app's, and can't take the theme.

/** The date input's props: the field texts and the date. */
export interface DateInputProps
  extends FieldTexts,
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'value' | 'onChange' | 'children' | 'defaultValue'
  > {
  /** The date, `YYYY-MM-DD`; `''` while empty. */
  readonly value: string;
  /**
   * Gets the new date: `YYYY-MM-DD` once all its digits are typed, `''` once
   * cleared, and the pieces typed so far (e.g. `--1`) in between, which
   * `isoDate` reports as malformed.
   */
  readonly onChange: (value: string) => void;
  /** Layout only, on the whole field, e.g. `w-40`. */
  readonly className?: string | undefined;
}

/**
 * Renders a labelled date input. The caller holds the date: `value` is
 * `YYYY-MM-DD` (or `''`) and `onChange` gets the new one. What was typed is
 * kept while it still reads as that value; a date changed from outside
 * replaces it. The format shows as the placeholder unless the caller gives one.
 *
 * @param props - The date, its handler, field texts and native props.
 * @returns The date input.
 */
export function DateInput({ value, onChange, ...rest }: DateInputProps) {
  const translator = useI18n();
  const { locale } = translator;
  const layout = useMemo(() => dateLayout(dateConventions(locale)), [locale]);
  const mask = useMemo(() => dateMask(layout), [layout]);
  const [draft, setDraft] = useState('');
  const { ref, value: shown, onChange: change } = useMaskedInput({
    value: cleanToShow(draft, value, layout),
    mask,
    // The hook calls only when the digits change, and different digits are
    // always a different value, so every call is a changed date.
    onChange: (clean) => {
      setDraft(clean);
      onChange(cleanToValue(clean, layout));
    },
  });
  const placeholder = datePlaceholder(layout, {
    day: translator.text('dateInput', 'day'),
    month: translator.text('dateInput', 'month'),
    year: translator.text('dateInput', 'year'),
  });

  return (
    <TextField
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      {...rest}
      ref={ref}
      value={shown}
      onChange={change}
      inputClassName="tabular-nums"
    />
  );
}
