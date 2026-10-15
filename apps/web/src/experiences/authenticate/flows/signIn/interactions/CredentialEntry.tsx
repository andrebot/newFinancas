import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { Button } from '../../../../../kit/button/Button';
import { PasswordField } from '../../../../../kit/passwordField/PasswordField';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import {
  email as emailRule, firstError, nonBlank, required, validateFields,
  type FieldErrors, type FieldRules,
} from '../../../../../utilities/validation';
import {
  StepAlert, StepHeading, TextAction, useSignInText,
} from './stepParts';

// Credential Entry (Sign In, mockup 01): email and password, submitted
// together. It holds what is typed and checks it before emitting; the Flow
// remounts it to clear the password after a failure, keeping the email.

/** What the user signs in with. */
export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** Credential Entry's props. */
export interface CredentialEntryProps {
  /** The address to start with: the last one submitted, if any. */
  readonly defaultEmail: string;
  /** A request is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** Gets the trimmed email and the password, once both pass the checks. */
  readonly onSubmit: (credentials: Credentials) => void;
  readonly onForgotPassword: () => void;
  readonly onCreateAccount: () => void;
}

const RULES: FieldRules<Credentials> = {
  email: firstError(nonBlank, emailRule),
  password: required,
};

/**
 * Renders the password step: heading, banner, the two fields, the submit
 * button and the way to create an account. Focuses the email, or the
 * password when the email is already filled in.
 *
 * @param props - The starting email, busy state, failure and event handlers.
 * @returns The entry.
 */
export function CredentialEntry({
  defaultEmail, busy, alert, onSubmit, onForgotPassword, onCreateAccount,
}: CredentialEntryProps) {
  const translator = useI18n();
  const text = useSignInText();
  const [values, setValues] = useState<Credentials>({ email: defaultEmail, password: '' });
  const [errors, setErrors] = useState<FieldErrors<Credentials>>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (defaultEmail ? passwordRef : emailRef).current?.focus();
  }, [defaultEmail]);

  /**
   * Keeps a field's new value and drops its error.
   *
   * @param field - The field typed in.
   * @returns The field's change handler.
   */
  const change = (field: keyof Credentials) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /**
   * Checks the fields and emits them when they pass, unless a request is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = validateFields(values, RULES);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit({ email: values.email.trim(), password: values.password });
    }
  };

  /**
   * Translates a field's error, if it has one.
   *
   * @param field - The field.
   * @returns The message, or `undefined`.
   */
  const errorOf = (field: keyof Credentials) => {
    const error = errors[field];
    return error && translator.field(error.code, error.params);
  };

  return (
    <>
      <StepHeading title={text('credentials.title')} subtitle={text('credentials.subtitle')} />
      <StepAlert message={alert} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <TextField
            ref={emailRef}
            type="email"
            autoComplete="username"
            label={text('credentials.email')}
            value={values.email}
            onChange={change('email')}
            error={errorOf('email')}
          />
          <PasswordField
            ref={passwordRef}
            autoComplete="current-password"
            label={text('credentials.password')}
            labelAction={(
              <TextAction onClick={onForgotPassword} className="type-caption font-medium">
                {text('credentials.forgotPassword')}
              </TextAction>
            )}
            revealLabel={text('credentials.showPassword')}
            value={values.password}
            onChange={change('password')}
            error={errorOf('password')}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="xl"
          elevated
          trailingIcon="arrow-forward"
          busy={busy}
        >
          {text('credentials.submit')}
        </Button>
      </form>
      <p className="text-center type-body-sm text-muted">
        {text('credentials.newHere')}
        {' '}
        <TextAction onClick={onCreateAccount} className="font-semibold">
          {text('credentials.createAccount')}
        </TextAction>
      </p>
    </>
  );
}
