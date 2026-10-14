import { useId, type ReactNode } from 'react';
import FOCUS_RING from '../focusRing';
import { Icon } from '../icons/Icon';

// The kit's checkbox (K16, OQ-130): a yes/no choice with its text — the terms
// agreement, "I've saved these codes", the rows of a multi-select. Like the
// segmented control (K13), it is a visually hidden native checkbox inside its
// label, so the browser supplies Space, focus and the checkbox semantics; the
// ticked look comes from `has-checked`, not from JavaScript.

/** The checkbox's props. */
export interface CheckboxProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /**
   * The text beside the box, already translated. It may hold links (e.g. to
   * the Terms); clicking a link follows it without toggling the box.
   */
  readonly label: ReactNode;
  /** A quieter line under the label, already translated. */
  readonly description?: string | undefined;
  /** Why the box is invalid, already translated; it turns the box coral. */
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
}

const ROW = [
  'group flex cursor-pointer items-start gap-2 type-body',
  'has-disabled:cursor-not-allowed has-disabled:opacity-50',
].join(' ');

/**
 * Builds the classes of the box drawn in place of the native checkbox.
 *
 * @param invalid - Whether the box shows the error colour while unticked.
 * @returns The box's classes.
 */
export const boxClasses = (invalid: boolean) => [
  'relative mt-px grid size-4.5 shrink-0 place-items-center rounded-md border-[1.5px]',
  invalid ? 'border-coral' : 'border-faint group-hover:border-muted',
  'text-onmint transition-colors duration-150',
  'has-checked:border-mint has-checked:bg-mint group-hover:has-checked:border-mint',
  FOCUS_RING,
].join(' ');

/**
 * Joins the ids of the texts that describe the checkbox, skipping absent ones.
 *
 * @param ids - The candidate ids, `undefined` where a text is absent.
 * @returns The ids separated by spaces, or `undefined` when there are none.
 */
export const joinIds = (...ids: readonly (string | undefined)[]) => {
  const present = ids.filter((id) => id !== undefined);
  return present.length > 0 ? present.join(' ') : undefined;
};

/**
 * Renders a checkbox with its label, an optional description and an optional
 * error message. It holds no state: the caller passes `checked` and gets the
 * new value through `onChange`.
 *
 * @param props - The checked state, change handler, texts and disabled flag.
 * @returns The checkbox row, with the error message under it when present.
 */
export function Checkbox({
  checked, onChange, label, description, error, disabled,
}: CheckboxProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={ROW}>
        <span className={boxClasses(errorId !== undefined)}>
          <input
            id={id}
            type="checkbox"
            aria-labelledby={`${id}-label`}
            aria-describedby={joinIds(descriptionId, errorId)}
            aria-invalid={errorId ? true : undefined}
            className="sr-only"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <Icon name="check" className="invisible size-3.5 group-has-checked:visible" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span id={`${id}-label`}>{label}</span>
          {description && (
            <span id={descriptionId} className="type-caption text-muted">{description}</span>
          )}
        </span>
      </label>
      {error && (
        <span id={errorId} className="ml-6.5 type-caption font-medium text-coral">{error}</span>
      )}
    </div>
  );
}
