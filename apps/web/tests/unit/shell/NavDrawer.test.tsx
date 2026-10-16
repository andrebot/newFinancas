import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  describe, expect, it, vi,
} from 'vitest';
import { NavDrawer, thenClose, type NavDrawerProps } from '../../../src/shell/NavDrawer';
import { I18nProvider } from '../../../src/utilities/I18nProvider';
import { fixedLocale } from '../../support/renderInLocale';
import { HOUSEHOLDS, JANE } from './shellFakes';

// The drawer (BDT: unit — it composes Interactions and emits; nothing mocked
// but its handlers). A memory router stands in for the address bar.

/**
 * Renders the drawer, open, with spies for every handler.
 *
 * @param props - Props to override.
 * @returns The spies.
 */
const renderDrawer = (props: Partial<NavDrawerProps> = {}) => {
  const spies = {
    onClose: vi.fn(),
    onSwitch: vi.fn(),
    onOpenInvitations: vi.fn(),
    onCreateHousehold: vi.fn(),
    onExportAuditLog: vi.fn(),
    onSignOut: vi.fn(),
  };
  render(
    <I18nProvider controller={fixedLocale('en-US')}>
      <MemoryRouter>
        <NavDrawer
          drawer={{
            open: true, id: 'drawer-1', menuButton: null, onClose: spies.onClose,
          }}
          identity={{ status: 'ready', data: JANE }}
          switcher={{
            households: HOUSEHOLDS,
            activeId: 'doe',
            pendingInvitationCount: 1,
            onSwitch: spies.onSwitch,
            onOpenInvitations: spies.onOpenInvitations,
            onCreateHousehold: spies.onCreateHousehold,
          }}
          canExportAuditLog
          onExportAuditLog={spies.onExportAuditLog}
          onSignOut={spies.onSignOut}
          {...props}
        />
      </MemoryRouter>
    </I18nProvider>,
  );
  return spies;
};

describe('NavDrawer', () => {
  it('draws nothing while closed', () => {
    render(
      <I18nProvider controller={fixedLocale('en-US')}>
        <NavDrawer
          drawer={{
            open: false, id: 'drawer-1', menuButton: null, onClose: vi.fn(),
          }}
          identity={{ status: 'loading' }}
          switcher={{
            households: HOUSEHOLDS,
            activeId: 'doe',
            pendingInvitationCount: 0,
            onSwitch: vi.fn(),
            onOpenInvitations: vi.fn(),
            onCreateHousehold: vi.fn(),
          }}
          canExportAuditLog={false}
          onExportAuditLog={vi.fn()}
          onSignOut={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('shows identity, switcher, main nav, records and the account foot', () => {
    renderDrawer();
    const drawer = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(drawer.id).toBe('drawer-1');
    expect(screen.getByText('Hello, Jane')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('Records')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe('/profile');
  });

  it('closes after any pick: a switch, an export, a link or signing out', () => {
    const spies = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /^Household/ }));
    fireEvent.click(screen.getByRole('button', { name: 'The Rivera Household Member' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pending invitations 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export audit log' }));
    fireEvent.click(screen.getByRole('link', { name: 'Profile' }));
    fireEvent.click(screen.getByRole('link', { name: 'Transactions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(spies.onSwitch).toHaveBeenCalledWith('rivera');
    expect(spies.onOpenInvitations).toHaveBeenCalledOnce();
    expect(spies.onCreateHousehold).toHaveBeenCalledOnce();
    expect(spies.onExportAuditLog).toHaveBeenCalledOnce();
    expect(spies.onSignOut).toHaveBeenCalledOnce();
    expect(spies.onClose).toHaveBeenCalledTimes(7);
  });

  it('closes on Esc', () => {
    const { onClose } = renderDrawer();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('hides Records from a role that may not export', () => {
    renderDrawer({ canExportAuditLog: false });
    expect(screen.queryByText('Records')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export audit log' })).toBeNull();
  });
});

describe('thenClose', () => {
  it('runs the handler with its arguments, then closes', () => {
    const calls: string[] = [];
    const wrapped = thenClose(() => calls.push('close'), (id: string) => calls.push(`pick:${id}`));
    wrapped('doe');
    expect(calls).toEqual(['pick:doe', 'close']);
  });
});
