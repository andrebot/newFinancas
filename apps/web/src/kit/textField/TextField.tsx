import {
  useId, type InputHTMLAttributes, type ReactNode, type Ref,
} from 'react';
import { Field, fieldAria, type FieldTexts } from '../field/Field';

// The kit's text field (K5, OQ-137): a native <input> in the kit's field frame
// (label, hint, inline error). It takes every native prop and `ref`, so a
// form sets `type`, `autoComplete`, `inputMode`, `maxLength` and so on. The
// `leading` / `trailing` slots sit inside the box: the money input's R$
// prefix (K7), the password field's show / hide button (K6), a search icon.
// The `footer` sits under the box, above the hint or error: the password
// field's strength meter. An `aria-describedby` passed in joins the message's.

/** The text field's props: the native ones plus the field texts, slots and value. */
export interface TextFieldProps
  extends FieldTexts,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'value' | 'onChange' | 'children'> {
  readonly value: string;
  /** Gets the new text; the field holds no state. */
  readonly onChange: (value: string) => void;
  /** Inside the box, before the text: a prefix or an icon. */
  readonly leading?: ReactNode | undefined;
  /** Inside the box, after the text: a suffix or a button. */
  readonly trailing?: ReactNode | undefined;
  /** Under the box, above the hint or error, e.g. the strength meter (K6). */
  readonly footer?: ReactNode | undefined;
  /** Layout only, on the whole field, e.g. `w-48`, `flex-1`. */
  readonly className?: string | undefined;
  /** Text styling only, on the input, e.g. `tabular-nums`, `font-mono text-center`. */
  readonly inputClassName?: string | undefined;
  readonly ref?: Ref<HTMLInputElement> | undefined;
}

/**
 * Builds the classes of the box drawn around the input: the border, and the
 * halo while anything in it has focus — mint, or coral while invalid.
 *
 * @param invalid - Whether the field shows an error.
 * @returns The box's classes.
 */
export const boxClasses = (invalid: boolean) => [
  'flex h-[46px] items-center gap-2 rounded-[14px] border bg-bg px-3.5',
  'transition-[border-color,box-shadow] duration-150 focus-within:ring-3',
  invalid
    ? 'border-coral focus-within:ring-coral/15'
    : 'border-line focus-within:border-mint focus-within:ring-mint/15',
  'has-disabled:cursor-not-allowed has-disabled:opacity-50',
].join(' ');

/**
 * Builds the input's classes: it fills the box and draws no border or outline
 * of its own.
 *
 * @param inputClassName - The caller's text styling, if any.
 * @returns The input's classes.
 */
export const inputClasses = (inputClassName?: string) => [
  'h-full min-w-0 flex-1 bg-transparent type-body-lg text-ink outline-none',
  'placeholder:text-faint disabled:cursor-not-allowed',
  inputClassName,
].filter(Boolean).join(' ');

/**
 * Joins the ids that describe the input: the caller's, then the message's.
 *
 * @param ids - Ids, some possibly absent.
 * @returns The space-separated ids, or `undefined` when there are none.
 */
export const joinIds = (...ids: readonly (string | undefined)[]) => (
  ids.filter(Boolean).join(' ') || undefined
);

/**
 * Renders a slot inside the box, or nothing when it is empty.
 *
 * @param props - The slot's content.
 * @returns The slot, muted, with its icons sized to the text.
 */
function Slot({ children }: { readonly children: ReactNode }) {
  if (!children) {
    return null;
  }
  return <span className="flex shrink-0 items-center text-muted [&_svg]:size-4.5">{children}</span>;
}

/**
 * Renders a labelled single-line text input with an optional hint or error.
 * It holds no state: the caller passes `value` and gets the new text through
 * `onChange`. An `id` passed in is used for the input; otherwise one is made.
 *
 * @param props - The value, change handler, field texts, slots and native props.
 * @returns The text field.
 */
export function TextField({
  value, onChange, label, labelAction, hint, error,
  leading, trailing, footer, className, inputClassName, id,
  'aria-describedby': describedBy, ...native
}: TextFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const aria = fieldAria(controlId, { hint, error });

  return (
    <Field
      controlId={controlId}
      label={label}
      labelAction={labelAction}
      hint={hint}
      error={error}
      className={className}
    >
      <div className={boxClasses(Boolean(error))}>
        <Slot>{leading}</Slot>
        <input
          type="text"
          {...native}
          {...aria}
          aria-describedby={joinIds(describedBy, aria['aria-describedby'])}
          id={controlId}
          className={inputClasses(inputClassName)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Slot>{trailing}</Slot>
      </div>
      {footer}
    </Field>
  );
}
