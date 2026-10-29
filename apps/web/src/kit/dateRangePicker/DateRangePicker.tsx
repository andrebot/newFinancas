import { useEffect, useId } from 'react';
import { useI18n } from '../../utilities/I18nProvider';
import useToday from '../../utilities/useToday';
import { DateInput } from '../dateInput/DateInput';
import FOCUS_RING from '../focusRing';
import {
  choosePreset, editDate, refreshPreset,
  type DateRangePreset, type DateRangeSide, type DateRangeValue, type RelativePreset,
} from './dateRangePresets';

// The kit's date range picker (K10, OQ-213): preset chips over a typed From
// and To, as mockups 33 (the ledger's filter) and 24 (the audit export) draw
// it — no calendar. A relative preset fills both dates, ending today; typing a
// date switches to Custom, which is always offered last. A chosen preset keeps
// ending today: past midnight its new dates are reported. The caller holds the
// value and validates it (`isoDate` on From, `dateRangeEnd(from)` on To); the
// picker only shows the errors it is given.

/** The errors under each date, already translated. */
export interface DateRangeErrors {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

/** The date range picker's props. */
export interface DateRangePickerProps {
  /** The group's name, already translated, e.g. "Date range". */
  readonly label: string;
  /** Keeps the name for screen readers only, when a dialog title already says it. */
  readonly labelHidden?: boolean | undefined;
  /** The relative presets offered, in order; Custom always follows them. */
  readonly presets: readonly RelativePreset[];
  readonly value: DateRangeValue;
  readonly onChange: (value: DateRangeValue) => void;
  readonly errors?: DateRangeErrors | undefined;
  /** Layout only, e.g. `w-full`. */
  readonly className?: string | undefined;
}

const CHIP = [
  'inline-flex h-8 cursor-pointer items-center rounded-xl border border-line px-3.5',
  'type-body-sm text-ink transition-colors duration-150 hover:border-mint/40',
  'has-checked:border-mint/60 has-checked:bg-mintdeep has-checked:font-semibold',
  'has-checked:text-mint',
  FOCUS_RING,
].join(' ');

/**
 * Renders the preset chips and the From / To dates. It holds no state: the
 * caller passes the value and gets the next one through `onChange`.
 *
 * @param props - The label, presets, value, change handler, errors and layout.
 * @returns The date range group.
 */
export function DateRangePicker({
  label, labelHidden, presets, value, onChange, errors, className,
}: DateRangePickerProps) {
  const translator = useI18n();
  const today = useToday();
  const id = useId();
  const offered: readonly DateRangePreset[] = [...presets, 'custom'];
  const edit = (side: DateRangeSide) => (date: string) => onChange(editDate(value, side, date));

  useEffect(() => {
    const refreshed = refreshPreset(value, today);
    if (refreshed !== value) onChange(refreshed);
  }, [value, today, onChange]);

  return (
    <fieldset className={['flex min-w-0 flex-col gap-2', className].filter(Boolean).join(' ')}>
      <legend
        className={labelHidden ? 'sr-only' : 'mb-2 type-caption font-semibold text-muted'}
      >
        {label}
      </legend>
      {/* The fieldset's legend names the chips and dates together; a name on
          the group too would be read twice. */}
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {offered.map((preset) => (
          <label key={preset} htmlFor={`${id}-${preset}`} className={CHIP}>
            <input
              id={`${id}-${preset}`}
              type="radio"
              className="sr-only"
              name={id}
              value={preset}
              checked={preset === value.preset}
              onChange={() => onChange(choosePreset(value, preset, today))}
            />
            {translator.text('dateRangePicker', `preset.${preset}`)}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DateInput
          label={translator.text('dateRangePicker', 'from')}
          value={value.from}
          onChange={edit('from')}
          error={errors?.from}
        />
        <DateInput
          label={translator.text('dateRangePicker', 'to')}
          value={value.to}
          onChange={edit('to')}
          error={errors?.to}
        />
      </div>
    </fieldset>
  );
}
