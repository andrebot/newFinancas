import { useState } from 'react';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import type { Translator } from '../../../../utilities/i18n';
import {
  afterRegister, initialRegistration, submitting, type RegistrationState,
} from './registrationState';
import { RegistrationFormEntry, type Registration } from './interactions/RegistrationFormEntry';

// Registration Flow (FL3, EBD; OQ-148): create an account (FR-1.1). One
// form, one request: it never calls the backend — the registration goes up to
// the Onboard Experience, which answers an outcome and, on `ok`, moves on to
// MFA Enrollment with the secret and recovery codes it received. The Flow
// owns the busy flag and the last failure, placing each failure under the
// field it concerns or in the banner.

/** What the Flow asks of the Experience, and the way out it emits. */
export interface RegistrationFlowProps {
  /** Creates the account: `ok` once it exists and the Experience has moved on. */
  readonly onRegister: (registration: Registration) => Promise<RequestOutcome>;
  readonly onSignIn: () => void;
}

/** Where a failure shows: under a field, or in the banner. */
type FailureSlot = 'emailError' | 'passwordError' | 'alert';

// The server's objections to a single field, shown under it.
const FIELD_BY_CODE: Readonly<Record<string, FailureSlot>> = {
  'user.email_taken': 'emailError',
  'password.too_short': 'passwordError',
};

/**
 * Splits the last failure between the field it concerns and the banner.
 *
 * @param error - The last failure, if any.
 * @param translator - The current locale's translator.
 * @returns The translated message, keyed by where it shows.
 */
const placeFailure = (
  error: RequestFailure | undefined,
  translator: Translator,
): Partial<Record<FailureSlot, string>> => {
  if (!error) return {};

  return { [FIELD_BY_CODE[error.code] ?? 'alert']: translator.error(error.code, error.params) };
};

/**
 * Renders the create-account form and sends what it emits.
 *
 * @param props - The Experience's request and the way out.
 * @returns The form.
 */
export function RegistrationFlow({ onRegister, onSignIn }: RegistrationFlowProps) {
  const translator = useI18n();
  const [state, setState] = useState<RegistrationState>(initialRegistration);
  const { emailError, passwordError, alert } = placeFailure(state.error, translator);

  /**
   * Sends the registration and applies the outcome.
   *
   * @param registration - What the form emitted.
   */
  const register = async (registration: Registration) => {
    setState(submitting);
    const outcome = await onRegister(registration);
    setState((current) => afterRegister(current, outcome));
  };

  return (
    <RegistrationFormEntry
      busy={state.busy}
      alert={alert}
      emailError={emailError}
      passwordError={passwordError}
      onSubmit={register}
      onSignIn={onSignIn}
    />
  );
}
