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
import type { ShellConfig, ShellHousehold, SourceState } from './shellConfig';
import {
  selectActiveHouseholdId, selectSession, settleActiveHousehold,
} from './shellState';

// The App Shell's routes (S1, OQ-156): the routing table turned into React
// Router routes, each behind its guard. Signed-out pages send a signed-in user
// on (to where Sign In was asked for, else the Dashboard); every other page
// sends a signed-out user to Sign In, remembering where they were going. The
// household pages also wait for the user's households: none → Onboard; else
// the remembered or first one becomes active and the chrome appears.

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

/** The gate's props. */
interface HouseholdGateProps {
  readonly config: ShellConfig;
}

/**
 * Shows the household pages inside the chrome once a household is active.
 *
 * @param props - The shell's configuration.
 * @returns The chrome and page, a loading or failure state, or a redirect to Onboard.
 */
export function HouseholdGate({ config }: HouseholdGateProps) {
  const translator = useI18n();
  const dispatch = useAppDispatch();
  const households = config.sources.useHouseholds();
  const activeId = useAppSelector(selectActiveHouseholdId);
  const list = households.status === 'ready' ? households.data : undefined;
  const gate = householdGate(households, activeId);

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
      <div className="grid min-h-screen place-items-center bg-bg text-ink">
        <EmptyState
          icon="error-outline"
          title={translator.text('shell', 'households.failed')}
          action={(
            <Button onClick={households.retry}>
              {translator.text('shell', 'households.retry')}
            </Button>
          )}
        />
      </div>
    );
  }
  if (gate.state !== 'ready') {
    return (
      <div className="mx-auto min-h-screen w-full max-w-md bg-bg px-4 pt-24 text-ink">
        <SkeletonRows label={translator.text('shell', 'households.loading')} />
      </div>
    );
  }
  return <AppShell config={config} households={gate.households} active={gate.active} />;
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
