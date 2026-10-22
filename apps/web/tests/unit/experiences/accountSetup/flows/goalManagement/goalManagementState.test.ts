import type { Goal } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  afterAction, confirmCancelled, confirmOpened, drawerClosed, drawerOpened, entriesOf, goalIn,
  INITIAL_GOALS, isGoalAction, jointStatusOf, rateEntered, started, statusChanged, toastsFailure,
  type GoalManagementState, type GoalsView,
} from '../../../../../../src/experiences/accountSetup/flows/goalManagement/goalManagementState';

// The Goal Management Flow's state (BDT: Flow-tier pure logic, unit; nothing
// mocked): the status filter, the drawer and its confirm, what is out, the
// last form failure and the typed rates (FR-9.1, OQ-195).

const GONE = { code: 'goal.not_found' };
const BLANK = { code: 'validation.failed' };
const USD_BRL = { base: 'USD', quote: 'BRL' } as const;

/**
 * Builds a goal.
 *
 * @param over - The fields to change.
 * @returns The goal.
 */
const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'house',
  householdId: 'home',
  ownerUserId: 'jane',
  name: 'House',
  targetAmount: 100,
  targetCurrency: 'BRL',
  dueDate: '2029-06-30',
  visibility: 'shared',
  createdAt: '2026-01-01T00:00:00Z',
  completedAt: null,
  ...over,
});

const LOADED: GoalsView = {
  active: { status: 'loaded', goals: [{ goal: goal() }] },
  completed: { status: 'loaded', goals: [{ goal: goal({ id: 'car', name: 'Car' }) }] },
  progress: 'loaded',
};

/**
 * Builds a state with a request out.
 *
 * @param over - The fields to set.
 * @returns The state.
 */
const outState = (over: Partial<GoalManagementState>): GoalManagementState => ({
  ...INITIAL_GOALS, ...over,
});

describe('opening and closing', () => {
  it('opens on the active goals with no rates', () => {
    expect(INITIAL_GOALS).toEqual({ status: 'active', rates: {} });
  });

  it('switches the status, but not while a request is out', () => {
    expect(statusChanged(INITIAL_GOALS, 'completed'))
      .toEqual({ ...INITIAL_GOALS, status: 'completed' });
    const busy = outState({ out: { kind: 'create' } });
    expect(statusChanged(busy, 'completed')).toBe(busy);
  });

  it('opens a drawer, dropping a confirm and an old failure', () => {
    const before = outState({ confirm: 'complete', lastError: BLANK });
    expect(drawerOpened(before, { kind: 'edit', goalId: 'house' })).toEqual(
      outState({ drawer: { kind: 'edit', goalId: 'house' } }),
    );
  });

  it('closes the drawer and its confirm unless a request is out', () => {
    const open = outState({
      drawer: { kind: 'edit', goalId: 'house' }, confirm: 'delete', lastError: BLANK,
    });
    expect(drawerClosed(open)).toEqual(INITIAL_GOALS);
    const busy = outState({ drawer: { kind: 'create' }, out: { kind: 'create' } });
    expect(drawerClosed(busy)).toBe(busy);
  });

  it('opens and cancels a confirm in the edit drawer, but neither while a request is out', () => {
    const editing = outState({ drawer: { kind: 'edit', goalId: 'car' } });
    const open = confirmOpened(editing, 'reopen');
    expect(open.confirm).toBe('reopen');
    expect(confirmCancelled(open)).toEqual(editing);
    const busy = { ...open, out: { kind: 'reopen', goalId: 'car' } } as const;
    expect(confirmOpened(busy, 'delete')).toBe(busy);
    expect(confirmCancelled(busy)).toBe(busy);
  });

  it('opens no confirm without an edit drawer', () => {
    expect(confirmOpened(INITIAL_GOALS, 'delete')).toBe(INITIAL_GOALS);
    const creating = outState({ drawer: { kind: 'create' } });
    expect(confirmOpened(creating, 'delete')).toBe(creating);
  });
});

describe('rateEntered (FR-9.1)', () => {
  it('keeps a rate by its pair and replaces it when retyped', () => {
    const once = rateEntered(INITIAL_GOALS, USD_BRL, 52000);
    expect(once.rates).toEqual({ 'USD/BRL': 52000 });
    expect(rateEntered(once, USD_BRL, 53000).rates).toEqual({ 'USD/BRL': 53000 });
  });

  it('forgets a rate once cleared or zero', () => {
    const once = rateEntered(INITIAL_GOALS, USD_BRL, 52000);
    expect(rateEntered(once, USD_BRL, null).rates).toEqual({});
    expect(rateEntered(once, USD_BRL, 0).rates).toEqual({});
  });
});

