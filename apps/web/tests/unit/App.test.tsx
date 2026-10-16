import { screen } from '@testing-library/react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import App, { shellConfigFor } from '../../src/App';
import { AuthenticateExperience } from '../../src/experiences/authenticate/AuthenticateExperience';
import { OnboardExperience } from '../../src/experiences/onboard/OnboardExperience';
import { ComingSoon } from '../../src/placeholders';
import { selectSession } from '../../src/shell/shellState';
import { renderInLocale } from '../support/renderInLocale';
import { jsonResponse } from './api/fakes';
import { fakeStore } from './shell/shellFakes';

// The composition root (BDT: wiring → unit over the real store with fake
// surroundings). The router is the browser's, on jsdom's address bar.

const themeController = { apply: vi.fn(), restore: vi.fn() };

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('routes a signed-out visitor to Sign In', () => {
    renderInLocale(<App store={fakeStore().store} themeController={themeController} />);

    expect(window.location.pathname).toBe('/sign-in');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy();
  });
});

describe('shellConfigFor', () => {
  it('configures every page and the page theme controller', () => {
    const { store } = fakeStore();
    const config = shellConfigFor(store, themeController);

    expect(Object.keys(config.pages)).toHaveLength(12);
    expect(config.themeController).toBe(themeController);
    expect(config.notificationRoutes).toEqual({});
    expect(config.inbox).toBeUndefined();
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
    const config = shellConfigFor(store, themeController);

    config.actions.signOut();
    config.actions.exportAuditLog();

    await vi.waitFor(() => expect(selectSession(store.getState())).toBe('signedOut'));
    const request = fetchFn.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe('/api/v1/auth/logout');
    expect(tokenStorage.value).toBeNull();
  });
});
