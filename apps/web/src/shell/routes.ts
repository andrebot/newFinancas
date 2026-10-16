import type { Catalog } from '@financas/i18n';
import { shell } from '../config/constants';
import type { IconName } from '../kit/icons/Icon';

// The App Shell's routing table (S1, OQ-156): every page, who may open it and
// whether the main nav lists it. It is configuration — a new page is one entry
// here plus the element the composition root (`App.tsx`) gives its id. The
// main nav is built from the same table, so a link can't point at a page that
// doesn't exist.

/** Every page the app has. */
export type RouteId = keyof typeof shell.paths;

/**
 * Who may open a page:
 * - `signedOut` — only without a session (Sign In, Registration, recovery);
 *   a signed-in user goes to the Dashboard;
 * - `signedIn` — a session, no household needed and no chrome (Onboard);
 * - `household` — a session and an active household, inside the shell's chrome.
 */
export type RouteAccess = 'signedOut' | 'signedIn' | 'household';

/** A main-nav label in the catalog's `shell` section. */
export type NavLabelKey = Extract<keyof Catalog['shell'], `nav.${string}`>;

/** How the main nav lists a page. */
export interface NavLook {
  readonly icon: IconName;
  readonly label: NavLabelKey;
}

/** One page. */
export interface RouteEntry {
  readonly id: RouteId;
  readonly path: string;
  readonly access: RouteAccess;
  /** How the main nav lists it; pages without one aren't in the main nav. */
  readonly nav?: NavLook | undefined;
}

/** The routing table, in main-nav order for the pages it lists. */
export const ROUTES: readonly RouteEntry[] = [
  { id: 'signIn', path: shell.paths.signIn, access: 'signedOut' },
  { id: 'register', path: shell.paths.register, access: 'signedOut' },
  { id: 'forgotPassword', path: shell.paths.forgotPassword, access: 'signedOut' },
  { id: 'resetPassword', path: shell.paths.resetPassword, access: 'signedOut' },
  { id: 'onboard', path: shell.paths.onboard, access: 'signedIn' },
  { id: 'createHousehold', path: shell.paths.createHousehold, access: 'signedIn' },
  {
    id: 'dashboard',
    path: shell.paths.dashboard,
    access: 'household',
    nav: { icon: 'space-dashboard-outline', label: 'nav.dashboard' },
  },
  {
    id: 'transactions',
    path: shell.paths.transactions,
    access: 'household',
    nav: { icon: 'receipt-long-outline', label: 'nav.transactions' },
  },
  {
    id: 'accountSetup',
    path: shell.paths.accountSetup,
    access: 'household',
    nav: { icon: 'account-balance-wallet-outline', label: 'nav.accountSetup' },
  },
  {
    id: 'investments',
    path: shell.paths.investments,
    access: 'household',
    nav: { icon: 'trending-up', label: 'nav.investments' },
  },
  {
    id: 'household',
    path: shell.paths.household,
    access: 'household',
    nav: { icon: 'group-outline', label: 'nav.household' },
  },
  { id: 'profile', path: shell.paths.profile, access: 'household' },
];

/** A main-nav entry: a page with its look in the nav. */
export interface NavEntry extends RouteEntry {
  readonly nav: NavLook;
}

/**
 * Whether a page is listed in the main nav.
 *
 * @param route - The page.
 * @returns True when it has a nav look.
 */
const isNavEntry = (route: RouteEntry): route is NavEntry => route.nav !== undefined;

/** The main nav's entries, in order. */
export const MAIN_NAV: readonly NavEntry[] = ROUTES.filter(isNavEntry);

/**
 * Lists the pages one access level allows.
 *
 * @param access - The access level.
 * @returns Its pages, in table order.
 */
export const routesFor = (access: RouteAccess) => ROUTES.filter((route) => route.access === access);

/** Where Sign In sends the user back to, carried in the navigation's state. */
export interface ReturnState {
  readonly from: string;
}

/**
 * Reads where to go after signing in, from a navigation's state.
 *
 * @param state - The navigation's state (`useLocation().state`); anything.
 * @returns The page that sent the user to Sign In, or the Dashboard. Only a
 *   path on this site is followed (`//host` would leave it).
 */
export const returnPathOf = (state: unknown): string => {
  const from = (state as Partial<ReturnState> | null)?.from;
  const onSite = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//');
  return onSite ? from : shell.paths.dashboard;
};
