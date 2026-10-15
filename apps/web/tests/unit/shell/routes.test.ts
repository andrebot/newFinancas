import { describe, expect, it } from 'vitest';
import { shell } from '../../../src/config/constants';
import {
  MAIN_NAV, returnPathOf, ROUTES, routesFor,
} from '../../../src/shell/routes';

// The routing table (BDT: configuration → unit, nothing mocked).

describe('ROUTES', () => {
  it('gives every page in the settings exactly one entry, at its address', () => {
    expect(ROUTES.map((route) => route.id).sort()).toEqual(Object.keys(shell.paths).sort());
    ROUTES.forEach((route) => expect(route.path).toBe(shell.paths[route.id]));
  });

  it('lists the main nav in the mockup order, each with its label', () => {
    expect(MAIN_NAV.map((entry) => entry.id)).toEqual(
      ['dashboard', 'transactions', 'accountSetup', 'investments', 'household'],
    );
    MAIN_NAV.forEach((entry) => expect(entry.nav.label).toBe(`nav.${entry.id}`));
  });
});

describe('routesFor', () => {
  it('splits the pages by who may open them', () => {
    expect(routesFor('signedOut').map((route) => route.id)).toEqual(
      ['signIn', 'register', 'forgotPassword', 'resetPassword'],
    );
    expect(routesFor('signedIn').map((route) => route.id)).toEqual(['onboard', 'createHousehold']);
    expect(routesFor('household').map((route) => route.id)).toContain('profile');
  });
});

describe('returnPathOf', () => {
  it('returns the page that sent the user to Sign In', () => {
    expect(returnPathOf({ from: '/transactions?holdingId=h1' })).toBe('/transactions?holdingId=h1');
  });

  it('falls back to the Dashboard without a usable path', () => {
    expect(returnPathOf(null)).toBe('/');
    expect(returnPathOf(undefined)).toBe('/');
    expect(returnPathOf({ from: 42 })).toBe('/');
    expect(returnPathOf({ from: 'https://evil.example' })).toBe('/');
  });

  it('never follows a path that would leave the site', () => {
    expect(returnPathOf({ from: '//evil.example/x' })).toBe('/');
  });
});
