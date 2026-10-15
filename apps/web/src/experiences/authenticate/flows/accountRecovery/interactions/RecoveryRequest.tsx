import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import {
  email as emailRule, firstError, nonBlank, type FieldError,
} from '../../../../../utilities/validation';
import {
  BackButton, StepAlert, StepHeading, TextAction,
} from '../../../../interactions/stepParts';
import { useAccountRecoveryText } from './accountRecoveryText';

// Recovery Request (Account Recovery, mockup 03): the email the reset link
// goes to. It holds what is typed and checks it before emitting. Once a link
// was asked for, the inbox note shows under the button — worded so it never
// says whether an account has that address — and the form stays, to ask again.

/** Recovery Request's props. */
export interface RecoveryRequestProps {
  /** A request is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** A link was asked for: shows the inbox note. */
  readonly linkRequested: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** Gets the trimmed email, once it passes the checks. */
  readonly onSubmit: (email: string) => void;
  readonly onBackToSignIn: () => void;
}

const EMAIL_RULE = firstError(nonBlank, emailRule);

/**
 * Renders the request step: back arrow, heading, banner, the email, the
 * submit button, the inbox note once sent and the way back to sign in.
 * Focuses the email on mount.
 *
 * @param props - The busy state, whether a link was sent, failure and event handlers.
 * @returns The entry.
 */
export function RecoveryRequest({
  busy, linkRequested, alert, onSubmit, onBackToSignIn,
}: RecoveryRequestProps) {
  const translator = useI18n();
  const text = useAccountRecoveryText();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<FieldError | undefined>();
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  /**
   * Keeps the new address and drops its error.
   *
   * @param value - What is typed.
   */
  const change = (value: string) => {
    setEmail(value);
    setError(undefined);
  };

  /**
   * Checks the address and emits it when it passes, unless a request is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = EMAIL_RULE(email);
    setError(found);
    if (!found) onSubmit(email.trim());
  };

  return (
    <>
      <BackButton label={text('back')} onBack={onBackToSignIn} />
      <StepHeading
        icon="lock-reset"
        title={text('request.title')}
        subtitle={text('request.subtitle')}
      />
      <StepAlert message={alert} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <TextField
          ref={emailRef}
          type="email"
          autoComplete="username"
          label={text('request.email')}
          value={email}
          onChange={change}
          error={error && translator.field(error.code, error.params)}
        />
        <Button type="submit" variant="primary" size="xl" elevated busy={busy}>
          {text('request.submit')}
        </Button>
      </form>
      {linkRequested && (
        <InlineBanner
          tone="success"
          title={text('request.sentTitle')}
          message={text('request.sentMessage')}
        />
      )}
      <p className="text-center type-body-sm text-muted">
        {text('request.remembered')}
        {' '}
        <TextAction onClick={onBackToSignIn} className="font-semibold">
          {text('request.backToSignIn')}
        </TextAction>
      </p>
    </>
  );
}
