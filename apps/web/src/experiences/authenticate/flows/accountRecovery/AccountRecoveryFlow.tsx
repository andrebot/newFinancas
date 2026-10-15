import { useState } from 'react';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import type { Translator } from '../../../../utilities/i18n';
import {
  afterConfirm, afterRequest, initialAccountRecovery, submitting, type AccountRecoveryState,
} from './accountRecoveryState';
import { NewPasswordEntry } from './interactions/NewPasswordEntry';
import { RecoveryRequest } from './interactions/RecoveryRequest';
import { ResetComplete } from './interactions/ResetComplete';

// Account Recovery Flow (FL2, EBD; OQ-147): a forgotten password, reset by
// email (FR-1.13). Without a token it asks for the link; opened from the link
// (the Experience reads `/reset-password?token=…` and passes the token) it
// takes the new password, then says it's done. It owns the step and the last
// failure; it never calls the backend — each request goes up to the
// Authenticate Experience, which answers an outcome. A dead link sends the
// user back to ask for a new one.

/** What the Flow asks of the Experience, and the way out it emits. */
export interface AccountRecoveryFlowProps {
  /** The reset token from the emailed link, read once on mount; absent when asking for one. */
  readonly token?: string | undefined;
  /** Asks for a reset link: `ok` whether or not an account has the address. */
  readonly onRequestReset: (email: string) => Promise<RequestOutcome>;
  /** Resets the password with the link's token: `ok` once it's changed. */
  readonly onConfirmReset: (token: string, newPassword: string) => Promise<RequestOutcome>;
  readonly onBackToSignIn: () => void;
}

// The server's objection to the password itself: shown under the field.
const PASSWORD_CODE = 'password.too_short';

/**
 * Splits the last failure between the field it concerns and the banner.
 *
 * @param error - The last failure, if any.
 * @param translator - The current locale's translator.
 * @returns The translated password error and banner message.
 */
const placeFailure = (error: RequestFailure | undefined, translator: Translator) => {
  const message = error && translator.error(error.code, error.params);

  return error?.code === PASSWORD_CODE
    ? { passwordError: message, alert: undefined }
    : { passwordError: undefined, alert: message };
};

/**
 * Renders the step the recovery is on and moves between them.
 *
 * @param props - The token, the Experience's requests and the way out.
 * @returns The current step.
 */
export function AccountRecoveryFlow({
  token, onRequestReset, onConfirmReset, onBackToSignIn,
}: AccountRecoveryFlowProps) {
  const translator = useI18n();
  const [state, setState] = useState<AccountRecoveryState>(() => initialAccountRecovery(token));
  const { step, busy } = state;
  const { passwordError, alert } = placeFailure(state.error, translator);

  /**
   * Asks for a reset link and applies the outcome.
   *
   * @param email - The address to send it to.
   */
  const requestReset = async (email: string) => {
    setState(submitting);
    const outcome = await onRequestReset(email);
    setState((current) => afterRequest(current, outcome));
  };

  /**
   * Sends the new password with the link's token and applies the outcome.
   *
   * @param newPassword - The password chosen.
   */
  const confirmReset = async (newPassword: string) => {
    setState(submitting);
    const outcome = await onConfirmReset(state.token, newPassword);
    setState((current) => afterConfirm(current, outcome));
  };

  if (step === 'done') return <ResetComplete onSignIn={onBackToSignIn} />;

  if (step === 'newPassword') {
    return (
      <NewPasswordEntry
        busy={busy}
        alert={alert}
        passwordError={passwordError}
        onSubmit={confirmReset}
      />
    );
  }

  return (
    <RecoveryRequest
      busy={busy}
      linkRequested={state.linkRequested}
      alert={alert}
      onSubmit={requestReset}
      onBackToSignIn={onBackToSignIn}
    />
  );
}
