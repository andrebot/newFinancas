import { useId } from 'react';
import FOCUS_RING from '../focusRing';

// The kit's switch (K15, OQ-180): an on/off setting that reads as a row — the
// text on the left, the switch pinned to the end, e.g. "Incentivised"
// debenture. Like the checkbox (K16), it is a visually hidden native checkbox
// inside its label, here with `role="switch"`, so the browser supplies Space,
// focus and the on/off state; the "on" look comes from `has-checked`.

/** The switch's props. */
export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** The setting's name, already translated. */
  readonly label: string;
  /** A quieter line under the label, already translated. */
  readonly description?: string | undefined;
  readonly disabled?: boolean | undefined;
}

const ROW = [
  'group flex cursor-pointer items-start justify-between gap-3 type-body',
  'has-disabled:cursor-not-allowed has-disabled:opacity-50',
].join(' ');

/** The track drawn in place of the native input; it holds the focus ring. */
export const TRACK = [
  'relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors duration-150',
  'has-checked:bg-mint',
  FOCUS_RING,
].join(' ');

/** The thumb, which slides to the end and turns dark on the mint track when on. */
export const THUMB = [
  'absolute top-0.75 left-0.75 size-4.5 rounded-full bg-muted',
  'transition-[translate,background-color] duration-150',
  'group-has-checked:translate-x-4 group-has-checked:bg-onmint',
].join(' ');

/**
 * Renders a switch with its label and an optional description. It holds no
 * state: the caller passes `checked` and gets the new value through `onChange`.
 *
 * @param props - The on/off state, change handler, texts and disabled flag.
 * @returns The switch row.
 */
export function Switch({
  checked, onChange, label, description, disabled,
}: SwitchProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <label htmlFor={id} className={ROW}>
      <span className="flex flex-col gap-0.5">
        <span id={`${id}-label`}>{label}</span>
        {description && (
          <span id={descriptionId} className="type-caption text-muted">{description}</span>
        )}
      </span>
      <span className={TRACK}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-labelledby={`${id}-label`}
          aria-describedby={descriptionId}
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" className={THUMB} />
      </span>
    </label>
  );
}
