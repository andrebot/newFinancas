import { screen } from '@testing-library/react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import App, { shellConfigFor } from '../../src/App';
import { AuthenticateExperience } from '../../src/experiences/authenticate/AuthenticateExperience';
import { useHouseholds } from '../../src/experiences/manageHousehold/api';
import {
  ManageHouseholdExperience,
} from '../../src/experiences/manageHousehold/ManageHouseholdExperience';
import { ManageProfileExperience } from '../../src/experiences/manageProfile/ManageProfileExperience';
import {
  useIdentity, usePendingInvitationCount,
} from '../../src/experiences/manageProfile/shellSources';
import { OnboardExperience } from '../../src/experiences/onboard/OnboardExperience';
import { ComingSoon } from '../../src/placeholders';
import { selectSession } from '../../src/shell/shellState';
import { AlertProvider } from '../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../src/utilities/alerts';
import { createTranslator } from '../../src/utilities/i18n';
import { renderInLocale } from '../support/renderInLocale';
import { jsonResponse } from './api/fakes';
import { fakeStore } from './shell/shellFakes';

// The composition root (BDT: wiring → unit over the real store with fake
// surroundings). The router is the browser's, on jsdom's address bar.

const themeController = { apply: vi.fn(), restore: vi.fn() };

const feedback = {
  alerts: {
    success: vi.fn(() => 1),
    info: vi.fn(() => 1),
    warning: vi.fn(() => 1),
    error: vi.fn(() => 1),
    dismiss: vi.fn(),
  },
  translator: createTranslator('en-US'),
};

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('routes a signed-out visitor to Sign In', () => {
    renderInLocale(
      <AlertProvider queue={createAlertQueue(3)}>
        <App store={fakeStore().store} themeController={themeController} />
      </AlertProvider>,
    );

    expect(window.location.pathname).toBe('/sign-in');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy();
  });
});

describe('shellConfigFor', () => {
  it('configures every page, the chrome’s data and the page theme controller', () => {
    const { store } = fakeStore();
    const config = shellConfigFor(store, themeController, feedback);

    expect(Object.keys(config.pages)).toHaveLength(12);
    expect(config.themeController).toBe(themeController);
    expect(config.sources).toEqual({ useIdentity, useHouseholds, usePendingInvitationCount });
    expect(Object.keys(config.notificationRoutes)).toEqual(['invitation.received']);
    expect(config.inbox).toBeUndefined();
    expect(config.pages.profile).toEqual(<ManageProfileExperience />);
    expect(config.pages.household).toEqual(<ManageHouseholdExperience />);
    expect(config.pages.dashboard).toEqual(<ComingSoon key="dashboard" />);
    expect(config.pages.signIn).toEqual(<AuthenticateExperience entry="signIn" />);
    expect(config.pages.forgotPassword).toEqual(<AuthenticateExperience entry="recovery" />);
    expect(config.pages.resetPassword).toEqual(<AuthenticateExperience entry="recovery" />);
    expect(config.pages.register).toEqual(<OnboardExperience entry="registration" />);
    expect(config.pages.onboard).toEqual(<OnboardExperience entry="household" />);
    expect(config.pages.createHousehold).toEqual(
      <OnboardExperience entry="additionalHousehold" />,
    );
  });

  it('signs out through Authenticate: the server first, then this browser', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(204));
    const { store, tokenStorage } = fakeStore({ refreshToken: 'refresh-1', fetchFn });
    const config = shellConfigFor(store, themeController, feedback);

    config.actions.signOut();
    config.actions.exportAuditLog();

    await vi.waitFor(() => expect(selectSession(store.getState())).toBe('signedOut'));
    const request = fetchFn.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe('/api/v1/auth/logout');
    expect(tokenStorage.value).toBeNull();
  });

  it('routes an invitation notification to Manage Profile', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(200));
    const { store } = fakeStore({ refreshToken: 'refresh-1', fetchFn });
    const route = shellConfigFor(store, themeController, feedback)
      .notificationRoutes['invitation.received'];

    const outcome = await route?.({
      notificationId: 'note-1',
      type: 'invitation.received',
      action: 'decline',
      params: { invitationId: 'inv-1' },
    });

    expect(outcome).toBe('done');
    const request = fetchFn.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe('/api/v1/invitations/inv-1/decline');
    expect(feedback.alerts.success).toHaveBeenCalledWith('Invitation declined.');
  });
});
