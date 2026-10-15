import { useState } from 'react';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestOutcome } from '../../../../utilities/requestOutcome';
import { BackupCodesAcknowledgement } from './interactions/BackupCodesAcknowledgement';
import { MfaMethodSelection } from './interactions/MfaMethodSelection';
import { MfaSetupVerification } from './interactions/MfaSetupVerification';
import {
  afterConfirm, backToMethod, INITIAL_MFA_ENROLLMENT, methodChosen, submitting,
  type MfaEnrollmentState,
} from './mfaEnrollmentState';

// MFA Enrollment Flow (FL4, EBD; OQ-149): set up the authenticator app —
// mandatory, no skip (FR-1.15). Choose the method, scan the QR code and
// confirm with a live code, then acknowledge the backup codes. It never calls
// the backend: the enrollment (from registration, or from signing in to an
// unconfirmed account) comes down from the Onboard Experience, and the
// confirmation goes up as `onConfirm`, answering an outcome. Once confirmed
// the user is signed in; `onComplete` hands back to the Experience.

/** The enrollment the Experience received from the API, to show once. */
export interface MfaEnrollmentSetup {
  /** The `otpauth://` URI the QR code encodes. */
  readonly otpauthUri: string;
  /** The base32 secret, for entering the key by hand. */
  readonly totpSecret: string;
  readonly recoveryCodes: readonly string[];
  /** The account being enrolled, as the authenticator app will show it. */
  readonly accountEmail: string;
}

/** What the Flow asks of the Experience, and the way out it emits. */
export interface MfaEnrollmentFlowProps {
  readonly enrollment: MfaEnrollmentSetup;
  /** Confirms the enrollment with the app's code: `ok` once confirmed (and signed in). */
  readonly onConfirm: (code: string) => Promise<RequestOutcome>;
  /** The backup codes are saved: the enrollment is done. */
  readonly onComplete: () => void;
}

/**
 * Renders the step the enrollment is on and moves between them.
 *
 * @param props - The enrollment, the Experience's request and the way out.
 * @returns The current step's Interaction.
 */
export function MfaEnrollmentFlow({ enrollment, onConfirm, onComplete }: MfaEnrollmentFlowProps) {
  const translator = useI18n();
  const [state, setState] = useState<MfaEnrollmentState>(INITIAL_MFA_ENROLLMENT);
  const { step, error } = state;

  /**
   * Sends the code and applies the outcome.
   *
   * @param code - The six digits.
   */
  const confirm = async (code: string) => {
    setState(submitting);
    const outcome = await onConfirm(code);
    setState((current) => afterConfirm(current, outcome));
  };

  if (step === 'setup') {
    return (
      <MfaSetupVerification
        key={state.attempt}
        otpauthUri={enrollment.otpauthUri}
        totpSecret={enrollment.totpSecret}
        accountEmail={enrollment.accountEmail}
        busy={state.busy}
        alert={error && translator.error(error.code, error.params)}
        onSubmit={confirm}
        onBack={() => setState(backToMethod)}
      />
    );
  }

  if (step === 'codes') {
    return (
      <BackupCodesAcknowledgement
        recoveryCodes={enrollment.recoveryCodes}
        accountEmail={enrollment.accountEmail}
        onAcknowledge={onComplete}
      />
    );
  }

  return (
    <MfaMethodSelection
      defaultMethod={state.method}
      onChoose={(method) => setState((current) => methodChosen(current, method))}
    />
  );
}
