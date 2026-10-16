import { screen } from '@testing-library/react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import App, { shellConfigFor } from '../../src/App';
import { ComingSoon } from '../../src/placeholders';
import { renderInLocale } from '../support/renderInLocale';
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
    expect(screen.getByText('Coming soon')).toBeTruthy();
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
  });
});
