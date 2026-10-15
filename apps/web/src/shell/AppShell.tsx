import { useId, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { household, shell } from '../config/constants';
import { useAppDispatch } from '../store';
import { AppHeader } from './interactions/AppHeader';
import { NotificationBell } from './interactions/NotificationBell';
import { NavDrawer } from './NavDrawer';
import { routeNotificationAction, type NotificationRoutes } from './notificationRouting';
import type {
  HouseholdRole, ShellConfig, ShellHousehold, ShellInbox,
} from './shellConfig';
import { switchHousehold } from './shellState';
import useSavedPreferences from './useSavedPreferences';

// The App Shell's layout (S1; EBD: a layout, not an Experience): the header,
// the nav drawer and the active page under them. It holds no journey state and
// never calls the backend: the chrome's data comes from the owning
// Experiences' hooks in the configuration, and its events go out through the
// routing table, the owning Experience's handler or the shell's own
// household switch.

// The page column, from the mockups: 1400px wide at most, gutters that grow with the screen.
const MAIN = [
  'mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6',
  'px-4 pt-6 pb-16 sm:px-6 lg:px-12 lg:pt-8',
].join(' ');

/** The layout's props. */
export interface AppShellProps {
  readonly config: ShellConfig;
  /** The user's households. */
  readonly households: readonly ShellHousehold[];
  /** The active one, which the household gate has settled. */
  readonly active: ShellHousehold;
}

/**
 * Whether a role may export the audit log (FR-7.2: Owner/Admin).
 *
 * @param role - The user's role in the active household.
 * @returns True for a manager role.
 */
export const canExportAuditLog = (role: HouseholdRole) => (
  (household.managerRoles as readonly string[]).includes(role)
);

/** The hosted bell's props. */
interface HostedBellProps {
  readonly inbox: ShellInbox;
  readonly routes: NotificationRoutes;
}

/**
 * Hosts Review Insights' inbox in the bell, routing its actions.
 *
 * @param props - The inbox and the routing table.
 * @returns The bell.
 */
function HostedBell({ inbox, routes }: HostedBellProps) {
  const unseenCount = inbox.useUnseenCount();
  return (
    <NotificationBell
      unseenCount={unseenCount}
      Panel={inbox.Panel}
      onAction={(action) => routeNotificationAction(routes, inbox.dismiss, action)}
    />
  );
}

/**
 * Renders the chrome around the active page.
 *
 * @param props - The configuration, the user's households and the active one.
 * @returns The header, the drawer and the page.
 */
export function AppShell({ config, households, active }: AppShellProps) {
  const { sources, actions, inbox } = config;
  const identity = sources.useIdentity();
  const pendingInvitationCount = sources.usePendingInvitationCount();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const drawerId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuButton, setMenuButton] = useState<HTMLButtonElement | null>(null);
  useSavedPreferences(identity, config.themeController);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <AppHeader
        menuOpen={menuOpen}
        drawerId={drawerId}
        onToggleMenu={() => setMenuOpen(!menuOpen)}
        menuButtonRef={setMenuButton}
        bell={inbox && <HostedBell inbox={inbox} routes={config.notificationRoutes} />}
      />
      <NavDrawer
        drawer={{
          open: menuOpen, id: drawerId, menuButton, onClose: () => setMenuOpen(false),
        }}
        identity={identity}
        switcher={{
          households,
          activeId: active.id,
          pendingInvitationCount,
          onSwitch: (householdId) => dispatch(switchHousehold(householdId)),
          onOpenInvitations: () => navigate(shell.paths.profile),
          onCreateHousehold: () => navigate(shell.paths.createHousehold),
        }}
        canExportAuditLog={canExportAuditLog(active.role)}
        onExportAuditLog={actions.exportAuditLog}
        onSignOut={actions.signOut}
      />
      <main className={MAIN}>
        <Outlet />
      </main>
    </div>
  );
}
