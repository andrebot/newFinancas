import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useActiveHousehold } from '../../shell/activeHousehold';
import { toRequestOutcome } from '../../api/outcome';
import { guidedSetup, shell } from '../../config/constants';
import { Button } from '../../kit/button/Button';
import { EmptyState } from '../../kit/emptyState/EmptyState';
import { AuthLayout } from '../../kit/layouts/AuthLayout';
import { WizardLayout } from '../../kit/layouts/WizardLayout';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import { returnPathOf } from '../../shell/routes';
import type { ShellHousehold } from '../../shell/shellConfig';
import { switchHousehold } from '../../shell/shellState';
import { useAppDispatch } from '../../store';
import { useI18n, useLocaleController } from '../../utilities/I18nProvider';
import type { RequestOutcome } from '../../utilities/requestOutcome';
import { CategoryManagementFlow } from '../accountSetup/flows/categoryManagement/CategoryManagementFlow';
import { useAccountRequests, useBudgets, useCategories } from '../setupRequests';
import { useCreateHouseholdMutation, useRegisterUserMutation } from './api';
import { GuidedSetupFlow } from './flows/guidedSetup/GuidedSetupFlow';
import type { SetupTab } from '../accountSetup/AccountSetupExperience';
import type { SetupDestination } from './flows/guidedSetup/guidedSetupState';
import { HouseholdSetupFlow } from './flows/householdSetup/HouseholdSetupFlow';
import { RegistrationFlow } from './flows/registration/RegistrationFlow';
import type { Registration } from './flows/registration/interactions/RegistrationFormEntry';
import { MfaEnrollmentStep, type PendingEnrollment } from './MfaEnrollmentStep';

// Onboard Experience (X2, EBD; OQ-158): set up a household from nothing. It
// hosts the Registration, MFA Enrollment, Household Setup and Guided Setup
// Flows — and, for Guided Setup's categories step, Account Setup's Category
// Management Flow — and is the only tier here that calls the backend. Each
// route opens one stretch of the
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
// - `/setup/guided` — Guided Setup (X2G, OQ-198) in the active household: the
//   first account (mandatory), the categories, a budget, then the summary's
//   next step. A new household opens it, as the active one. The household gate
//   opens it too for a household with no account in use, so a drop-off
//   resumes here, and the main navigation waits for that first account
//   (FR-1.22). Its requests are the ones Account Setup answers
//   (`experiences/setupRequests.ts`).

/** Which stretch of the journey the page opens. */
export type OnboardEntry = 'registration' | 'household' | 'additionalHousehold' | 'guidedSetup';

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
  const localeController = useLocaleController();

  /**
   * Opens Sign In, carrying where it should send the user back to.
   */
  const toSignIn = () => navigate(shell.paths.signIn, { state: location.state });

  /**
   * Registers the user and, once registered, moves on to their enrollment.
   * The account starts in the language the user registered in (OQ-161).
   *
   * @param registration - What the user registers with.
   * @returns The Flow's outcome.
   */
  const register = async (registration: Registration): Promise<RequestOutcome> => {
    const result = await registerUser({ ...registration, language: localeController.current() });
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
 * Creates a household, makes it the active one and opens its Guided Setup.
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
   * Creates the household and, once created, works in it. Guided Setup
   * replaces this page in the history, so Back can't create another.
   *
   * @param name - The household's name.
   * @returns The Flow's outcome.
   */
  const create = async (name: string): Promise<RequestOutcome> => {
    const result = await createHousehold({ name });
    if (result.error === undefined) {
      dispatch(switchHousehold(result.data.id));
      navigate(shell.paths.guidedSetup, { replace: true });
    }
    return toRequestOutcome(result);
  };

  return <HouseholdSetupFlow onCreate={create} onCancel={cancellable ? toDashboard : undefined} />;
}

/** A next step's page, and the section it opens (an Account Setup tab). */
interface SetupDestinationPath {
  readonly path: string;
  readonly tab?: SetupTab | undefined;
}

// Typed here, so a renamed tab breaks the build rather than the link.
const DESTINATIONS: Readonly<Record<SetupDestination, SetupDestinationPath>> = (
  guidedSetup.destinations
);

/**
 * Builds the address a next step leads to. The Dashboard returns instead to
 * the page the household gate held back, if any (OQ-198).
 *
 * @param destination - The step picked.
 * @param state - The navigation's state, which may name that page.
 * @returns The address.
 */
export const destinationPathOf = (destination: SetupDestination, state: unknown): string => {
  if (destination === 'dashboard') return returnPathOf(state);
  const { path, tab } = DESTINATIONS[destination];
  return tab === undefined ? path : `${path}?${new URLSearchParams({ [shell.tabParam]: tab })}`;
};

/** Guided Setup's props: the household it sets up and who sets it up. */
interface GuidedSetupHostProps {
  readonly household: ShellHousehold;
  readonly userId: string;
}

/**
 * Answers Guided Setup's requests for one household — the accounts, the
 * categories and the budgets, as Account Setup does — and hands it the
 * Category Management Flow for its categories step.
 *
 * @param props - The household and the signed-in user.
 * @returns The Guided Setup Flow.
 */
function GuidedSetupHost({ household, userId }: GuidedSetupHostProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const accounts = useAccountRequests(household.id);
  const categories = useCategories(household.id);
  const budgets = useBudgets(household.id);

  return (
    <GuidedSetupFlow
      householdName={household.name}
      selfUserId={userId}
      role={household.role}
      onLoadAccounts={accounts.onLoad}
      onCreateAccount={accounts.onCreate}
      categories={categories.categories}
      onRetryCategories={categories.onRetry}
      categoryManagement={<CategoryManagementFlow role={household.role} {...categories} />}
      budgets={budgets.budgets}
      onRetryBudgets={budgets.onRetry}
      onCreateBudget={budgets.onCreate}
      onEditBudget={budgets.onEdit}
      // The wizard is done: Back from where it leads mustn't reopen it.
      onFinish={(destination) => navigate(
        destinationPathOf(destination, location.state),
        { replace: true },
      )}
    />
  );
}

/**
 * Sets up the active household once it and the user are known: a skeleton
 * until then, a retry if the user can't be loaded. Keyed on the household.
 *
 * @returns Guided Setup, or its wait.
 */
function GuidedSetupJourney() {
  const translator = useI18n();
  const active = useActiveHousehold();

  if (active.status === 'ready') {
    const { household, userId } = active.data;
    return <GuidedSetupHost key={household.id} household={household} userId={userId} />;
  }
  return (
    <WizardLayout>
      {active.status === 'failed' ? (
        <EmptyState
          icon="error-outline"
          title={translator.text('guidedSetup', 'failed')}
          action={<Button onClick={active.retry}>{translator.text('guidedSetup', 'retry')}</Button>}
        />
      ) : <SkeletonRows label={translator.text('guidedSetup', 'loading')} />}
    </WizardLayout>
  );
}

/**
 * Renders the Experience's stretch of the journey on its layout: the auth
 * layout to register, the wizard's to set a household up — Guided Setup lays
 * out its own steps.
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
  if (entry === 'guidedSetup') return <GuidedSetupJourney />;
  return (
    <WizardLayout>
      <HouseholdJourney cancellable={entry === 'additionalHousehold'} />
    </WizardLayout>
  );
}
