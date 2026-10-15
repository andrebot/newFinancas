import { useState, type FormEvent } from 'react';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { Card } from '../../../../../kit/card/Card';
import { PasswordField } from '../../../../../kit/passwordField/PasswordField';
import { SectionHeader } from '../../../../../kit/sectionHeader/SectionHeader';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { strengthCaption } from '../../../../../utilities/passwordStrength';
import usePasswordStrengthEstimator from '../../../../../utilities/usePasswordStrengthEstimator';
import {
  firstError, matchesPassword, password as passwordRule, required, validateFields,
  type FieldErrors, type FieldRules,
} from '../../../../../utilities/validation';

// Password Change (Security, mockup 70): the current password, then the new
// one — with the advisory strength meter — and its confirmation. It holds
// what is typed and checks it before emitting: the current one given, the
// new one at least 12 characters (NFR-SEC-4) and repeated exactly. The meter
// never blocks a submit. The note says every other session ends (FR-1.14).

/** What the user types. */
interface PasswordChangeValues {
  readonly current: string;
  readonly password: string;
  readonly confirmation: string;
}

/** The change the form emits, as the API takes it. */
export interface PasswordChangeRequest {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/** Password Change's props. */
export interface PasswordChangeProps {
  /** The change is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** The last failure, already translated, for the banner. */
  readonly alert?: string | undefined;
  /** The server's objection to the current password, already translated. */
  readonly currentError?: string | undefined;
  /** The server's objection to the new password, already translated. */
  readonly passwordError?: string | undefined;
  /** Gets the change, once every field passes the checks. */
  readonly onSubmit: (change: PasswordChangeRequest) => void;
}

const EMPTY: PasswordChangeValues = { current: '', password: '', confirmation: '' };

/**
 * The rules for the fields: the confirmation must repeat the new password.
 *
 * @param values - What is typed.
 * @returns One rule per field.
 */
const rulesFor = (values: PasswordChangeValues): FieldRules<PasswordChangeValues> => ({
  current: required,
  password: firstError(required, passwordRule),
  confirmation: firstError(required, matchesPassword(values.password)),
});

/**
 * Renders the change-password panel: heading, banner, the three password
 * fields (the new one with the strength meter), the note and the button.
 *
 * @param props - The busy state, the failures and the submit handler.
 * @returns The panel.
 */
export function PasswordChange({
  busy, alert, currentError, passwordError, onSubmit,
}: PasswordChangeProps) {
  const translator = useI18n();
  const estimate = usePasswordStrengthEstimator();
  const [values, setValues] = useState<PasswordChangeValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<PasswordChangeValues>>({});
  const reading = estimate && values.password ? estimate(values.password) : undefined;

  /**
   * Keeps a field's new value and drops its error.
   *
   * @param field - The field typed in.
   * @returns The field's change handler.
   */
  const change = (field: keyof PasswordChangeValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /**
   * Checks the fields and emits the change when they pass, unless one is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = validateFields(values, rulesFor(values));
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit({ currentPassword: values.current, newPassword: values.password });
    }
  };

  /**
   * Translates a field's error, if it has one.
   *
   * @param field - The field.
   * @returns The message, or `undefined`.
   */
  const errorOf = (field: keyof PasswordChangeValues) => {
    const error = errors[field];
    return error && translator.field(error.code, error.params);
  };

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader title={translator.text('security', 'password.title')} />
      {alert && <InlineBanner tone="error" message={alert} />}
      <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <PasswordField
          autoComplete="current-password"
          label={translator.text('security', 'password.current')}
          revealLabel={translator.text('security', 'password.showCurrent')}
          value={values.current}
          onChange={change('current')}
          error={errorOf('current') ?? currentError}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <PasswordField
            autoComplete="new-password"
            label={translator.text('security', 'password.new')}
            revealLabel={translator.text('security', 'password.showNew')}
            value={values.password}
            onChange={change('password')}
            error={errorOf('password') ?? passwordError}
            strength={reading && { reading, caption: strengthCaption(reading, translator) }}
          />
          <PasswordField
            autoComplete="new-password"
            label={translator.text('security', 'password.confirm')}
            revealLabel={translator.text('security', 'password.showConfirm')}
            value={values.confirmation}
            onChange={change('confirmation')}
            error={errorOf('confirmation')}
          />
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <p className="type-caption text-faint">
            {translator.text('security', 'password.notice')}
          </p>
          <Button type="submit" variant="primary" busy={busy}>
            {translator.text('security', 'password.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
