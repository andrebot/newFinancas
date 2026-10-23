import { useEffect } from 'react';
import {
  Navigate, Outlet, Route, Routes, useLocation,
} from 'react-router';
import { shell } from '../config/constants';
import { Button } from '../kit/button/Button';
import { EmptyState } from '../kit/emptyState/EmptyState';
import { SkeletonRows } from '../kit/skeleton/Skeleton';
import { useAppDispatch, useAppSelector } from '../store';
import { useI18n } from '../utilities/I18nProvider';
import { AppShell } from './AppShell';
import { returnPathOf, routesFor, type ReturnState } from './routes';
import type { SourceState } from '../utilities/sourceState';
import type { ShellConfig, ShellHousehold } from './shellConfig';
import {
  selectActiveHouseholdId, selectSession, settleActiveHousehold,
} from './shellState';

// The App Shell's routes (S1, OQ-156): the routing table turned into React
// Router routes, each behind its guard. Signed-out pages send a signed-in user
// on (to where Sign In was asked for, else the Dashboard); every other page
// sends a signed-out user to Sign In, remembering where they were going. The
// household pages also wait for the user's households: none → Onboard; else
// the remembered or first one becomes active. The chrome appears once that
// household has an account in use; without one, Guided Setup opens — the
// first account is mandatory and the main navigation waits for it (FR-1.22,
// OQ-198).

/**
 * Lets only a signed-out user through. Once a session starts — Sign In or
 * Onboard started it (`startSession`) — it takes the user on.
 *
 * @returns The page, or a redirect.
 */
export function SignedOutOnly() {
  const session = useAppSelector(selectSession);
  const location = useLocation();
  if (session === 'signedIn') {
    return <Navigate to={returnPathOf(location.state)} replace />;
  }
  return <Outlet />;
}

/**
 * Lets only a signed-in user through; anyone else goes to Sign In, which
 * brings them back here.
 *
 * @returns The page, or a redirect.
 */
export function RequireSession() {
  const session = useAppSelector(selectSession);
  const location = useLocation();
  if (session === 'signedOut') {
    const state: ReturnState = { from: `${location.pathname}${location.search}` };
    return <Navigate to={shell.paths.signIn} replace state={state} />;
  }
  return <Outlet />;
}

/** Where the household gate stands; once `ready`, with the households and the active one. */
export type HouseholdGate = { readonly state: 'loading' | 'failed' | 'onboard' | 'settling' }
  | {
    readonly state: 'ready';
    readonly households: readonly ShellHousehold[];
    readonly active: ShellHousehold;
  };

/**
 * Decides what the household pages show.
 *
 * @param households - The user's households, as Manage Household reports them.
 * @param activeId - The active household's id, if one is chosen.
 * @returns `onboard` when the user has none; `settling` until one of theirs is active.
 */
export const householdGate = (
  households: SourceState<readonly ShellHousehold[]>,
  activeId: string | null,
): HouseholdGate => {
  if (households.status !== 'ready') {
    return { state: households.status };
  }
  if (households.data.length === 0) {
    return { state: 'onboard' };
  }
  const active = households.data.find((member) => member.id === activeId);
  return active
    ? { state: 'ready', households: households.data, active }
    : { state: 'settling' };
};

/**
 * Shows that the gate can't go on, with a retry.
 *
 * @param props - What failed, and how to try again.
 * @returns The failure, full-page.
 */
function GateFailure({ title, retry }: { readonly title: string; readonly retry: () => void }) {
  const translator = useI18n();
  return (
    <div className="grid min-h-screen place-items-center bg-bg text-ink">
      <EmptyState
        icon="error-outline"
        title={title}
        action={<Button onClick={retry}>{translator.text('shell', 'households.retry')}</Button>}
      />
    </div>
  );
}

/**
 * Shows that the gate is waiting for its answer.
 *
 * @param props - What it waits for.
 * @returns The skeleton, full-page.
 */
function GateLoading({ label }: { readonly label: string }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-bg px-4 pt-24 text-ink">
      <SkeletonRows label={label} />
    </div>
  );
}

/** The account gate's props: the settled households, the active one and its answer. */
interface AccountGateProps {
  readonly config: ShellConfig;
  readonly households: readonly ShellHousehold[];
  readonly active: ShellHousehold;
  /** Whether the active household has an account in use. */
  readonly accountInUse: SourceState<boolean>;
}