describe('requests', () => {
  it('marks a request out, dropping the old failure', () => {
    expect(started(outState({ lastError: BLANK }), { kind: 'create' })).toEqual(
      outState({ out: { kind: 'create' } }),
    );
  });

  it('tells confirmed steps from form requests', () => {
    expect(isGoalAction({ kind: 'complete', goalId: 'house' })).toBe(true);
    expect(isGoalAction({ kind: 'delete', goalId: 'house' })).toBe(true);
    expect(isGoalAction({ kind: 'edit', goalId: 'house' })).toBe(false);
    expect(isGoalAction({ kind: 'create' })).toBe(false);
  });

  it('toasts a step\'s failure and an edit of a gone goal, but not a form objection', () => {
    expect(toastsFailure({ kind: 'reopen', goalId: 'car' }, BLANK)).toBe(true);
    expect(toastsFailure({ kind: 'edit', goalId: 'house' }, GONE)).toBe(true);
    expect(toastsFailure({ kind: 'edit', goalId: 'house' }, BLANK)).toBe(false);
    expect(toastsFailure({ kind: 'create' }, GONE)).toBe(false);
  });
});

describe('afterAction', () => {
  it('ignores an answer with nothing out', () => {
    expect(afterAction(INITIAL_GOALS, { ok: true })).toBe(INITIAL_GOALS);
  });

  it('closes the drawer on a form success', () => {
    const busy = outState({ drawer: { kind: 'create' }, out: { kind: 'create' } });
    expect(afterAction(busy, { ok: true })).toEqual(INITIAL_GOALS);
  });

  it('keeps the drawer with the failure for its banner', () => {
    const busy = outState({ drawer: { kind: 'create' }, out: { kind: 'create' } });
    expect(afterAction(busy, { ok: false, error: BLANK })).toEqual(
      outState({ drawer: { kind: 'create' }, lastError: BLANK }),
    );
  });

  it('closes an edit drawer whose goal is gone', () => {
    const busy = outState({
      drawer: { kind: 'edit', goalId: 'house' }, out: { kind: 'edit', goalId: 'house' },
    });
    expect(afterAction(busy, { ok: false, error: GONE })).toEqual(INITIAL_GOALS);
  });

  it('closes the drawer and its confirm on a step\'s success, or once its goal is gone', () => {
    const busy = outState({
      drawer: { kind: 'edit', goalId: 'house' },
      confirm: 'complete',
      out: { kind: 'complete', goalId: 'house' },
    });
    expect(afterAction(busy, { ok: true })).toEqual(INITIAL_GOALS);
    expect(afterAction(busy, { ok: false, error: GONE })).toEqual(INITIAL_GOALS);
  });

  it('keeps the drawer and its confirm for another try on any other failure', () => {
    const busy = outState({
      drawer: { kind: 'edit', goalId: 'house' },
      confirm: 'delete',
      out: { kind: 'delete', goalId: 'house' },
    });
    expect(afterAction(busy, { ok: false, error: { code: 'auth.forbidden' } })).toEqual(
      outState({ drawer: { kind: 'edit', goalId: 'house' }, confirm: 'delete' }),
    );
  });
});

describe('reading the goals', () => {
  it('lists one status, or nothing while it is not loaded', () => {
    expect(entriesOf(LOADED, 'completed').map((entry) => entry.goal.id)).toEqual(['car']);
    expect(entriesOf({ ...LOADED, active: { status: 'loading' } }, 'active')).toEqual([]);
  });

  it('finds a goal in either status, or nothing', () => {
    expect(goalIn(LOADED, 'car')?.name).toBe('Car');
    expect(goalIn(LOADED, 'house')?.name).toBe('House');
    expect(goalIn(LOADED, 'gone')).toBeUndefined();
    expect(goalIn(LOADED, undefined)).toBeUndefined();
  });

  it('is failed if a list failed, loading while one loads, stale after a refetch failure', () => {
    const error = { code: 'network.error' };
    expect(jointStatusOf({ ...LOADED, completed: { status: 'failed', error } }))
      .toEqual({ status: 'failed' });
    expect(jointStatusOf({ ...LOADED, active: { status: 'loading' } }))
      .toEqual({ status: 'loading' });
    expect(jointStatusOf(LOADED)).toEqual({ status: 'loaded', stale: false });
    const stale = {
      ...LOADED, active: { status: 'loaded', goals: [], refreshError: error },
    } as const;
    expect(jointStatusOf(stale)).toEqual({ status: 'loaded', stale: true });
  });
});
