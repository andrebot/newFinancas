import { useId } from 'react';
import { Icon } from '../icons/Icon';
import { Tag } from '../tag/Tag';
import { CHIP, type Chip } from './ChipGroup';

// The kit's multi-pick chips (OQ-220): any number of values out of a short
// list, drawn as ChipGroup's `opt` chips — the ledger filter's kinds, accounts
// and cards, and categories (mockup 33). Each chip is a visually hidden native
// checkbox inside its label, so the browser supplies Space, focus and the
// checkbox semantics; a chosen chip shows the mockup's check before its name.
// A list too long for chips is the caller's to switch to the multi-select
// (K12) — `MultiChoiceField` does it.

/** The bare chips' props: no caption, named by whatever frames them. */
export interface ChipChecksProps<Value extends string> {
  readonly options: readonly Chip<Value>[];
  /** The chosen values. */
  readonly value: readonly Value[];
  /** Gets the new choice, in the chips' order. */
  readonly onChange: (value: readonly Value[]) => void;
  /** The group's accessible name, when nothing on screen names it. */
  readonly label?: string | undefined;
  /** The id of the caption naming the group, e.g. its fieldset's legend. */
  readonly labelledBy?: string | undefined;
}

/** The chip group's props: the chips with their caption. */
export interface ChipCheckGroupProps<Value extends string> extends Omit<
  ChipChecksProps<Value>,
  'label' | 'labelledBy'
> {
  /** The caption above the chips, already translated. */
  readonly label: string;
  /** Keeps the caption for screen readers only. */
  readonly labelHidden?: boolean | undefined;
  /** Layout only, e.g. `w-full`. */
  readonly className?: string | undefined;
}

/**
 * Ticks or unticks one chip, keeping the choice in the chips' order.
 *
 * @param options - The chips, in display order.
 * @param value - The current choice.
 * @param toggled - The chip's value.
 * @param checked - Whether it is now ticked.
 * @returns The new choice.
 */
export const toggleChip = <Value extends string>(
  options: readonly Chip<Value>[],
  value: readonly Value[],
  toggled: Value,
  checked: boolean,
): readonly Value[] => {
  const chosen = new Set(value);
  if (checked) {
    chosen.add(toggled);
  } else {
    chosen.delete(toggled);
  }
  return options.map((option) => option.value).filter((option) => chosen.has(option));
};

/**
 * Renders the chips alone, as a group of checkboxes once something names it —
 * inside a fieldset, the fieldset is the group. It holds no state: the caller
 * passes the choice and gets the new one through `onChange`.
 *
 * @param props - The chips, the choice, the change handler and the group's
 *   name or its caption's id.
 * @returns The group.
 */
export function ChipChecks<Value extends string>({
  options, value, onChange, label, labelledBy,
}: ChipChecksProps<Value>) {
  const name = useId();
  const chosen = new Set(value);

  return (
    <div
      role={label || labelledBy ? 'group' : undefined}
      aria-label={label}
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => (
        <label key={option.value} htmlFor={`${name}-${option.value}`} className={`group ${CHIP}`}>
          <input
            id={`${name}-${option.value}`}
            type="checkbox"
            className="sr-only"
            value={option.value}
            checked={chosen.has(option.value)}
            onChange={(event) => onChange(
              toggleChip(options, value, option.value, event.target.checked),
            )}
          />
          <Icon name="check" className="hidden size-3.5 group-has-checked:block" />
          {option.icon && <Icon name={option.icon} className="size-4" />}
          {option.label}
          {/* The space keeps the tag a word of its own in the chip's name. */}
          {option.tag && (
          <>
            {' '}
            <Tag size="micro">{option.tag}</Tag>
          </>
          )}
        </label>
      ))}
    </div>
  );
}

/**
 * Renders the chips under their caption, in a fieldset the caption names — the group.
 *
 * @param props - The caption, the chips, the choice, the handler and the layout.
 * @returns The labelled group.
 */
export function ChipCheckGroup<Value extends string>({
  label, labelHidden, className, ...checks
}: ChipCheckGroupProps<Value>) {
  return (
    <fieldset className={['flex min-w-0 flex-col gap-2', className].filter(Boolean).join(' ')}>
      <legend
        className={labelHidden ? 'sr-only' : 'mb-2 type-caption font-semibold text-muted'}
      >
        {label}
      </legend>
      <ChipChecks {...checks} />
    </fieldset>
  );
}
