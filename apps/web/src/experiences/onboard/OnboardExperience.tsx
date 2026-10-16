import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toRequestOutcome } from '../../api/outcome';
import { shell } from '../../config/constants';
import { AuthLayout } from '../../kit/layouts/AuthLayout';
import { WizardLayout } from '../../kit/layouts/WizardLayout';
import { switchHousehold } from '../../shell/shellState';
import { useAppDispatch } from '../../store';
import type { RequestOutcome } from '../../utilities/requestOutcome';
import { useCreateHouseholdMutation, useRegisterUserMutation } from './api';
import { HouseholdSetupFlow } from './flows/householdSetup/HouseholdSetupFlow';
import { RegistrationFlow } from './flows/registration/RegistrationFlow';
import type { Registration } from './flows/registration/interactions/RegistrationFormEntry';
import { MfaEnrollmentStep, type PendingEnrollment } from './MfaEnrollmentStep';

// Onboard Experience (X2, EBD; OQ-158): set up a household from nothing. It
// hosts the Registration, MFA Enrollment and Household Setup Flows and is the
// only tier here that calls the backend. Each route opens one stretch of the
// journey; the server's state is the progression, so a drop-off resumes
// without anything kept here:
// - `/register` — Registration, then MFA Enrollment. The session starts once
//   the backup codes are saved; the signed-out guard takes the user on, and
//   the household gate, finding no household, back here to `/setup`. An
//   enrollment never confirmed is resumed by Sign In (OQ-157).
// - `/setup` — Household Setup, with no way out: the gate sends a user with
//   no household here.
// - `/households/new` — Household Setup for another household (OQ-81), with
//   a Cancel back to the Dashboard.
// A new household becomes the active one, then the Dashboard opens. Guided
// Setup comes in between with X2G.

/** Which stretch of the journey the page opens. */
export type OnboardEntry = 'registration' | 'household' | 'additionalHousehold';

/** The Experience's props: one per route that shows it. */
export interface OnboardExperienceProps {
  readonly entry: OnboardEntry;
}

/**
 * Registers the user, then confirms their MFA enrollment. The secret,
 * recovery codes and enrollment token the API answers stay here; the
 * Registration Flow never sees them.
 *
 * @returns The active Flow.
 */
function RegistrationJourney() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<PendingEnrollment>();
  const [registerUser] = useRegisterUserMutation();

  /**
   * Opens Sign In, carrying where it should send the user back to.
   */
  const toSignIn = () => navigate(shell.paths.signIn, { state: location.state });

  /**
   * Registers the user and, once registered, moves on to their enrollment.
   *
   * @param registration - What the user registers with.
   * @returns The Flow's outcome.
   */
  const register = async (registration: Registration): Promise<RequestOutcome> => {
    const result = await registerUser(registration);
    if (result.error === undefined) {
      const {
        enrollmentToken, otpauthUri, totpSecret, recoveryCodes,
      } = result.data;
      setPending({
        enrollmentToken,
        enrollment: {
          otpauthUri, totpSecret, recoveryCodes, accountEmail: registration.email,
        },
      });
    }
    return toRequestOutcome(result);
  };

  if (pending) {
    return <MfaEnrollmentStep pending={pending} onExpired={toSignIn} />;
  }
  return <RegistrationFlow onRegister={register} onSignIn={toSignIn} />;
}

/** The household stretch's props. */
interface HouseholdJourneyProps {
  /** Whether the user may leave without one (another household). */
  readonly cancellable: boolean;
}

/**
 * Creates a household, makes it the active one and opens the Dashboard.
 *
 * @param props - Whether there is a way out.
 * @returns The Household Setup Flow.
 */
function HouseholdJourney({ cancellable }: HouseholdJourneyProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [createHousehold] = useCreateHouseholdMutation();

  /**
   * Opens the Dashboard.
   */
  const toDashboard = () => navigate(shell.paths.dashboard);

  /**
   * Creates the household and, once created, works in it.
   *
   * @param name - The household's name.
   * @returns The Flow's outcome.
   */
  const create = async (name: string): Promise<RequestOutcome> => {
    const result = await createHousehold({ name });
    if (result.error === undefined) {
      dispatch(switchHousehold(result.data.id));
      toDashboard();
    }
    return toRequestOutcome(result);
  };

  return <HouseholdSetupFlow onCreate={create} onCancel={cancellable ? toDashboard : undefined} />;
}

/**
 * Renders the Experience's stretch of the journey on its layout: the auth
 * layout to register, the wizard's to set a household up.
 *
 * @param props - Which stretch the route opens.
 * @returns The page.
 */
export function OnboardExperience({ entry }: OnboardExperienceProps) {
  if (entry === 'registration') {
    return (
      <AuthLayout>
        <RegistrationJourney />
      </AuthLayout>
    );
  }
  return (
    <WizardLayout>
      <HouseholdJourney cancellable={entry === 'additionalHousehold'} />
    </WizardLayout>
  );
}
