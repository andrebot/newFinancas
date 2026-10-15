import {
  useId, type InputHTMLAttributes, type Ref, type SyntheticEvent,
} from 'react';
import { mfa } from '../../config/constants';
import { Field, fieldAria, type FieldTexts } from '../field/Field';

// The authenticator code input (K17, OQ-139): six boxes, one per digit, as on
// MFA setup and the MFA challenge. Underneath it is ONE native input laid
// invisibly over the boxes, so the OS's one-time-code autofill, password
// managers, paste ("482 193"), backspace and screen readers ("Código, 482")
// all work as on any input. The boxes only draw its value; the next empty one
// lights up while it has focus.

/** The code input's props: the native ones plus the field texts and value. */
export interface CodeInputProps
  extends FieldTexts,
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'value' | 'onChange' | 'children' | 'type'
  > {
  /** The digits typed so far. */
  readonly value: string;
  /** Gets the new digits; the input holds no state. */
  readonly onChange: (digits: string) => void;
  /** Called with the code when its last digit is typed; the Flow may submit then. */
  readonly onComplete?: ((code: string) => void) | undefined;
  /** Keeps the label for screen readers only, when a heading already says it (MFA challenge). */
  readonly labelHidden?: boolean | undefined;
  /** Layout only, on the whole field, e.g. `w-[400px]`. */
  readonly className?: string | undefined;
  readonly ref?: Ref<HTMLInputElement> | undefined;
}

/**
 * Keeps the digits of typed or pasted text, at most a code long.
 *
 * @param text - The input's text.
 * @returns Its digits, in order.
 */
export const digitsOf = (text: string): string => text.replace(/\D/g, '').slice(0, mfa.codeLength);

/**
 * Finds the box the next digit goes in: the first empty one, or the last
 * once the code is full.
 *
 * @param filled - How many digits are typed.
 * @returns The box's position.
 */
export const activeBoxOf = (filled: number): number => Math.min(filled, mfa.codeLength - 1);

/**
 * Builds a digit box's classes: the border, and on the active box the halo
 * while the input has focus — mint, or coral while invalid.
 *
 * @param active - Whether the next digit goes in this box.
 * @param invalid - Whether the field shows an error.
 * @returns The box's classes.
 */
export const digitBoxClasses = (active: boolean, invalid: boolean) => [
  'grid h-15 min-w-0 max-w-13 flex-1 place-items-center rounded-[14px] border bg-bg',
  'type-display-sm tabular-nums text-ink transition-[border-color,box-shadow] duration-150',
  invalid ? 'border-coral' : 'border-line',
  active && 'group-focus-within:ring-3',
  active && (invalid
    ? 'group-focus-within:ring-coral/15'
    : 'group-focus-within:border-mint group-focus-within:ring-mint/15'),
].filter(Boolean).join(' ');

/**
 * Keeps the input's caret at the end of the digits. The caret is invisible,
 * so editing mid-code would change a digit the user can't see being edited.
 *
 * @param event - The input's selection change.
 */
export const keepCaretAtEnd = (event: SyntheticEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  const end = input.value.length;
  if (input.selectionStart !== end || input.selectionEnd !== end) {
    input.setSelectionRange(end, end);
  }
};

/**
 * Renders the labelled six-box authenticator code input. It holds no state:
 * the caller passes `value` and gets the new digits through `onChange`, and
 * the whole code through `onComplete` once it is full.
 *
 * @param props - The digits, change handlers, field texts and native props.
 * @returns The code input.
 */
export function CodeInput({
  value, onChange, onComplete, label, labelHidden, hint, error, className, id, ...native
}: CodeInputProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const active = activeBoxOf(value.length);

  const change = (text: string) => {
    const digits = digitsOf(text);
    if (digits === value) {
      return;
    }
    onChange(digits);
    if (digits.length === mfa.codeLength) {
      onComplete?.(digits);
    }
  };

  return (
    <Field
      controlId={controlId}
      label={label}
      labelHidden={labelHidden}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="group relative flex justify-between gap-2 has-disabled:opacity-50">
        {Array.from({ length: mfa.codeLength }, (_, position) => (
          <span
            key={position}
            aria-hidden
            className={digitBoxClasses(position === active, Boolean(error))}
          >
            {value[position]}
          </span>
        ))}
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          {...native}
          {...fieldAria(controlId, { hint, error })}
          type="text"
          id={controlId}
          className="absolute inset-0 size-full cursor-text opacity-0 disabled:cursor-not-allowed"
          value={value}
          onChange={(event) => change(event.target.value)}
          onSelect={keepCaretAtEnd}
        />
      </div>
    </Field>
  );
}
