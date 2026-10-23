import {
  act, fireEvent, screen, waitFor,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import backendApi from '../../../src/api/backendApi';
import { sessionEnded } from '../../../src/api/baseQuery';
import { accountQuestionOf, AppRoutes, householdGate } from '../../../src/shell/AppRoutes';
import { canExportAuditLog } from '../../../src/shell/AppShell';
import type { InboxPanelProps, ShellConfig } from '../../../src/shell/shellConfig';
import {
  householdChosen, selectActiveHouseholdId, sessionStarted,
} from '../../../src/shell/shellState';
import type { AppStore } from '../../../src/store';
import { fixedLocale } from '../../support/renderInLocale';
import {
  fakeConfig, fakeStore, HOUSEHOLDS, JANE, renderWithShell, RIVERA,
} from './shellFakes';

// The App Shell (BDT: integration, the Experiences it routes to mocked). The
// store, router, kit and translator are real; each page is a stand-in heading,
// each chrome data source and handler a stand-in from the configuration.

/** The address the router is at. */
const location = () => screen.getByTestId('location');

/**
 * Renders the routes on a store, at an address.
 *
 * @param config - The shell's configuration.
 * @param store - The store.
 * @param path - The starting address.
 * @param state - The navigation's state.
 * @returns The render result.
 */
const renderRoutes = (config: ShellConfig, store: AppStore, path: string, state?: unknown) => (
  renderWithShell(<AppRoutes config={config} />, store, { path, state })
);

/**
 * A store signed in from before.
 *
 * @param rememberedHousehold - The remembered active household.
 * @returns The store and its fakes.
 */
const signedIn = (rememberedHousehold?: string) => fakeStore({
  refreshToken: 'refresh-1', rememberedHousehold,
});

/** Opens the drawer. */
const openDrawer = () => fireEvent.click(
  screen.getByRole('button', { name: 'Open navigation menu' }),
);

describe('AppRoutes — session guards', () => {
  it('sends a signed-out user to Sign In, remembering where they were going', () => {
    renderRoutes(fakeConfig(), fakeStore().store, '/transactions?holdingId=h1');

    expect(screen.getByRole('heading', { name: 'page:signIn' })).toBeTruthy();
    expect(JSON.parse(location().dataset.state ?? 'null')).toEqual({
      from: '/transactions?holdingId=h1',
    });
  });

  it('shows signed-out pages to a signed-out user', () => {
    renderRoutes(fakeConfig(), fakeStore().store, '/reset-password?token=abc');
    expect(screen.getByRole('heading', { name: 'page:resetPassword' })).toBeTruthy();
    expect(location().textContent).toBe('/reset-password?token=abc');
  });

  it('takes the user where they were going once Sign In starts the session', () => {
    const { store } = fakeStore();
    renderRoutes(fakeConfig(), store, '/sign-in', { from: '/investments' });

    act(() => {
      store.dispatch(sessionStarted());
    });

    expect(screen.getByRole('heading', { name: 'page:investments' })).toBeTruthy();
  });

  it('sends a signed-in user away from signed-out pages, to the Dashboard by default', () => {
    renderRoutes(fakeConfig(), signedIn().store, '/register');
    expect(screen.getByRole('heading', { name: 'page:dashboard' })).toBeTruthy();
  });

  it('shows Onboard without the chrome', () => {
    renderRoutes(fakeConfig(), signedIn().store, '/households/new');
    expect(screen.getByRole('heading', { name: 'page:createHousehold' })).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('goes back to Sign In when the session ends', () => {
    const { store } = signedIn();
    renderRoutes(fakeConfig(), store, '/household');

    act(() => {
      store.dispatch(sessionEnded());
    });

    expect(screen.getByRole('heading', { name: 'page:signIn' })).toBeTruthy();
  });

  it('sends an unknown address to the Dashboard', () => {
    renderRoutes(fakeConfig(), signedIn().store, '/nowhere');
    expect(location().textContent).toBe('/');
  });
});

describe('AppRoutes — household gate', () => {
  it('waits for the households, announcing it', () => {
    const config = fakeConfig({
      sources: { ...fakeConfig().sources, useHouseholds: () => ({ status: 'loading' }) },
    });
    renderRoutes(config, signedIn().store, '/');
    expect(screen.getByRole('status', { name: 'Loading your households' })).toBeTruthy();
  });

  it('offers a retry when the households fail to load', () => {
    const retry = vi.fn();
    const config = fakeConfig({
      sources: { ...fakeConfig().sources, useHouseholds: () => ({ status: 'failed', retry }) },
    });
    renderRoutes(config, signedIn().store, '/');

    expect(screen.getByText("Couldn't load your households.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('sends a user with no household to Onboard', () => {
    const empty: never[] = [];
    const config = fakeConfig({
      sources: { ...fakeConfig().sources, useHouseholds: () => ({ status: 'ready', data: empty }) },
    });
    renderRoutes(config, signedIn().store, '/');
    expect(screen.getByRole('heading', { name: 'page:onboard' })).toBeTruthy();
  });

  it('returns to the remembered household and shows the page inside the chrome', async () => {
    const { store } = signedIn('rivera');
    renderRoutes(fakeConfig(), store, '/transactions');

    expect(await screen.findByRole('heading', { name: 'page:transactions' })).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(selectActiveHouseholdId(store.getState())).toBe('rivera');
  });

  it('asks about the active household, waiting for its answer (OQ-198)', async () => {
    const useAccountInUse = vi.fn(() => ({ status: 'loading' }) as const);
    const config = fakeConfig({ sources: { ...fakeConfig().sources, useAccountInUse } });
    renderRoutes(config, signedIn('rivera').store, '/');

    expect(await screen.findByRole('status', { name: 'Loading your household' })).toBeTruthy();
    expect(useAccountInUse).toHaveBeenLastCalledWith('rivera');
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('asks beside the households list once a household is active, not after it', () => {
    const useAccountInUse = vi.fn(() => ({ status: 'loading' }) as const);
    const config = fakeConfig({
      sources: {
        ...fakeConfig().sources, useHouseholds: () => ({ status: 'loading' }), useAccountInUse,
      },
    });
    const { store } = signedIn();
    store.dispatch(householdChosen('doe'));
    renderRoutes(config, store, '/');

    expect(screen.getByRole('status', { name: 'Loading your households' })).toBeTruthy();
    expect(useAccountInUse).toHaveBeenLastCalledWith('doe');
  });

  it('offers a retry when that answer fails', async () => {
    const retry = vi.fn();
    const config = fakeConfig({
      sources: {
        ...fakeConfig().sources, useAccountInUse: () => ({ status: 'failed', retry }),
      },
    });
    renderRoutes(config, signedIn().store, '/');

    expect(await screen.findByText("Couldn't load this household.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('opens Guided Setup, without the chrome, for a household with no account in use', async () => {
    const config = fakeConfig({
      sources: {
        ...fakeConfig().sources, useAccountInUse: () => ({ status: 'ready', data: false }),
      },
    });
    renderRoutes(config, signedIn().store, '/transactions');

    expect(await screen.findByRole('heading', { name: 'page:guidedSetup' })).toBeTruthy();
    expect(location().textContent).toBe('/setup/guided');
    expect(JSON.parse(location().dataset.state ?? 'null')).toEqual({ from: '/transactions' });
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('shows Guided Setup in the settled household, whether or not it has an account', async () => {
    const { store } = signedIn('rivera');
    const useAccountInUse = vi.fn(() => ({ status: 'ready', data: false }) as const);
    renderRoutes(
      fakeConfig({ sources: { ...fakeConfig().sources, useAccountInUse } }),
      store,
      '/setup/guided',
    );

    expect(await screen.findByRole('heading', { name: 'page:guidedSetup' })).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(selectActiveHouseholdId(store.getState())).toBe('rivera');
    expect(useAccountInUse).not.toHaveBeenCalledWith('rivera');
  });

  it('asks about no household for a setup page, or before one is active', () => {
    expect(accountQuestionOf(true, 'doe')).toBeUndefined();
    expect(accountQuestionOf(false, null)).toBeUndefined();
    expect(accountQuestionOf(false, 'doe')).toBe('doe');
  });

  it('sends a user with no household from Guided Setup to Onboard', () => {
    const empty: never[] = [];
    const config = fakeConfig({
      sources: { ...fakeConfig().sources, useHouseholds: () => ({ status: 'ready', data: empty }) },
    });
    renderRoutes(config, signedIn().store, '/setup/guided');
    expect(screen.getByRole('heading', { name: 'page:onboard' })).toBeTruthy();
  });

  it('decides each state from the households and the active one', () => {
    expect(householdGate({ status: 'loading' }, null)).toEqual({ state: 'loading' });
    expect(householdGate({ status: 'failed', retry: vi.fn() }, null)).toEqual({ state: 'failed' });
    expect(householdGate({ status: 'ready', data: [] }, null)).toEqual({ state: 'onboard' });
    expect(householdGate({ status: 'ready', data: HOUSEHOLDS }, 'gone')).toEqual({
      state: 'settling',
    });
    expect(householdGate({ status: 'ready', data: HOUSEHOLDS }, 'rivera')).toEqual({
      state: 'ready', households: HOUSEHOLDS, active: RIVERA,
    });
  });
});

describe('AppShell — chrome', () => {
  it('switches households from the drawer and every Experience fetches again', async () => {
    const { store } = signedIn('doe');
    const reset = vi.spyOn(backendApi.util, 'resetApiState');
    renderRoutes(fakeConfig(), store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });

    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /^Household/ }));
    fireEvent.click(screen.getByRole('button', { name: `${RIVERA.name} Member` }));

    expect(selectActiveHouseholdId(store.getState())).toBe('rivera');
    expect(reset).toHaveBeenCalled();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull();
    reset.mockRestore();
  });

  it('starts Onboard in signed-in mode from Create household', async () => {
    renderRoutes(fakeConfig(), signedIn().store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });

    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /^Household/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }));

    expect(screen.getByRole('heading', { name: 'page:createHousehold' })).toBeTruthy();
  });

  it('takes pending invitations to Manage Profile', async () => {
    const config = fakeConfig({
      sources: { ...fakeConfig().sources, usePendingInvitationCount: () => 1 },
    });
    renderRoutes(config, signedIn().store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });

    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /^Household/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pending invitations 1' }));

    expect(screen.getByRole('heading', { name: 'page:profile' })).toBeTruthy();
  });

  it('hands Sign out and the audit export to their Experiences', async () => {
    const config = fakeConfig();
    renderRoutes(config, signedIn('doe').store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });

    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Export audit log' }));
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(config.actions.exportAuditLog).toHaveBeenCalledOnce();
    expect(config.actions.signOut).toHaveBeenCalledOnce();
  });

  it('offers the audit export only to an Owner or Admin of the active household', async () => {
    const { store } = signedIn('rivera');
    renderRoutes(fakeConfig(), store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });

    openDrawer();

    expect(screen.queryByRole('button', { name: 'Export audit log' })).toBeNull();
    expect(canExportAuditLog('Admin')).toBe(true);
    expect(canExportAuditLog('Viewer')).toBe(false);
  });

  it("applies the user's saved theme and language once the profile loads", async () => {
    const config = fakeConfig({
      sources: {
        ...fakeConfig().sources,
        useIdentity: () => ({
          status: 'ready', data: { ...JANE, theme: 'light', language: 'pt-BR' },
        }),
      },
    });
    const localeController = { ...fixedLocale('en-US'), apply: vi.fn() };
    renderWithShell(<AppRoutes config={config} />, signedIn().store, { localeController });

    await waitFor(() => expect(config.themeController.apply).toHaveBeenCalledWith('light'));
    expect(localeController.apply).toHaveBeenCalledWith('pt-BR');
  });

  it('applies nothing while the profile loads', async () => {
    const config = fakeConfig({
      sources: { ...fakeConfig().sources, useIdentity: () => ({ status: 'loading' }) },
    });
    renderRoutes(config, signedIn().store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });
    expect(config.themeController.apply).not.toHaveBeenCalled();
  });
});

