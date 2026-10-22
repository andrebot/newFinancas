import type { Budget } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  afterAction, budgetIn, deleteConfirmCancelled, deleteConfirmOpened, drawerClosed, drawerOpened,
  INITIAL_BUDGETS, isEditOfGone, started, toastsFailure,
  type BudgetManagementState, type BudgetsView,
} from '../../../../../../src/experiences/accountSetup/flows/budgetManagement/budgetManagementState';

// The Budget Management Flow's state (BDT: Flow-tier pure logic, unit; nothing
// mocked): the open drawer, the delete confirm, what is out and the last
// form failure.

const FAILURE = { code: 'budget.target_already_claimed', params: { budgetId: 'b2' } };

/**
 * Builds a budget.
 *
 * @param over - The fields to override.
 * @returns The budget.
 */
const budget = (over: Partial<Budget> = {}): Budget => ({
  id: 'b1',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Fun Money',
  targetAmount: 30000,
  currency: 'USD',
  visibility: 'shared',
  targets: [{ categoryId: 'fun' }],
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

describe('the drawer', () => {
  it('opens fresh: no delete confirm, no failure', () => {
    const before: BudgetManagementState = { deleting: 'b1', lastError: FAILURE };
    expect(drawerOpened(before, { kind: 'edit', budgetId: 'b1' })).toEqual({
      drawer: { kind: 'edit', budgetId: 'b1' }, deleting: undefined, lastError: undefined,
    });
  });

  it('closes with its failure and its delete confirm', () => {
    const open: BudgetManagementState = {
      drawer: { kind: 'edit', budgetId: 'b1' }, deleting: 'b1', lastError: FAILURE,
    };
    expect(drawerClosed(open)).toEqual({
      drawer: undefined, deleting: undefined, lastError: undefined,
    });
  });

  it('stays while a request is out, so its answer has a banner', () => {
    const busy: BudgetManagementState = { drawer: { kind: 'create' }, out: { kind: 'create' } };
    expect(drawerClosed(busy)).toBe(busy);
  });
});

describe('the delete confirm', () => {
  it('opens inside the edit drawer, about its budget, and closes again', () => {
    const editing: BudgetManagementState = { drawer: { kind: 'edit', budgetId: 'b1' } };
    const open = deleteConfirmOpened(editing);
    expect(open).toEqual({ ...editing, deleting: 'b1' });
    expect(deleteConfirmCancelled(open)).toEqual({ ...editing, deleting: undefined });
  });

  it('stays shut without an edit drawer', () => {
    const creating: BudgetManagementState = { drawer: { kind: 'create' } };
    expect(deleteConfirmOpened(creating)).toBe(creating);
    expect(deleteConfirmOpened(INITIAL_BUDGETS)).toBe(INITIAL_BUDGETS);
  });
});

describe('a request', () => {
  it('goes out dropping the last failure', () => {
    expect(started({ lastError: FAILURE }, { kind: 'create' })).toEqual({
      out: { kind: 'create' }, lastError: undefined,
    });
  });

  it('closes its drawer on a success', () => {
    const out: BudgetManagementState = {
      drawer: { kind: 'edit', budgetId: 'b1' }, out: { kind: 'edit', budgetId: 'b1' },
    };
    expect(afterAction(out, { ok: true })).toEqual({
      out: undefined, drawer: undefined, deleting: undefined, lastError: undefined,
    });
  });

  it('keeps its drawer and shows why on a form failure', () => {
    const out: BudgetManagementState = { drawer: { kind: 'create' }, out: { kind: 'create' } };
    expect(afterAction(out, { ok: false, error: FAILURE })).toEqual({
      drawer: { kind: 'create' }, out: undefined, lastError: FAILURE,
    });
  });

  it('closes the drawer on a delete\'s success, keeps its confirm on a failure', () => {
    const editing = { kind: 'edit', budgetId: 'b1' } as const;
    const out: BudgetManagementState = {
      drawer: editing, deleting: 'b1', out: { kind: 'delete', budgetId: 'b1' },
    };
    expect(afterAction(out, { ok: true })).toEqual({
      out: undefined, drawer: undefined, deleting: undefined, lastError: undefined,
    });
    expect(afterAction(out, { ok: false, error: FAILURE })).toEqual({
      drawer: editing, deleting: 'b1', out: undefined, lastError: undefined,
    });
  });

  it('closes the drawer of an edit whose budget is gone, with no banner (OQ-194)', () => {
    const out: BudgetManagementState = {
      drawer: { kind: 'edit', budgetId: 'b1' }, out: { kind: 'edit', budgetId: 'b1' },
    };
    expect(afterAction(out, { ok: false, error: { code: 'budget.not_found' } })).toEqual({
      out: undefined, drawer: undefined, lastError: undefined,
    });
  });

  it('keeps the drawer of a create, even on a 404', () => {
    const out: BudgetManagementState = { drawer: { kind: 'create' }, out: { kind: 'create' } };
    const gone = { code: 'budget.not_found' };
    expect(afterAction(out, { ok: false, error: gone })).toEqual({
      drawer: { kind: 'create' }, out: undefined, lastError: gone,
    });
  });

  it('ignores an answer with nothing out', () => {
    const idle: BudgetManagementState = { drawer: { kind: 'create' } };
    expect(afterAction(idle, { ok: true })).toBe(idle);
  });
});

describe('which failures are toasted (OQ-194)', () => {
  const gone = { code: 'budget.not_found' };
  const edit = { kind: 'edit', budgetId: 'b1' } as const;

  it('tells an edit of a budget gone meanwhile from any other failure', () => {
    expect(isEditOfGone(edit, gone)).toBe(true);
    expect(isEditOfGone(edit, FAILURE)).toBe(false);
    expect(isEditOfGone({ kind: 'create' }, gone)).toBe(false);
  });

  it('toasts a delete\'s failure and an edit of a gone budget, not a banner\'s', () => {
    expect(toastsFailure({ kind: 'delete', budgetId: 'b1' }, FAILURE)).toBe(true);
    expect(toastsFailure(edit, gone)).toBe(true);
    expect(toastsFailure(edit, FAILURE)).toBe(false);
    expect(toastsFailure({ kind: 'create' }, gone)).toBe(false);
  });
});

describe('budgetIn', () => {
  const loaded: BudgetsView = { status: 'loaded', budgets: [budget()] };

  it('finds a budget in the loaded list', () => {
    expect(budgetIn(loaded, 'b1')?.name).toBe('Fun Money');
  });

  it('finds nothing without an id, a loaded list or the budget', () => {
    expect(budgetIn(loaded, undefined)).toBeUndefined();
    expect(budgetIn({ status: 'loading' }, 'b1')).toBeUndefined();
    expect(budgetIn(loaded, 'gone')).toBeUndefined();
  });
});
