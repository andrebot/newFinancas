import type { Account } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_ACCOUNTS, afterAction, afterLoad, archiveConfirmCancelled, archiveConfirmOpened,
  cardChangesOf, drawerClosed, drawerOpened, loadingAccounts, mayChangeVisibility, mayCreate,
  mayEdit, sparseCardChanges, splitAccounts, started, type AccountManagementState,
} from '../../../../../../src/experiences/accountSetup/flows/accountManagement/accountManagementState';

// The Flow's state (BDT: pure transitions → unit, nothing mocked). A success
// moves the list the way the API did; a failure keeps what was typed.

/**
 * Builds an account with sensible defaults for its id and name.
 *
 * @param id - Its id.
 * @param over - What to set besides the defaults.
 * @returns The account.
 */
const account = (id: string, over: Partial<Account> = {}): Account => ({
  id,
  householdId: 'doe',
  ownerUserId: null,
  name: `Account ${id}`,
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-10-01',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  currentBalance: 0,
  cards: [],
  ...over,
});

const CHECKING = account('chk');
const CREDIT = account('ccr', { type: 'credit_card_only' });
const ARCHIVED = account('old', { archivedAt: '2026-09-01T00:00:00Z' });
const LOADED: AccountManagementState = {
  view: { status: 'loaded', accounts: [CHECKING, CREDIT, ARCHIVED] },
};

describe('the list and its load', () => {
  it('opens loading the list, nothing else', () => {
    expect(INITIAL_ACCOUNTS).toEqual({ view: { status: 'loading' } });
  });

  it('marks a retry as loading again, closing whatever was open', () => {
    const state = drawerOpened(LOADED, { kind: 'edit', accountId: 'chk' });
    expect(loadingAccounts(state)).toEqual({ view: { status: 'loading' } });
  });

  it('applies a loaded list', () => {
    expect(afterLoad(INITIAL_ACCOUNTS, { ok: true, accounts: [CHECKING] })).toEqual({
      view: { status: 'loaded', accounts: [CHECKING] },
    });
  });

  it('keeps the failure for its retry', () => {
    const state = afterLoad(INITIAL_ACCOUNTS, {
      ok: false, error: { code: 'internal.unexpected' },
    });
    expect(state.view).toEqual({ status: 'failed', error: { code: 'internal.unexpected' } });
  });

  it('splits a list into its live and archived accounts', () => {
    expect(splitAccounts([CHECKING, ARCHIVED, CREDIT])).toEqual({
      active: [CHECKING, CREDIT], archived: [ARCHIVED],
    });
  });
});

describe('the drawers and the archive confirm', () => {
  it('opens a drawer with no confirm and no stale failure', () => {
    const state = drawerOpened(LOADED, { kind: 'create' });
    expect(state.drawer).toEqual({ kind: 'create' });
    expect(state.archiving).toBeUndefined();
    expect(state.lastError).toBeUndefined();
  });

  it('closes the drawer and its confirm', () => {
    const inner = drawerOpened(LOADED, { kind: 'edit', accountId: 'chk' });
    const open = archiveConfirmOpened(inner, 'chk');
    expect(drawerClosed(open)).toEqual({ ...open, drawer: undefined, archiving: undefined });
  });

  it('opens the confirm about one account', () => {
    const state = archiveConfirmOpened(LOADED, 'ccr');
    expect(state.archiving).toBe('ccr');
  });

  it('cancels the confirm and keeps the drawer open', () => {
    const inner = drawerOpened(LOADED, { kind: 'edit', accountId: 'chk' });
    const open = archiveConfirmOpened(inner, 'chk');
    expect(archiveConfirmCancelled(open)).toEqual({ ...open, archiving: undefined });
  });
});

describe('the requests that are out', () => {
  it('marks one as out and drops any stale failure', () => {
    const failed = afterAction(LOADED, { ok: false, error: { code: 'auth.forbidden' } });
    const expected = { ...failed, out: { kind: 'create' } as const, lastError: undefined };
    expect(started(failed, { kind: 'create' })).toEqual(expected);
  });

  it('answers a create by appending the account it wrote', () => {
    const state = started(LOADED, { kind: 'create' });
    const next = afterAction(state, { ok: true, account: account('new') });
    expect(next.view).toEqual(
      { status: 'loaded', accounts: [CHECKING, CREDIT, ARCHIVED, account('new')] },
    );
    expect(next.out).toBeUndefined();
    expect(next.drawer).toBeUndefined();
  });

  it('answers an edit by replacing with the server’s copy', () => {
    const state = started(LOADED, { kind: 'edit', accountId: 'chk' });
    const renamed = account('chk', { name: 'Renamed' });
    expect(afterAction(state, { ok: true, account: renamed }).view).toEqual({
      status: 'loaded', accounts: [renamed, CREDIT, ARCHIVED],
    });
  });

  it('answers an archive by stamping the day on its account', () => {
    const state = started(LOADED, { kind: 'archive', accountId: 'ccr' });
    const next = afterAction(state, { ok: true });
    const archived = next.view.status === 'loaded'
      ? next.view.accounts.find((acc) => acc.id === 'ccr')
      : undefined;
    expect(archived?.archivedAt).not.toBeNull();
    expect(next.drawer).toBeUndefined();
  });

  it('keeps the drawer and its failure when a request fails', () => {
    const state = started(
      drawerOpened(LOADED, { kind: 'edit', accountId: 'chk' }),
      { kind: 'edit', accountId: 'chk' },
    );
    const next = afterAction(state, { ok: false, error: { code: 'auth.forbidden' } });
    expect(next.out).toBeUndefined();
    expect(next.drawer).toEqual({ kind: 'edit', accountId: 'chk' });
    expect(next.lastError).toEqual({ code: 'auth.forbidden' });
  });

  it('answers nothing when no request is out', () => {
    expect(afterAction(LOADED, { ok: true })).toBe(LOADED);
  });
});