describe('AppShell — notification routing', () => {
  /**
   * A stand-in inbox: one notification of each kind the routing table knows, and one it doesn't.
   *
   * @param props - What the bell hands the panel.
   * @returns The stand-in.
   */
  function FakeInbox({ onAction }: InboxPanelProps) {
    const emit = (type: string, action: string) => () => onAction({
      notificationId: `n-${type}`, type, action, params: { id: 'x-1' },
    });
    return (
      <div>
        <button type="button" onClick={emit('invitation.received', 'accept')}>Accept</button>
        <button type="button" onClick={emit('holding.matured', 'archive')}>Archive</button>
        <button type="button" onClick={emit('budget.exceeded', 'open')}>Unknown</button>
      </div>
    );
  }

  it('hosts the inbox in the bell and routes each action to its owner', async () => {
    const respondToInvitation = vi.fn(async () => 'done' as const);
    const archiveMaturedHolding = vi.fn(async () => 'failed' as const);
    const dismiss = vi.fn(async () => {});
    const config = fakeConfig({
      inbox: { useUnseenCount: () => 2, Panel: FakeInbox, dismiss },
      notificationRoutes: {
        'invitation.received': respondToInvitation,
        'holding.matured': archiveMaturedHolding,
      },
    });
    renderRoutes(config, signedIn().store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });

    fireEvent.click(screen.getByRole('button', { name: 'Notifications 2 unseen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unknown' }));

    await waitFor(() => expect(dismiss).toHaveBeenCalledWith('n-invitation.received'));
    expect(respondToInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: 'x-1' } }),
    );
    expect(archiveMaturedHolding).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it('has no bell until an inbox is configured', async () => {
    renderRoutes(fakeConfig(), signedIn().store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });
    expect(screen.queryByRole('button', { name: /^Notifications/ })).toBeNull();
  });
});

describe('AppShell — active household', () => {
  it('reads the chosen household from the store', async () => {
    const { store } = signedIn();
    store.dispatch(householdChosen('rivera'));
    renderRoutes(fakeConfig(), store, '/');
    await screen.findByRole('heading', { name: 'page:dashboard' });

    openDrawer();
    expect(screen.getByRole('button', { name: 'Household The Rivera Household' })).toBeTruthy();
  });
});
