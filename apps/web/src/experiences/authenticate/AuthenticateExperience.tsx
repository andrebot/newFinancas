import type { LoginResponse } from '@financas/api-types';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { toRequestOutcome, type EndpointResult } from '../../api/outcome';
import { shell } from '../../config/constants';
import { AuthLayout } from '../../kit/layouts/AuthLayout';
import { startSession } from '../../shell/shellState';
import { useAppDispatch } from '../../store';
import { useAlerts } from '../../utilities/AlertProvider';
import { useI18n } from '../../utilities/I18nProvider';
import type { RequestOutcome } from '../../utilities/requestOutcome';
import {
  MfaEnrollmentFlow, type MfaEnrollmentSetup,
} from '../onboard/flows/mfaEnrollment/MfaEnrollmentFlow';
import {
  useConfirmMfaEnrollmentMutation,
  useConfirmPasswordResetMutation,
  useLoginMutation,
  useRecoverWithMfaCodeMutation,
  useRequestPasswordResetMutation,
  useVerifyMfaMutation,
} from './api';
import { AccountRecoveryFlow } from './flows/accountRecovery/AccountRecoveryFlow';
import { SignInFlow, type Credentials, type SignInFlowProps } from './flows/signIn/SignInFlow';

// Authenticate Experience (X1, EBD; OQ-157): the entry gate. It hosts the
// Sign In and Account Recovery Flows on the auth layout and is the only tier
// here that calls the backend. It owns which Flow is active and what lives
// between their requests — the sign-in challenge token, an MFA enrollment to
// resume — none of which ever reaches a Flow. Once it holds a session's
// tokens it starts the session; the App Shell's signed-out guard then takes
// the user on (to where Sign In was asked for, else the Dashboard).
//
// The right password for an account whose MFA was never confirmed answers an
// enrollment instead of a challenge (OQ-149). Authenticate then hosts
// Onboard's MFA Enrollment Flow, as Onboard hosts Account Setup's Flows: the
// session starts only once the backup codes are saved, so the guard doesn't
// take the user away from them. A user with no household goes on to Onboard
// through the shell's household gate.

/** Which journey the page opens: Sign In, or the forgotten-password one. */
export type AuthenticateEntry = 'signIn' | 'recovery';

/** The Experience's props: one per route that shows it. */
export interface AuthenticateExperienceProps {
  readonly entry: AuthenticateEntry;
}

/** The sign-in journey's active Flow; an enrollment carries what it resumes. */
export type SignInView = { readonly flow: 'signIn' } | {
  readonly flow: 'enrollment';
  readonly enrollment: MfaEnrollmentSetup;
  readonly enrollmentToken: string;
};

const SIGN_IN: SignInView = { flow: 'signIn' };

// The enrollment token lapsed: only a new sign-in issues another one.
const ENROLLMENT_EXPIRED = 'auth.enrollment_expired';

/**
 * Moves between the Experience's pages, carrying where Sign In should send
 * the user back to.
 *
 * @returns A function that opens a page by path.
 */
const useAuthNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (path: string) => {
    navigate(path, { state: location.state });
  };
};

/**
 * Builds the Sign In Flow's requests: the password step keeps the challenge
 * (or hands an enrollment over), and either second factor starts the session.
 *
 * @param onEnroll - Shows the enrollment to resume.
 * @returns The Flow's three requests.
 */
