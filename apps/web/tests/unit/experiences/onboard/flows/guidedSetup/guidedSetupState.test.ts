import type { Account, Budget, Category } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  accountFormToggled, afterAccountCreate, afterAccountsLoad, afterBudgetWrite, budgetFormOpened,
  discardCancelled, finishRequested, hasAccount, INITIAL_GUIDED_SETUP, liveAccountsOf,
  loadingAccounts, nextStep, previousStep, showsAccountForm, started, stepMoved, summaryOf,
  type GuidedSetupState,
} from '../../../../../../src/experiences/onboard/flows/guidedSetup/guidedSetupState';

// The Guided Setup Flow's state (BDT: Flow, unit — pure, nothing to mock).
// The account step can't be left without an account (FR-1.22); the category
// and budget steps can; the summary counts what was set up.

/**
 * Builds an account.
 *
 * @param id - Its id, also its name.
 * @param over - The fields to override.
 * @returns The account.
 */
const account = (id: string, over: Partial<Account> = {}): Account => ({
  id,
  householdId: 'doe',
  ownerUserId: 'jane',
  name: id,
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-10-22',
  archivedAt: null,
  createdAt: '2026-10-22T00:00:00Z',
  balance: 0,
  cards: [],
  ...over,
} as Account);

/**
 * Builds a category.
 *
 * @param id - Its id.
 * @param archivedAt - When it was archived, if it was.
 * @returns The category.
 */
const category = (id: string, archivedAt: string | null = null): Category => ({
  id,
  householdId: 'doe',
  name: id,
  icon: 'home-outline',
  color: 'mint',
  archivedAt,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [],
});

const BUDGET = { id: 'b1' } as Budget;

/**
 * The initial state with some fields set.
 *
 * @param over - The fields to set.
 * @returns The state.
 */
const stateWith = (over: Partial<GuidedSetupState> = {}): GuidedSetupState => ({
  ...INITIAL_GUIDED_SETUP, ...over,
});

const LOADED = stateWith({ accounts: { status: 'loaded', accounts: [account('a1')] } });
const FAILURE = { code: 'network.unavailable' };

describe('the accounts', () => {
  it('open loading, on the account step', () => {
    expect(INITIAL_GUIDED_SETUP.step).toBe('account');
    expect(INITIAL_GUIDED_SETUP.accounts).toEqual({ status: 'loading' });
  });

  it('load, fail, and load again on a retry', () => {
    const loaded = afterAccountsLoad(INITIAL_GUIDED_SETUP, { ok: true, data: [account('a1')] });
    expect(loaded.accounts).toEqual({ status: 'loaded', accounts: [account('a1')] });
    const failed = afterAccountsLoad(INITIAL_GUIDED_SETUP, { ok: false, error: FAILURE });
    expect(failed.accounts).toEqual({ status: 'failed', error: FAILURE });
    const retried = loadingAccounts(failed);
    expect(retried.accounts).toEqual({ status: 'loading' });
    expect(retried.accountsLoad).toBe(failed.accountsLoad + 1);
  });

  it('count only those in use', () => {
    const view = {
      status: 'loaded',
      accounts: [account('a1'), account('a2', { archivedAt: '2026-10-22T00:00:00Z' })],
    } as const;
    expect(liveAccountsOf(view).map((item) => item.id)).toEqual(['a1']);
    expect(liveAccountsOf({ status: 'loading' })).toEqual([]);
  });
});

describe('the account step (FR-1.22)', () => {
  it('has no way on until the household has an account', () => {
    expect(hasAccount(INITIAL_GUIDED_SETUP)).toBe(false);
    expect(hasAccount(LOADED)).toBe(true);
  });

  it('shows the form only once the accounts are in', () => {
    expect(showsAccountForm(INITIAL_GUIDED_SETUP)).toBe(false);
    const failed = stateWith({
      accounts: { status: 'failed', error: FAILURE }, addingAccount: true,
    });
    expect(showsAccountForm(failed)).toBe(false);
  });

  it('shows the form until there is an account, then only when asked', () => {
    const empty = stateWith({ accounts: { status: 'loaded', accounts: [] } });
    expect(showsAccountForm(empty)).toBe(true);
    expect(showsAccountForm(LOADED)).toBe(false);
    const adding = accountFormToggled({ ...LOADED, lastError: FAILURE }, true);
    expect(showsAccountForm(adding)).toBe(true);
    expect(adding.lastError).toBeUndefined();
    expect(showsAccountForm(accountFormToggled(adding, false))).toBe(false);
  });

  it('marks a create as out, clearing the last failure', () => {
    expect(started(stateWith({ lastError: FAILURE }), 'account')).toEqual(
      stateWith({ out: 'account', lastError: undefined }),
    );
  });

  it('moves to the categories with the created account added', () => {
    const after = afterAccountCreate(
      { ...LOADED, out: 'account', addingAccount: true },
      { ok: true, data: account('a2') },
    );
    expect(after.step).toBe('categories');
    expect(after.out).toBeUndefined();
    expect(after.addingAccount).toBe(false);
    expect(liveAccountsOf(after.accounts).map((item) => item.id)).toEqual(['a1', 'a2']);
  });

  it('leaves a list that isn’t loaded as it is', () => {
    const failed = stateWith({ accounts: { status: 'failed', error: FAILURE }, out: 'account' });
    const after = afterAccountCreate(failed, { ok: true, data: account('a1') });
    expect(after.accounts).toBe(failed.accounts);
  });

  it('keeps the list as it is when the answer carries no account', () => {
    const after = afterAccountCreate({ ...LOADED, out: 'account' }, { ok: true });
    expect(after.accounts).toBe(LOADED.accounts);
    expect(after.step).toBe('categories');
  });

  it('stays on the form with the failure', () => {
    const after = afterAccountCreate(stateWith({ out: 'account' }), { ok: false, error: FAILURE });
    expect(after).toEqual(stateWith({ out: undefined, lastError: FAILURE }));
  });
});