/**
 * Shows the chrome once the active household has an account in use;
 * without one, opens Guided Setup (FR-1.22, OQ-198), carrying the page asked
 * for so the wizard's finish can return to it.
 *
 * @param props - The shell's configuration, the settled households and the answer.
 * @returns The chrome and page, a loading or failure state, or a redirect to Guided Setup.
 */
function AccountGate({
  config, households, active, accountInUse,
}: AccountGateProps) {
  const translator = useI18n();
  const location = useLocation();
  if (accountInUse.status === 'failed') {
    return (
      <GateFailure
        title={translator.text('shell', 'household.failed')}
        retry={accountInUse.retry}
      />
    );
  }
  if (accountInUse.status === 'loading') {
    return <GateLoading label={translator.text('shell', 'household.loading')} />;
  }
  if (!accountInUse.data) {
    const state: ReturnState = { from: `${location.pathname}${location.search}` };
    return <Navigate to={shell.paths.guidedSetup} replace state={state} />;
  }
  return <AppShell config={config} households={households} active={active} />;
}

/**
 * Tells which household the account check asks about: the active one, as
 * soon as there is one — none for a setup page, which isn't gated on it.
 *
 * @param setup - Whether the page is a setup page.
 * @param activeId - The active household's id, if one is chosen.
 * @returns The household to ask about, or none.
 */
export const accountQuestionOf = (setup: boolean, activeId: string | null) => (
  setup || activeId === null ? undefined : activeId
);

/** The gate's props. */
interface HouseholdGateProps {
  readonly config: ShellConfig;
  /**
   * A setup page (Guided Setup): shown bare once a household is active,
   * without the chrome or the account check.
   */
  readonly setup?: boolean | undefined;
}

/**
 * Settles the active household, then shows a setup page as it is or leaves
 * the rest to the account gate.
 *
 * @param props - The shell's configuration, and whether the page is a setup page.
 * @returns The setup page or the account gate, a loading or failure state, or
 *   a redirect to Onboard.
 */
export function HouseholdGate({ config, setup = false }: HouseholdGateProps) {
  const translator = useI18n();
  const dispatch = useAppDispatch();
  const households = config.sources.useHouseholds();
  const activeId = useAppSelector(selectActiveHouseholdId);
  const list = households.status === 'ready' ? households.data : undefined;
  const gate = householdGate(households, activeId);
  // Asked as soon as a household is active, beside the households list rather
  // than after it, so a switch waits for one round trip, not two.
  const accountInUse = config.sources.useAccountInUse(accountQuestionOf(setup, activeId));

  useEffect(() => {
    if (list) {
      dispatch(settleActiveHousehold(list));
    }
  }, [list, dispatch]);

  if (gate.state === 'onboard') {
    return <Navigate to={shell.paths.onboard} replace />;
  }
  if (households.status === 'failed') {
    return (
      <GateFailure
        title={translator.text('shell', 'households.failed')}
        retry={households.retry}
      />
    );
  }
  if (gate.state !== 'ready') {
    return <GateLoading label={translator.text('shell', 'households.loading')} />;
  }
  if (setup) return <Outlet />;
  return (
    <AccountGate
      config={config}
      households={gate.households}
      active={gate.active}
      accountInUse={accountInUse}
    />
  );
}

/** The routes' props. */
export interface AppRoutesProps {
  readonly config: ShellConfig;
}

/**
 * Renders the page the address asks for, behind its guard. An unknown
 * address goes to the Dashboard (and so, signed out, to Sign In).
 *
 * @param props - The shell's configuration.
 * @returns The routes.
 */
export function AppRoutes({ config }: AppRoutesProps) {
  const { pages } = config;
  return (
    <Routes>
      <Route element={<SignedOutOnly />}>
        {routesFor('signedOut').map((route) => (
          <Route key={route.id} path={route.path} element={pages[route.id]} />
        ))}
      </Route>
      <Route element={<RequireSession />}>
        {routesFor('signedIn').map((route) => (
          <Route key={route.id} path={route.path} element={pages[route.id]} />
        ))}
        <Route element={<HouseholdGate config={config} setup />}>
          {routesFor('householdSetup').map((route) => (
            <Route key={route.id} path={route.path} element={pages[route.id]} />
          ))}
        </Route>
        <Route element={<HouseholdGate config={config} />}>
          {routesFor('household').map((route) => (
            <Route key={route.id} path={route.path} element={pages[route.id]} />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={shell.paths.dashboard} replace />} />
    </Routes>
  );
}
