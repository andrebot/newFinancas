import { useId } from 'react';
import { FieldMessage, messageIdOf } from '../field/Field';
import FOCUS_RING from '../focusRing';
import { Icon, type IconName } from '../icons/Icon';
import { Tag } from '../tag/Tag';

// The kit's chip group (OQ-219): pick one value out of a short list drawn as
// the mockups' wrapping `opt` chips — the record drawer's kinds, accounts,
// cards and categories (mockups 31, 32, 35), the date range presets (K10).
// Like the segmented control (K13), each chip is a visually hidden native
// radio inside its label, so the browser supplies arrow-key movement, focus
// and the radio semantics; the chosen look comes from `has-checked`. Nothing
// may be chosen yet. A list too long for chips is the caller's to switch to
// the select (K11, OQ-138).

/** One chip: its value, its translated name and what it shows besides. */
export interface Chip<Value extends string> {
  readonly value: Value;
  /** The chip's name, already translated. */
  readonly label: string;
  readonly icon?: IconName | undefined;
  /** A small tag after the name, e.g. the account's currency. */
  readonly tag?: string | undefined;
}

/** The bare chips' props: no caption, named by whatever frames them. */
export interface ChipRadiosProps<Value extends string> {
  readonly options: readonly Chip<Value>[];
  /** The chosen value; nothing is chosen while it is undefined. */
  readonly value: Value | undefined;
  readonly onChange: (value: Value) => void;
  /** The group's accessible name, when nothing on screen names it. */
  readonly label?: string | undefined;
  /** The id of the caption naming the group, e.g. its fieldset's legend. */
  readonly labelledBy?: string | undefined;
  /** The id of the message (hint or error) describing the chips. */
  readonly describedBy?: string | undefined;
  /** Marks the first chip invalid, so a refused submit can focus it. */
  readonly invalid?: boolean | undefined;
}

/** The chip group's props: the chips with their caption and message. */
export interface ChipGroupProps<Value extends string> extends Omit<
  ChipRadiosProps<Value>,
  'label' | 'labelledBy' | 'describedBy' | 'invalid'
> {
  /** The caption above the chips, already translated. */
  readonly label: string;
  /** A quieter note after the caption, e.g. "· optional". */
  readonly note?: string | undefined;
  /** Keeps the caption for screen readers only. */
  readonly labelHidden?: boolean | undefined;
  /** A line under the chips; the error takes its place. */
  readonly hint?: string | undefined;
  /** Why the choice is invalid, already translated. */
  readonly error?: string | undefined;
  /** Layout only, e.g. `w-full`. */
  readonly className?: string | undefined;
}

export const CHIP = [
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3.5',
  'type-body-sm text-ink transition-colors duration-150 hover:border-mint/40',
  'has-checked:border-mint/60 has-checked:bg-mintdeep has-checked:font-semibold',
  'has-checked:text-mint',
  FOCUS_RING,
].join(' ');

/**
 * Renders the chips alone, as a radio group. It holds no state: the caller
 * passes the chosen value and gets the new one through `onChange`. While
 * invalid, the first chip carries `aria-invalid` so a refused submit can focus it.
 *
 * @param props - The chips, the chosen value, the change handler, the group's
 *   name or its caption's id, its message's id and whether it is invalid.
 * @returns The radio group.
 */
export function ChipRadios<Value extends string>({
  options, value, onChange, label, labelledBy, describedBy, invalid,
}: ChipRadiosProps<Value>) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2"
    >
      {options.map((option, index) => (
        <label key={option.value} htmlFor={`${name}-${option.value}`} className={CHIP}>
          <input
            id={`${name}-${option.value}`}
            type="radio"
            className="sr-only"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid && index === 0 ? true : undefined}
          />
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
 * Renders the chips under their caption, in a fieldset the caption names, with
 * the hint or the error below.
 *
 * @param props - The caption, its note, the chips, the value, the handler, the
 *   message and the layout.
 * @returns The labelled chip group.
 */
export function ChipGroup<Value extends string>({
  label, note, labelHidden, hint, error, className, ...radios
}: ChipGroupProps<Value>) {
  const id = useId();
  const messageId = messageIdOf(id);
  const legendId = `${id}-legend`;

  return (
    <fieldset className={['flex min-w-0 flex-col gap-2', className].filter(Boolean).join(' ')}>
      <legend
        id={legendId}
        className={labelHidden ? 'sr-only' : 'mb-2 type-caption font-semibold text-muted'}
      >
        {label}
        {note && (
        <>
          {' '}
          <span className="font-normal">{note}</span>
        </>
        )}
      </legend>
      <ChipRadios
        {...radios}
        labelledBy={legendId}
        describedBy={hint || error ? messageId : undefined}
        invalid={error !== undefined}
      />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </fieldset>
  );
}
