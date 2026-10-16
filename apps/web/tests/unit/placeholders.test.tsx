import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ComingSoon, placeholderActions, placeholderPages, placeholderSources,
} from '../../src/placeholders';
import { ROUTES } from '../../src/shell/routes';
import { selectSession } from '../../src/shell/shellState';
import { renderInLocale } from '../support/renderInLocale';
import { fakeStore } from './shell/shellFakes';

// The stand-ins for Experiences not built yet (BDT: unit, nothing mocked).

describe('ComingSoon', () => {
  it('says the page comes later, in each locale', () => {
    renderInLocale(<ComingSoon />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
    renderInLocale(<ComingSoon />, 'pt-BR');
    expect(screen.getByText('Em breve')).toBeTruthy();
  });
});

describe('placeholders', () => {
  it('stand in for every page', () => {
    expect(Object.keys(placeholderPages).sort()).toEqual(ROUTES.map((route) => route.id).sort());
  });

  it('never load data', () => {
    expect(placeholderSources.useIdentity()).toEqual({ status: 'loading' });
    expect(placeholderSources.useHouseholds()).toEqual({ status: 'loading' });
    expect(placeholderSources.usePendingInvitationCount()).toBe(0);
  });

  it('sign out in this browser only, and export nothing', () => {
    const { store, tokenStorage } = fakeStore({ refreshToken: 'refresh-1' });
    const actions = placeholderActions(store.dispatch);

    actions.exportAuditLog();
    expect(selectSession(store.getState())).toBe('signedIn');
    actions.signOut();

    expect(selectSession(store.getState())).toBe('signedOut');
    expect(tokenStorage.value).toBeNull();
  });
});
