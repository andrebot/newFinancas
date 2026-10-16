import { useRef } from 'react';
import { toRequestOutcome } from '../../api/outcome';
import { startSession } from '../../shell/shellState';
import { useAppDispatch } from '../../store';
import { useAlerts } from '../../utilities/AlertProvider';
import { useI18n } from '../../utilities/I18nProvider';
import type { RequestOutcome } from '../../utilities/requestOutcome';
import { useConfirmMfaEnrollmentMutation } from './api';
import {
  MfaEnrollmentFlow, type MfaEnrollmentSetup,
} from './flows/mfaEnrollment/MfaEnrollmentFlow';

// Onboard's MFA enrollment step (X2, OQ-158): the MFA Enrollment Flow with
// its one request answered. Onboard runs it right after registering;
// Authenticate hosts it to resume an enrollment never confirmed (OQ-157), as
// Onboard will host Account Setup's Flows. The confirmed session is held
// until the backup codes are saved, so the signed-out guard doesn't take the
// user away from them. A lapsed enrollment says so in a toast and leaves —
// only a new sign-in issues another one.

/** An enrollment to confirm: what the Flow shows, and the token that confirms it. */
export interface PendingEnrollment {
  readonly enrollment: MfaEnrollmentSetup;
  readonly enrollmentToken: string;
}

/** The step's props. */
export interface MfaEnrollmentStepProps {
  readonly pending: PendingEnrollment;
  /** The enrollment token lapsed: the host goes back to Sign In. */
  readonly onExpired: () => void;
}

// The enrollment token lapsed: only a new sign-in issues another one.
const ENROLLMENT_EXPIRED = 'auth.enrollment_expired';

/**
 * Confirms an MFA enrollment and starts the session once its backup codes
 * are saved.
 *
 * @param props - The enrollment and the way back.
 * @returns The MFA Enrollment Flow.
 */
export function MfaEnrollmentStep({ pending, onExpired }: MfaEnrollmentStepProps) {
  const dispatch = useAppDispatch();
  const alerts = useAlerts();
  const translator = useI18n();
  const [confirmMfaEnrollment] = useConfirmMfaEnrollmentMutation();
  const startHeldSession = useRef(() => {});

  /**
   * Confirms the enrollment with the app's code.
   *
   * @param mfaCode - The code the app shows.
   * @returns The Flow's outcome.
   */
  const confirm = async (mfaCode: string): Promise<RequestOutcome> => {
    const { enrollmentToken } = pending;
    const result = await confirmMfaEnrollment({ enrollmentToken, mfaCode });
    const outcome = toRequestOutcome(result);
    if (result.error === undefined) {
      const tokens = result.data;
      startHeldSession.current = () => dispatch(startSession(tokens));
    } else if (!outcome.ok && outcome.error.code === ENROLLMENT_EXPIRED) {
      alerts.error(translator.error(outcome.error.code, outcome.error.params));
      onExpired();
    }
    return outcome;
  };

  return (
    <MfaEnrollmentFlow
      enrollment={pending.enrollment}
      onConfirm={confirm}
      onComplete={() => startHeldSession.current()}
    />
  );
}
