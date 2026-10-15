import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { Button } from '../../../../../kit/button/Button';
import { PasswordField } from '../../../../../kit/passwordField/PasswordField';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { strengthCaption } from '../../../../../utilities/passwordStrength';
import usePasswordStrengthEstimator from '../../../../../utilities/usePasswordStrengthEstimator';
import {
  email as emailRule, firstError, matchesPassword, nonBlank, password as passwordRule, required,
  validateFields, type FieldErrors, type FieldRules,
} from '../../../../../utilities/validation';
import {
  StepAlert, StepHeading, TextAction,
} from '../../../../interactions/stepParts';
import { useRegistrationText } from './registrationText';

// Registration Form Entry (Registration, mockup 02, without its terms box —
// OQ-148): first and last name, email, password with the advisory strength
// meter, and its confirmation. It holds what is typed and checks it before
// emitting: names not blank (the API trims them), a valid email, at least 12
// characters (NFR-SEC-4) and an exact repeat. The meter rates the password
// against the name and email typed, which make a weak one.

/** What someone registers with, as the API takes it. */
export interface Registration {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly password: string;
}

/** What the user types: the registration plus the password's repeat. */
interface RegistrationValues extends Registration {
  readonly confirmation: string;
}

/** Registration Form Entry's props. */
export interface RegistrationFormEntryProps {
  /** A request is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** The server's objection to the email (already taken), translated. */
  readonly emailError?: string | undefined;
  /** The server's objection to the password, translated. */
  readonly passwordError?: string | undefined;
  /** Gets the registration (names and email trimmed), once every field passes. */
  readonly onSubmit: (registration: Registration) => void;
  readonly onSignIn: () => void;
}

const EMPTY: RegistrationValues = {
  firstName: '', lastName: '', email: '', password: '', confirmation: '',
};

/**
 * The rules for every field: the confirmation must repeat the password typed.
 *
 * @param values - What is typed.
 * @returns One rule per field.
 */
const rulesFor = (values: RegistrationValues): FieldRules<RegistrationValues> => ({
  firstName: nonBlank,
  lastName: nonBlank,
  email: firstError(nonBlank, emailRule),
  password: firstError(required, passwordRule),
  confirmation: firstError(required, matchesPassword(values.password)),
});

/**
 * Picks what is sent: names and email trimmed, the password as typed.
 *
 * @param values - What is typed.
 * @returns The registration.
 */
const toRegistration = (values: RegistrationValues): Registration => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  email: values.email.trim(),
  password: values.password,
});

/**
 * The details a password shouldn't borrow from: the names and email typed.
 *
 * @param values - What is typed.
 * @returns The filled-in details.
 */
const personalInputs = (values: RegistrationValues): string[] => (
  [values.firstName, values.lastName, values.email]
    .map((detail) => detail.trim())
    .filter((detail) => detail !== '')
);

/**
 * Renders the create-account form: heading, banner, the name pair, email,
 * the two password fields (the first with the strength meter), the submit
 * button and the way to sign in instead. Focuses the first name on mount.
 *
 * @param props - The busy state, failures and event handlers.
 * @returns The entry.
 */
export function RegistrationFormEntry({
  busy, alert, emailError, passwordError, onSubmit, onSignIn,
}: RegistrationFormEntryProps) {
  const translator = useI18n();
  const text = useRegistrationText();
  const estimate = usePasswordStrengthEstimator();
  const [values, setValues] = useState<RegistrationValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<RegistrationValues>>({});
  const firstNameRef = useRef<HTMLInputElement>(null);
  const reading = estimate && values.password
    ? estimate(values.password, personalInputs(values))
    : undefined;

  useEffect(() => {
    firstNameRef.current?.focus();
  }, []);

  /**
   * Keeps a field's new value and drops its error.
   *
   * @param field - The field typed in.
   * @returns The field's change handler.
   */
  const change = (field: keyof RegistrationValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /**
   * Checks every field and emits the registration when they pass, unless a
   * request is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = validateFields(values, rulesFor(values));
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(toRegistration(values));
  };

  /**
   * Translates a field's error, if it has one.
   *
   * @param field - The field.
   * @returns The message, or `undefined`.
   */
  const errorOf = (field: keyof RegistrationValues) => {
    const error = errors[field];
    return error && translator.field(error.code, error.params);
  };

  return (
    <>
      <StepHeading title={text('title')} subtitle={text('subtitle')} />
      <StepAlert message={alert} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              ref={firstNameRef}
              autoComplete="given-name"
              label={text('firstName')}
              value={values.firstName}
              onChange={change('firstName')}
              error={errorOf('firstName')}
            />
            <TextField
              autoComplete="family-name"
              label={text('lastName')}
              value={values.lastName}
              onChange={change('lastName')}
              error={errorOf('lastName')}
            />
          </div>
          <TextField
            type="email"
            autoComplete="email"
            label={text('email')}
            value={values.email}
            onChange={change('email')}
            error={errorOf('email') ?? emailError}
          />
          <PasswordField
            autoComplete="new-password"
            label={text('password')}
            revealLabel={text('showPassword')}
            value={values.password}
            onChange={change('password')}
            error={errorOf('password') ?? passwordError}
            strength={reading && { reading, caption: strengthCaption(reading, translator) }}
          />
          <PasswordField
            autoComplete="new-password"
            label={text('confirm')}
            revealLabel={text('showConfirm')}
            value={values.confirmation}
            onChange={change('confirmation')}
            error={errorOf('confirmation')}
          />
        </div>
        <Button type="submit" variant="primary" size="xl" elevated busy={busy}>
          {text('submit')}
        </Button>
      </form>
      <p className="text-center type-body-sm text-muted">
        {text('haveAccount')}
        {' '}
        <TextAction onClick={onSignIn} className="font-semibold">
          {text('signIn')}
        </TextAction>
      </p>
    </>
  );
}
