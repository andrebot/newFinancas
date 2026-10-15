import type { ReactNode } from 'react';

// The frame every kit form control sits in (K5, OQ-137): the label above, an
// optional action beside it (Sign in's "Forgot password?"), and one message
// below — the hint, or the error in its place while the value is invalid.
// The text field (K5) uses it, and so will the password, money, number, date
// and select inputs (K6–K11), so each draws only its own control.

/** The texts around a control, already translated. */
export interface FieldTexts {
  readonly label: string;
  /** A link or button beside the label, e.g. "Forgot password?". */
  readonly labelAction?: ReactNode | undefined;
  /** A quieter line under the control; the error takes its place. */
  readonly hint?: string | undefined;
  /** Why the value is invalid; it replaces the hint and turns the control coral. */
  readonly error?: string | undefined;
}

/** The frame's props: the texts, the id of the control it labels and the control. */
export interface FieldProps extends FieldTexts {
  /** The id of the control inside, which the label points at. */
  readonly controlId: string;
  /** Keeps the label for screen readers only, when a heading already says it (MFA code). */
  readonly labelHidden?: boolean | undefined;
  /** Layout only, e.g. `w-48`, `flex-1`. */
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/** The ARIA props a control gets from its frame's message. */
export interface FieldAria {
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': true | undefined;
}

/**
 * Builds the id of the message (hint or error) under a control.
 *
 * @param controlId - The id of the control the message describes.
 * @returns The message's id.
 */
export const messageIdOf = (controlId: string) => `${controlId}-message`;

/**
 * Builds the ARIA props that tie a control to the message under it: the
 * control is described by the hint or the error, and is invalid while there
 * is an error.
 *
 * @param controlId - The id of the control.
 * @param texts - The field's hint and error.
 * @returns The control's `aria-describedby` and `aria-invalid`.
 */
export const fieldAria = (
  controlId: string,
  { hint, error }: Pick<FieldTexts, 'hint' | 'error'>,
): FieldAria => ({
  'aria-describedby': hint || error ? messageIdOf(controlId) : undefined,
  'aria-invalid': error ? true : undefined,
});

/**
 * Renders the message under a control: the error when there is one, else the
 * hint, else nothing.
 *
 * @param props - The message's id and the field's hint and error.
 * @returns The message line, or `null` when there is neither.
 */
function FieldMessage({
  id, hint, error,
}: { readonly id: string } & Pick<FieldTexts, 'hint' | 'error'>) {
  if (error) {
    return <span id={id} className="type-caption font-medium text-coral">{error}</span>;
  }
  return hint ? <span id={id} className="type-caption text-muted">{hint}</span> : null;
}

/**
 * Renders the label above a control, with its action beside it, or the label
 * alone and only for screen readers while it is hidden.
 *
 * @param props - The control's id, the label, its action and whether it is hidden.
 * @returns The label row.
 */
function FieldLabel({
  controlId, label, labelAction, labelHidden,
}: Pick<FieldProps, 'controlId' | 'label' | 'labelAction' | 'labelHidden'>) {
  if (labelHidden) {
    return <label htmlFor={controlId} className="sr-only">{label}</label>;
  }
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={controlId} className="type-caption font-semibold text-muted">{label}</label>
      {labelAction && <span className="type-caption font-medium">{labelAction}</span>}
    </div>
  );
}

/**
 * Renders a control in its frame: the label (with its action beside it) above
 * and the hint or error below. The control itself must spread
 * `fieldAria(controlId, …)` so the message describes it.
 *
 * @param props - The control's id, the texts, the layout classes and the control.
 * @returns The labelled control.
 */
export function Field({
  controlId, label, labelAction, labelHidden, hint, error, className, children,
}: FieldProps) {
  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      <FieldLabel
        controlId={controlId}
        label={label}
        labelAction={labelAction}
        labelHidden={labelHidden}
      />
      {children}
      <FieldMessage id={messageIdOf(controlId)} hint={hint} error={error} />
    </div>
  );
}