describe('moving between steps', () => {
  it('goes on account → categories → budget → summary, which stays put', () => {
    expect(nextStep('account')).toBe('categories');
    expect(nextStep('categories')).toBe('budget');
    expect(nextStep('budget')).toBe('complete');
    expect(nextStep('complete')).toBe('complete');
  });

  it('goes back summary → budget → categories → account, which stays put', () => {
    expect(previousStep('complete')).toBe('budget');
    expect(previousStep('budget')).toBe('categories');
    expect(previousStep('categories')).toBe('account');
    expect(previousStep('account')).toBe('account');
  });

  it('leaves the last step’s form, failure and confirm behind', () => {
    const busy = stateWith({
      step: 'budget',
      lastError: FAILURE,
      addingAccount: true,
      editingBudgetId: 'b1',
      discardConfirmOpen: true,
      budgetFormKey: 3,
    });
    expect(stepMoved(busy, 'categories')).toEqual(stateWith({
      step: 'categories', budgetFormKey: 4,
    }));
  });
});

describe('the budget step', () => {
  it('starts the form afresh after a save', () => {
    const editing = stateWith({ out: 'budget', editingBudgetId: 'b1', budgetFormKey: 2 });
    expect(afterBudgetWrite(editing, { ok: true })).toEqual(stateWith({ budgetFormKey: 3 }));
  });

  it('keeps the form, and what was typed, after a failure', () => {
    const editing = stateWith({ out: 'budget', editingBudgetId: 'b1', budgetFormKey: 2 });
    expect(afterBudgetWrite(editing, { ok: false, error: FAILURE })).toEqual(stateWith({
      editingBudgetId: 'b1', budgetFormKey: 2, lastError: FAILURE,
    }));
  });

  it('loads a budget into the form, and back to a create', () => {
    const opened = budgetFormOpened(
      stateWith({ lastError: FAILURE, discardConfirmOpen: true }),
      'b1',
    );
    expect(opened).toEqual(stateWith({ editingBudgetId: 'b1', budgetFormKey: 1 }));
    expect(budgetFormOpened(opened, undefined)).toEqual(stateWith({ budgetFormKey: 2 }));
  });

  it('finishes at once with nothing unsaved', () => {
    expect(finishRequested(stateWith({ step: 'budget' }), false).step).toBe('complete');
  });

  it('asks first when a budget is typed and not saved, and can be told to keep it', () => {
    const asking = finishRequested(stateWith({ step: 'budget' }), true);
    expect(asking).toEqual(stateWith({ step: 'budget', discardConfirmOpen: true }));
    expect(discardCancelled(asking).discardConfirmOpen).toBe(false);
  });
});

describe('the summary', () => {
  it('counts accounts in use and their cards, categories in use and budgets', () => {
    const accounts = {
      status: 'loaded',
      accounts: [
        account('a1', { cards: [{}, {}] as Account['cards'] }),
        account('a2', { cards: [{}] as Account['cards'], archivedAt: '2026-10-22T00:00:00Z' }),
      ],
    } as const;
    const categories = {
      status: 'loaded', categories: [category('c1'), category('c2', '2026-10-22T00:00:00Z')],
    } as const;
    const budgets = { status: 'loaded', budgets: [BUDGET] } as const;
    expect(summaryOf(accounts, categories, budgets)).toEqual({
      accounts: 1, cards: 2, categories: 1, budgets: 1,
    });
  });

  it('counts nothing in a list that isn’t loaded', () => {
    expect(summaryOf({ status: 'loading' }, { status: 'loading' }, { status: 'loading' }))
      .toEqual({
        accounts: 0, cards: 0, categories: 0, budgets: 0,
      });
  });
});
