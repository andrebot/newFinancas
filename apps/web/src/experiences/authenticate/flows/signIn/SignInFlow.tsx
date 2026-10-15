import { useState } from 'react';
import { useI18n } from '../../../../utilities/I18nProvider';
import { BackupCodeEntry } from './interactions/BackupCodeEntry';
import { CredentialEntry, type Credentials } from './interactions/CredentialEntry';
import { MfaCodeEntry } from './interactions/MfaCodeEntry';
import {
  afterCredentials, afterSecondFactor, INITIAL_SIGN_IN, submitting, switchedTo,
  type SignInOutcome, type SignInState,
} from './signInState';

export type { Credentials } from './interactions/CredentialEntry';
export type { SignInFailure, SignInOutcome } from './signInState';

// Sign In Flow (FL1, EBD; OQ-145): email and password, then the MFA code —
// or a backup code instead. It owns which step shows and what carries over
// between them; it never calls the backend. Each request goes up to the
// Authenticate Experience, which answers an outcome (and keeps the challenge
// token between the two requests). A wrong code is retried alone; an expired
// challenge or a locked address starts over from the password, email kept.

/** What the Flow asks of the Experience, and the ways out it emits. */
export interface SignInFlowProps {
  /** The password step: `ok` once a challenge is held. */
  readonly onSubmitCredentials: (credentials: Credentials) => Promise<SignInOutcome>;
  /** The authenticator code: `ok` once signed in. */
  readonly onSubmitCode: (mfaCode: string) => Promise<SignInOutcome>;
  /** A single-use backup code instead: `ok` once signed in. */
  readonly onSubmitBackupCode: (recoveryCode: string) => Promise<SignInOutcome>;
  readonly onForgotPassword: () => void;
  readonly onCreateAccount: () => void;
}

/**
 * Renders the step the sign-in is on and moves between them.
 *
 * @param props - The Experience's requests and the ways out.
 * @returns The current step's entry.
 */
export function SignInFlow({
  onSubmitCredentials, onSubmitCode, onSubmitBackupCode, onForgotPassword, onCreateAccount,
}: SignInFlowProps) {
  const translator = useI18n();
  const [state, setState] = useState<SignInState>(INITIAL_SIGN_IN);
  const { step, error, busy } = state;
  const alert = error && translator.error(error.code, error.params);

  /**
   * Sends the password step and applies its outcome.
   *
   * @param credentials - What was typed.
   */
  const submitCredentials = async (credentials: Credentials) => {
    setState(submitting);
    const outcome = await onSubmitCredentials(credentials);
    setState((current) => afterCredentials(current, credentials.email, outcome));
  };

  /**
   * Builds the submit handler of a second factor.
   *
   * @param request - The Experience's request for that factor.
   * @returns The handler, which sends the code and applies the outcome.
   */
  const secondFactor = (request: (code: string) => Promise<SignInOutcome>) => (
    async (code: string) => {
      setState(submitting);
      const outcome = await request(code);
      setState((current) => afterSecondFactor(current, outcome));
    }
  );

  if (step === 'code') {
    return (
      <MfaCodeEntry
        key={state.attempt}
        busy={busy}
        alert={alert}
        onSubmit={secondFactor(onSubmitCode)}
        onUseBackupCode={() => setState((current) => switchedTo(current, 'backupCode'))}
        onBack={() => setState((current) => switchedTo(current, 'credentials'))}
      />
    );
  }

  if (step === 'backupCode') {
    return (
      <BackupCodeEntry
        key={state.attempt}
        busy={busy}
        alert={alert}
        onSubmit={secondFactor(onSubmitBackupCode)}
        onUseApp={() => setState((current) => switchedTo(current, 'code'))}
        onBack={() => setState((current) => switchedTo(current, 'code'))}
      />
    );
  }

  return (
    <CredentialEntry
      key={state.attempt}
      defaultEmail={state.email}
      busy={busy}
      alert={alert}
      onSubmit={submitCredentials}
      onForgotPassword={onForgotPassword}
      onCreateAccount={onCreateAccount}
    />
  );
}