const useSignInRequests = (
  onEnroll: (view: SignInView) => void,
): Pick<SignInFlowProps, 'onSubmitCredentials' | 'onSubmitCode' | 'onSubmitBackupCode'> => {
  const dispatch = useAppDispatch();
  const challengeToken = useRef('');
  const [login] = useLoginMutation();
  const [verifyMfa] = useVerifyMfaMutation();
  const [recoverWithMfaCode] = useRecoverWithMfaCodeMutation();

  /**
   * Starts the session when a second factor was accepted.
   *
   * @param result - The second factor's result.
   * @returns The Flow's outcome.
   */
  const opened = (result: EndpointResult<Parameters<typeof startSession>[0]>) => {
    if (result.error === undefined) dispatch(startSession(result.data));
    return toRequestOutcome(result);
  };

  /**
   * Keeps what the password step answered: the challenge for the second
   * factor, or the enrollment to resume.
   *
   * @param answer - The password step's answer.
   * @param accountEmail - The address signed in with.
   */
  const hold = (answer: LoginResponse, accountEmail: string) => {
    if (answer.step === 'mfa') {
      challengeToken.current = answer.challengeToken;
      return;
    }
    const {
      enrollmentToken, otpauthUri, totpSecret, recoveryCodes,
    } = answer;
    onEnroll({
      flow: 'enrollment',
      enrollmentToken,
      enrollment: {
        otpauthUri, totpSecret, recoveryCodes, accountEmail,
      },
    });
  };

  return {
    onSubmitCredentials: async (credentials: Credentials) => {
      const result = await login(credentials);
      if (result.error === undefined) hold(result.data, credentials.email);
      return toRequestOutcome(result);
    },
    onSubmitCode: async (mfaCode) => opened(
      await verifyMfa({ challengeToken: challengeToken.current, mfaCode }),
    ),
    onSubmitBackupCode: async (recoveryCode) => opened(
      await recoverWithMfaCode({ challengeToken: challengeToken.current, recoveryCode }),
    ),
  };
};

/** The resumed enrollment's props. */
interface EnrollmentJourneyProps {
  readonly view: Extract<SignInView, { flow: 'enrollment' }>;
  /** The enrollment token lapsed: back to Sign In. */
  readonly onExpired: () => void;
}

/**
 * Resumes an unconfirmed MFA enrollment. The confirmed session is held until
 * the backup codes are saved; a lapsed enrollment says so in a toast and goes
 * back to Sign In, whose password step issues a fresh one.
 *
 * @param props - The enrollment and the way back.
 * @returns The MFA Enrollment Flow.
 */
function EnrollmentJourney({ view, onExpired }: EnrollmentJourneyProps) {
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
    const result = await confirmMfaEnrollment({ enrollmentToken: view.enrollmentToken, mfaCode });
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
      enrollment={view.enrollment}
      onConfirm={confirm}
      onComplete={() => startHeldSession.current()}
    />
  );
}

/**
 * The sign-in journey: Sign In, or a resumed enrollment.
 *
 * @returns The active Flow.
 */
function SignInJourney() {
  const [view, setView] = useState<SignInView>(SIGN_IN);
  const goTo = useAuthNavigation();
  const requests = useSignInRequests(setView);

  if (view.flow === 'enrollment') {
    return <EnrollmentJourney view={view} onExpired={() => setView(SIGN_IN)} />;
  }
  return (
    <SignInFlow
      {...requests}
      onForgotPassword={() => goTo(shell.paths.forgotPassword)}
      onCreateAccount={() => goTo(shell.paths.register)}
    />
  );
}

/**
 * The forgotten-password journey. Opened from the emailed link, it reads the
 * reset token once and takes it out of the address bar, so it doesn't stay
 * in the history; the Flow keeps it from then on.
 *
 * @returns The Account Recovery Flow.
 */
function RecoveryJourney() {
  const goTo = useAuthNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token') ?? undefined);
  const [requestPasswordReset] = useRequestPasswordResetMutation();
  const [confirmPasswordReset] = useConfirmPasswordResetMutation();

  useEffect(() => {
    if (searchParams.has('token')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <AccountRecoveryFlow
      token={token}
      onRequestReset={async (email) => toRequestOutcome(await requestPasswordReset({ email }))}
      onConfirmReset={async (resetToken, newPassword) => toRequestOutcome(
        await confirmPasswordReset({ token: resetToken, newPassword }),
      )}
      onBackToSignIn={() => goTo(shell.paths.signIn)}
    />
  );
}

/**
 * Renders the Experience's journey on the auth layout.
 *
 * @param props - Which journey the route opens.
 * @returns The page.
 */
export function AuthenticateExperience({ entry }: AuthenticateExperienceProps) {
  return (
    <AuthLayout>
      {entry === 'recovery' ? <RecoveryJourney /> : <SignInJourney />}
    </AuthLayout>
  );
}