describe('the actor’s rights (FR-1.7)', () => {
  const PERSONAL = account('per', { visibility: 'personal', ownerUserId: 'ana' });
  const SHARED_BY_ANA = account('shd', { ownerUserId: 'ana' });

  it('lets everyone but a Viewer create, and no one without a role', () => {
    expect(mayCreate('Owner')).toBe(true);
    expect(mayCreate('Admin')).toBe(true);
    expect(mayCreate('Member')).toBe(true);
    expect(mayCreate('Viewer')).toBe(false);
    expect(mayCreate(undefined)).toBe(false);
  });

  it('lets a personal account be edited only by its owner, whatever their role', () => {
    expect(mayEdit(PERSONAL, 'ana', 'Member')).toBe(true);
    expect(mayEdit(PERSONAL, 'ben', 'Owner')).toBe(false);
    expect(mayEdit(PERSONAL, 'ana', undefined)).toBe(false);
  });

  it('lets a shared account be edited by an Owner or Admin, or its Member creator', () => {
    expect(mayEdit(SHARED_BY_ANA, 'ben', 'Owner')).toBe(true);
    expect(mayEdit(SHARED_BY_ANA, 'ben', 'Admin')).toBe(true);
    expect(mayEdit(SHARED_BY_ANA, 'ana', 'Member')).toBe(true);
    expect(mayEdit(SHARED_BY_ANA, 'ben', 'Member')).toBe(false);
  });

  it('lets only the creator move a visibility (FR-2.3)', () => {
    expect(mayChangeVisibility(SHARED_BY_ANA, 'ana')).toBe(true);
    expect(mayChangeVisibility(SHARED_BY_ANA, 'ben')).toBe(false);
  });
});

describe('the card changes an edit sends (OQ-35)', () => {
  const CARD = {
    id: 'card-1',
    accountId: 'ccr',
    network: 'visa' as const,
    last4: '1234',
    closingDay: 10,
    dueDay: 20,
    expirationMonth: 8,
    expirationYear: 2030,
    createdAt: '2026-10-01T00:00:00Z',
    outstandingBalance: 0,
  };

  it('adds new cards and drops removed ones, editing only what moved', () => {
    const changes = cardChangesOf([
      {
        id: CARD.id,
        network: 'mastercard',
        last4: '1234',
        closingDay: 10,
        dueDay: 20,
        expirationMonth: 8,
        expirationYear: 2030,
      },
      {
        id: 'gone',
        network: 'elo',
        last4: '9999',
        closingDay: 5,
        dueDay: 15,
        expirationMonth: 1,
        expirationYear: 2027,
        removed: true,
      },
      {
        network: 'amex',
        last4: '0001',
        closingDay: 1,
        dueDay: 10,
        expirationMonth: 2,
        expirationYear: 2028,
      },
    ], [CARD]);

    expect(changes).toEqual({
      add: [{
        network: 'amex',
        last4: '0001',
        closingDay: 1,
        dueDay: 10,
        expirationMonth: 2,
        expirationYear: 2028,
      }],
      edit: [{
        id: CARD.id,
        network: 'mastercard',
        last4: '1234',
        closingDay: 10,
        dueDay: 20,
        expirationMonth: 8,
        expirationYear: 2030,
      }],
      remove: ['gone'],
    });
  });

  it('treats a card that left the list as changed', () => {
    const changes = cardChangesOf([
      {
        id: 'ghost',
        network: 'visa',
        last4: '0002',
        closingDay: 1,
        dueDay: 10,
        expirationMonth: 3,
        expirationYear: 2029,
      },
    ], [CARD]);

    expect(changes).toEqual({
      add: [],
      edit: [{
        id: 'ghost',
        network: 'visa',
        last4: '0002',
        closingDay: 1,
        dueDay: 10,
        expirationMonth: 3,
        expirationYear: 2029,
      }],
      remove: [],
    });
  });

  it('sends nothing for an attached card that did not move', () => {
    const changes = cardChangesOf([
      {
        id: CARD.id,
        network: 'visa',
        last4: '1234',
        closingDay: 10,
        dueDay: 20,
        expirationMonth: 8,
        expirationYear: 2030,
      },
    ], [CARD]);

    expect(changes).toEqual({ add: [], edit: [], remove: [] });
  });

  it('thins the changes down to what actually moved', () => {
    const none = sparseCardChanges({ add: [], edit: [], remove: [] });
    expect(none).toBeUndefined();
    expect(sparseCardChanges({
      add: [{
        network: 'amex',
        last4: '0001',
        closingDay: 1,
        dueDay: 10,
        expirationMonth: 2,
        expirationYear: 2028,
      }],
      edit: [],
      remove: ['gone'],
    })).toEqual({
      add: [{
        network: 'amex',
        last4: '0001',
        closingDay: 1,
        dueDay: 10,
        expirationMonth: 2,
        expirationYear: 2028,
      }],
      remove: ['gone'],
    });
  });
});
