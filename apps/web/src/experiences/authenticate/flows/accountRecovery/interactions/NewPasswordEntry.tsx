import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { Button } from '../../../../../kit/button/Button';
import { PasswordField } from '../../../../../kit/passwordField/PasswordField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { strengthCaption } from '../../../../../utilities/passwordStrength';
import usePasswordStrengthEstimator from '../../../../../utilities/usePasswordStrengthEstimator';
import {
  firstError, matchesPassword, password as passwordRule, required, validateFields,
  type FieldErrors, type FieldRules,
} from '../../../../../utilities/validation';
import { StepAlert, StepHeading } from '../../../../interactions/stepParts';
import { useAccountRecoveryText } from './accountRecoveryText';

// New Password Entry (Account Recovery, mockup 04): the new password, with
// the advisory strength meter, and its confirmation. It holds what is typed
// and checks both before emitting the password: at least 12 characters
// (NFR-SEC-4) and an exact repeat. The meter never blocks a submit; its
// estimator loads on mount, and the meter shows once it has.

/** What the user types. */
interface NewPasswordValues {
  readonly password: string;
  readonly confirmation: string;
}

/** New Password Entry's props. */
export interface NewPasswordEntryProps {
  /** A request is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** The server's objection to the password, already translated. */
  readonly passwordError?: string | undefined;
  /** Gets the new password, once both fields pass the checks. */
  readonly onSubmit: (password: string) => void;
}

/**
 * The rules for both fields: the confirmation must repeat the password typed.
 *
 * @param values - What is typed.
 * @returns One rule per field.
 */
const rulesFor = (values: NewPasswordValues): FieldRules<NewPasswordValues> => ({
  password: firstError(required, passwordRule),
  confirmation: firstError(required, matchesPassword(values.password)),
});

/**
 * Renders the new-password step: heading, banner, the two password fields
 * (the first with the strength meter), the submit button and the note that
 * every session ends. Focuses the new password on mount.
 *
 * @param props - The busy state, failures and the submit handler.
 * @returns The entry.
 */
export function NewPasswordEntry({
  busy, alert, passwordError, onSubmit,
}: NewPasswordEntryProps) {
  const translator = useI18n();
  const text = useAccountRecoveryText();
  const estimate = usePasswordStrengthEstimator();
  const [values, setValues] = useState<NewPasswordValues>({ password: '', confirmation: '' });
  const [errors, setErrors] = useState<FieldErrors<NewPasswordValues>>({});
  const passwordRef = useRef<HTMLInputElement>(null);
  const reading = estimate && values.password ? estimate(values.password) : undefined;

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  /**
   * Keeps a field's new value and drops its error.
   *
   * @param field - The field typed in.
   * @returns The field's change handler.
   */
  const change = (field: keyof NewPasswordValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /**
   * Checks both fields and emits the password when they pass, unless a
   * request is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = validateFields(values, rulesFor(values));
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values.password);
  };

  /**
   * Translates a field's error, if it has one.
   *
   * @param field - The field.
   * @returns The message, or `undefined`.
   */
  const errorOf = (field: keyof NewPasswordValues) => {
    const error = errors[field];
    return error && translator.field(error.code, error.params);
  };

  return (
    <>
      <StepHeading
        icon="password"
        title={text('newPassword.title')}
        subtitle={text('newPassword.subtitle')}
      />
      <StepAlert message={alert} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <PasswordField
            ref={passwordRef}
            autoComplete="new-password"
            label={text('newPassword.password')}
            revealLabel={text('newPassword.showPassword')}
            value={values.password}
            onChange={change('password')}
            error={errorOf('password') ?? passwordError}
            strength={reading && { reading, caption: strengthCaption(reading, translator) }}
          />
          <PasswordField
            autoComplete="new-password"
            label={text('newPassword.confirm')}
            revealLabel={text('newPassword.showConfirm')}
            value={values.confirmation}
            onChange={change('confirmation')}
            error={errorOf('confirmation')}
          />
        </div>
        <Button type="submit" variant="primary" size="xl" elevated busy={busy}>
          {text('newPassword.submit')}
        </Button>
      </form>
      <p className="text-center type-caption text-muted">{text('newPassword.signOutNotice')}</p>
    </>
  );
}
