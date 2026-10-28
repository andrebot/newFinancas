import {
  FloatingFocusManager, FloatingOverlay, FloatingPortal, useDismiss, useFloating, useInteractions,
} from '@floating-ui/react';
import { Link } from 'react-router';
import { shell } from '../config/constants';
import { Icon } from '../kit/icons/Icon';
import { useI18n } from '../utilities/I18nProvider';
import { DrawerIdentity } from './interactions/DrawerIdentity';
import { HouseholdSwitcher, type HouseholdSwitcherProps } from './interactions/HouseholdSwitcher';
import { MainNav } from './interactions/MainNav';
import type { SourceState } from '../utilities/sourceState';
import type { ShellIdentity } from './shellConfig';

// The App Shell's nav drawer (S1, mockup 21): it slides over the page from
// the left, under the header, at every width — identity, household switcher,
// main nav, Records (Export audit log, Owner/Admin only) and, at the foot,
// Profile and Sign out. Esc, a click on the scrim or following any link closes
// it, and focus goes back to the menu button. On a narrow phone it leaves a
// strip of the page showing so it still reads as a drawer.

/** The drawer's open state and what it hangs off. */
export interface DrawerState {
  readonly open: boolean;
  /** The panel's element id, which the menu button controls. */
  readonly id: string;
  /** The header's menu button: clicks on it aren't "outside", and focus returns to it. */
  readonly menuButton: HTMLElement | null;
  readonly onClose: () => void;
}

/** The drawer's props. */
export interface NavDrawerProps {
  readonly drawer: DrawerState;
  readonly identity: SourceState<ShellIdentity>;
  /** The switcher's data and handlers; picking anything there also closes the drawer. */
  readonly switcher: HouseholdSwitcherProps;
  /** Whether the user may export the audit log (Owner/Admin of the active household). */
  readonly canExportAuditLog: boolean;
  readonly onExportAuditLog: () => void;
  readonly onSignOut: () => void;
}

const FOCUS = 'outline-none focus-visible:outline-2 focus-visible:outline-mint';

const FOOT_BUTTON = [
  'flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-line',
  'type-body-sm hover:bg-ink/5',
  FOCUS,
].join(' ');

const RECORDS_BUTTON = [
  'flex h-11 items-center gap-3 rounded-full px-3 text-left',
  'type-body-sm font-medium text-muted hover:bg-ink/5',
  FOCUS,
].join(' ');

const PANEL = [
  'fixed top-16 bottom-0 left-0 z-30 flex w-[min(312px,calc(100vw-48px))] flex-col',
  'border-r border-line bg-card',
].join(' ');

/**
 * Wraps a handler so the drawer closes after it runs.
 *
 * @param close - Closes the drawer.
 * @param handler - What the pick does.
 * @returns The wrapped handler.
 */
export const thenClose = <Args extends unknown[]>(
  close: () => void,
  handler: (...args: Args) => void,
) => (...args: Args) => {
  handler(...args);
  close();
};

/** The Records section's props. */
interface RecordsProps {
  readonly onExportAuditLog: () => void;
}

/**
 * Renders the Records section: Export audit log.
 *
 * @param props - The export handler.
 * @returns The section.
 */
function Records({ onExportAuditLog }: RecordsProps) {
  const translator = useI18n();
  return (
    <>
      <div className="mx-2 h-px bg-line" />
      <div className="flex flex-col gap-0.5">
        <span className="px-3 pb-1 type-caption font-semibold tracking-wider text-muted uppercase">
          {translator.text('shell', 'records.title')}
        </span>
        <button type="button" className={RECORDS_BUTTON} onClick={onExportAuditLog}>
          <Icon name="download" className="size-5 shrink-0" />
          {translator.text('shell', 'records.exportAuditLog')}
        </button>
      </div>
    </>
  );
}

/**
 * Renders the drawer while it is open.
 *
 * @param props - The drawer, the identity, the switcher and the account handlers.
 * @returns The scrim and the panel in a portal, or nothing while closed.
 */
export function NavDrawer({
  drawer, identity, switcher, canExportAuditLog, onExportAuditLog, onSignOut,
}: NavDrawerProps) {
  const translator = useI18n();
  const { onClose } = drawer;
  const { refs: { setFloating }, context } = useFloating({
    open: drawer.open,
    // Only `useDismiss` changes it from here, and only ever to closed.
    onOpenChange: onClose,
    elements: { reference: drawer.menuButton },
  });
  // No dialog role: the panel is the page's navigation landmark, and it doesn't trap focus.
  const { getFloatingProps } = useInteractions([useDismiss(context)]);

  if (!drawer.open) {
    return null;
  }

  return (
    <FloatingPortal>
      <FloatingOverlay lockScroll className="top-16 z-20 bg-scrim" />
      <FloatingFocusManager context={context} modal={false}>
        <nav
          ref={setFloating}
          id={drawer.id}
          aria-label={translator.text('shell', 'drawer.label')}
          className={PANEL}
          {...getFloatingProps()}
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <DrawerIdentity identity={identity} />
            <HouseholdSwitcher
              {...switcher}
              onSwitch={thenClose(onClose, switcher.onSwitch)}
              onOpenInvitations={thenClose(onClose, switcher.onOpenInvitations)}
              onCreateHousehold={thenClose(onClose, switcher.onCreateHousehold)}
            />
            <MainNav onNavigate={onClose} />
            {canExportAuditLog && (
              <Records onExportAuditLog={thenClose(onClose, onExportAuditLog)} />
            )}
          </div>
          <div className="flex gap-2 border-t border-line p-4">
            <Link to={shell.paths.profile} className={FOOT_BUTTON} onClick={onClose}>
              <Icon name="person-outline" className="size-4.5" />
              {translator.text('shell', 'account.profile')}
            </Link>
            <button
              type="button"
              className={`${FOOT_BUTTON} text-muted`}
              onClick={thenClose(onClose, onSignOut)}
            >
              <Icon name="logout" className="size-4.5" />
              {translator.text('shell', 'account.signOut')}
            </button>
          </div>
        </nav>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}
