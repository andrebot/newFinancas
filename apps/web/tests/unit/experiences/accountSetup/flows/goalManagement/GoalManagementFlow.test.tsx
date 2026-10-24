import { act, fireEvent, screen } from '@testing-library/react';
import type { Goal } from '@financas/api-types';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  goalIdOf, failureToastOf, GoalManagementFlow, type GoalManagementFlowProps,
} from '../../../../../../src/experiences/accountSetup/flows/goalManagement/GoalManagementFlow';
import type { GoalDrawerProps } from '../../../../../../src/experiences/accountSetup/flows/goalManagement/interactions/GoalDrawer';
import type { GoalListProps } from '../../../../../../src/experiences/accountSetup/flows/goalManagement/interactions/GoalList';
import type { GoalsView } from '../../../../../../src/experiences/accountSetup/sharedLists';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import { createTranslator } from '../../../../../../src/utilities/i18n';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// The Goal Management Flow (BDT: Flow, unit). Its Interactions are stubbed —
// they have their own suites — so the Flow is tested against its state machine
// and handlers; the goals come in as the Experience's display state. The kit,
// the toast queue and the translator stay real.

/** The steps a create's drawer has: none, as a stub can still press them. */
const { NO_STEPS } = vi.hoisted(() => ({
  NO_STEPS: {
    busy: false, onAsk: () => {}, onConfirm: () => {}, onCancel: () => {},
  },
}));

vi.mock('../../../../../../src/experiences/accountSetup/flows/goalManagement/interactions/GoalList', () => ({
  /**
   * The list's stand-in: the status, the counts, each card's gate and its opener.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  GoalList: ({
    status, counts, entries, rates, progress, isManageable, onStatus, onEdit, onRate,
  }: GoalListProps) => (
    <div
      data-testid="list"
      data-status={status}
      data-counts={JSON.stringify(counts)}
      data-rates={JSON.stringify(rates)}
      data-progress={progress}
    >
      <button type="button" onClick={() => onStatus('completed')}>show completed</button>
      <button type="button" onClick={() => onRate({ base: 'USD', quote: 'BRL' }, 52000)}>
        rate
      </button>
      {entries.map(({ goal }) => (
        <div key={goal.id} data-testid="card" data-manage={String(isManageable(goal))}>
          <button type="button" onClick={() => onEdit(goal.id)}>{`edit ${goal.id}`}</button>
        </div>
      ))}
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/accountSetup/flows/goalManagement/interactions/GoalDrawer', () => ({
  /**
   * The drawer's stand-in: its goal, state, a submit of fixed fields and its steps.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  GoalDrawer: ({
    goal, personalOnly, busy, disabled, alert, onSubmit, onCancel, steps = NO_STEPS,
  }: GoalDrawerProps) => (
    <div
      data-testid="drawer"
      data-goal={goal?.id ?? ''}
      data-personal={String(personalOnly)}
      data-busy={String(busy)}
      data-disabled={String(disabled)}
      data-alert={alert ?? ''}
      data-steps={String(steps !== NO_STEPS)}
      data-confirm={steps.confirm ?? ''}
      data-step-busy={String(steps.busy)}
    >
      <button
        type="button"
        onClick={() => onSubmit({
          name: 'Home',
          targetAmount: 500,
          targetCurrency: 'USD',
          dueDate: '2030-01-31',
          visibility: 'shared',
        })}
      >
        submit
      </button>
      <button type="button" onClick={onCancel}>cancel drawer</button>
      {(['complete', 'reopen', 'delete'] as const).map((step) => (
        <button key={step} type="button" onClick={() => steps.onAsk(step)}>
          {`ask ${step}`}
        </button>
      ))}
      <button type="button" onClick={steps.onConfirm}>confirm</button>
      <button type="button" onClick={steps.onCancel}>cancel confirm</button>
    </div>
  ),
}));

/**
 * Builds a goal.
 *
 * @param id - Its id, also its name.
 * @param over - The fields to override.
 * @returns The goal.
 */
const goal = (id: string, over: Partial<Goal> = {}): Goal => ({
  id,
  householdId: 'doe',
  ownerUserId: 'jane',
  name: id,
  targetAmount: 1000,
  targetCurrency: 'BRL',
  dueDate: '2029-06-30',
  visibility: 'shared',
  createdAt: '2026-10-01T00:00:00Z',
  completedAt: null,
  ...over,
});

const GOALS: GoalsView = {
  active: { status: 'loaded', goals: [{ goal: goal('house') }, { goal: goal('trip') }] },
  completed: {
    status: 'loaded', goals: [{ goal: goal('car', { completedAt: '2026-10-10T00:00:00Z' }) }],
  },
  progress: { active: 'loaded', completed: 'loaded' },
};
const translator = createTranslator('en-US');
// Passed as a spread: a literal `role` attribute reads as an ARIA role to the linter.
const OWNER = { selfUserId: 'jane', role: 'Owner' };

let queue: AlertQueue;

beforeEach(() => {
  queue = createAlertQueue(3);
});

/**
 * Renders the Flow with its requests spied.
 *
 * @param over - The props over the defaults.
 * @returns The requests, and a rerender with its tab open or hidden.
 */
const renderFlow = (over: Partial<GoalManagementFlowProps> = {}) => {
  const ok = async (): Promise<RequestOutcome> => ({ ok: true });
  const requests = {
    onRetry: vi.fn(),
    onCreate: vi.fn(ok),
    onEdit: vi.fn(ok),
    onDelete: vi.fn(ok),
    onComplete: vi.fn(ok),
    onReopen: vi.fn(ok),
  };
  /**
   * Builds the Flow with its tab open or hidden.
   *
   * @param active - Whether its tab is open.
   * @returns The element.
   */
  const flow = (active: boolean) => (
    <AlertProvider queue={queue}>
      <GoalManagementFlow {...OWNER} goals={GOALS} {...requests} {...over} active={active} />
    </AlertProvider>
  );
  const view = renderInLocale(flow(true));
  return {
    ...requests,
    showTab: async (active: boolean) => {
      await act(async () => view.rerenderInLocale(flow(active)));
    },
  };
};

/**
 * Clicks a button and lets its request settle.
 *
 * @param name - The button's text.
 */
const press = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

/** The list stub's data. */
const list = () => screen.getByTestId('list').dataset;

/** The toasts on screen, by text. */
const toasts = () => queue.visible().map(({ message }) => message);

describe('failureToastOf', () => {
  it('says a goal was deleted meanwhile, by the name it had', () => {
    const gone = { code: 'goal.not_found' };
    expect(failureToastOf({ kind: 'edit', goalId: 'g' }, gone, 'Trip', translator))
      .toBe("Trip was deleted by someone else, so your changes weren't saved.");
    expect(failureToastOf({ kind: 'complete', goalId: 'g' }, gone, 'Trip', translator))
      .toBe('Trip was deleted by someone else.');
  });

  it('writes any other failure from its code', () => {
    const forbidden = { code: 'auth.forbidden' };
    expect(failureToastOf({ kind: 'delete', goalId: 'g' }, forbidden, 'Trip', translator))
      .toBe(translator.error('auth.forbidden'));
  });
});

describe('goalIdOf', () => {
  it('names the goal a request is about, and none for a create', () => {
    expect(goalIdOf({ kind: 'delete', goalId: 'trip' })).toBe('trip');
    expect(goalIdOf({ kind: 'create' })).toBeUndefined();
    expect(goalIdOf(undefined)).toBeUndefined();
  });
});

describe('the panel', () => {
  it('shows a skeleton while a list loads', () => {
    renderFlow({ goals: { ...GOALS, completed: { status: 'loading' } } });
    expect(screen.getByLabelText('Loading the goals')).toBeTruthy();
  });

  it('offers a retry when a first load failed', async () => {
    const failed = { status: 'failed', error: { code: 'internal.unexpected' } } as const;
    const { onRetry } = renderFlow({ goals: { ...GOALS, active: failed } });
    expect(screen.getByText("Couldn't load the goals.")).toBeTruthy();
    await press('Try again');
    expect(onRetry).toHaveBeenCalled();
  });

  it('keeps the list beside a banner when a refetch failed', () => {
    const stale = { ...GOALS.active, refreshError: { code: 'internal.unexpected' } } as const;
    renderFlow({ goals: { ...GOALS, active: stale } });
    expect(screen.getByText("Couldn't refresh the goals, so the list may be out of date."))
      .toBeTruthy();
    expect(screen.getByTestId('list')).toBeTruthy();
  });

  it('says the progress is unavailable, with a retry, when its read failed (OQ-195)', async () => {
    const { onRetry } = renderFlow({
      goals: { ...GOALS, progress: { active: 'failed', completed: 'failed' } },
    });
    expect(screen.getByText(translator.text('goalManagement', 'progress.failed'))).toBeTruthy();
    expect(list().progress).toBe('failed');
    await press('Try again');
    expect(onRetry).toHaveBeenCalled();
  });

  it('reads the progress of the status shown, banner and all', async () => {
    renderFlow({ goals: { ...GOALS, progress: { active: 'failed', completed: 'loaded' } } });
    const banner = translator.text('goalManagement', 'progress.failed');
    expect(screen.getByText(banner)).toBeTruthy();
    expect(list().progress).toBe('failed');
    await press('show completed');
    expect(screen.queryByText(banner)).toBeNull();
    expect(list().progress).toBe('loaded');
  });

  it('shows the active goals with both counts, and switches to the completed', async () => {
    renderFlow();
    expect(list().status).toBe('active');
    expect(JSON.parse(list().counts ?? '')).toEqual({ active: 2, completed: 1 });
    expect(screen.getAllByTestId('card')).toHaveLength(2);
    await press('show completed');
    expect(list().status).toBe('completed');
    expect(screen.getAllByTestId('card')).toHaveLength(1);
  });

  it('offers Add to every member, a Viewer\'s goal personal (OQ-177)', async () => {
    renderFlow({ role: 'Viewer' });
    await press('Add goal');
    expect(screen.getByTestId('drawer').dataset.personal).toBe('true');
  });

  it('hides Add from someone outside the household', () => {
    renderFlow({ role: undefined });
    expect(screen.queryByRole('button', { name: 'Add goal' })).toBeNull();
  });

  it('gates each card on who may manage it', () => {
    renderFlow({
      role: 'Member',
      goals: {
        ...GOALS,
        active: {
          status: 'loaded',
          goals: [{ goal: goal('mine') }, { goal: goal('theirs', { ownerUserId: 'ben' }) }],
        },
      },
    });
    expect(screen.getAllByTestId('card').map((card) => card.dataset.manage))
      .toEqual(['true', 'false']);
  });

  it('keeps a typed rate in the Flow and sends nothing (FR-9.1)', async () => {
    const requests = renderFlow();
    await press('rate');
    expect(JSON.parse(list().rates ?? '')).toEqual({ 'USD/BRL': 52000 });
    Object.values(requests).filter((value) => vi.isMockFunction(value))
      .forEach((request) => expect(request).not.toHaveBeenCalled());
  });
});

describe('creating and editing a goal', () => {
  it('sends the fields, closes the drawer and toasts the success', async () => {
    const { onCreate } = renderFlow();
    await press('Add goal');
    expect(screen.getByTestId('drawer').dataset.personal).toBe('false');
    await press('submit');
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Home',
      targetAmount: 500,
      targetCurrency: 'USD',
      dueDate: '2030-01-31',
      visibility: 'shared',
    });
    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(toasts()).toEqual(['Home created.']);
  });

  it('shows the Active list, where the new goal is, after a create from Completed', async () => {
    renderFlow();
    await press('show completed');
    await press('Add goal');
    await press('submit');
    expect(list().status).toBe('active');
  });

  it('keeps the drawer with its failure in the banner, not toasted', async () => {
    renderFlow({ onCreate: async () => ({ ok: false, error: { code: 'auth.forbidden' } }) });
    await press('Add goal');
    await press('submit');
    expect(screen.getByTestId('drawer').dataset.alert).toBe(translator.error('auth.forbidden'));
    expect(toasts()).toEqual([]);
  });

  it('holds the drawer while the request is out, and sends nothing more', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    const onCreate = vi.fn(() => new Promise<RequestOutcome>((resolve) => {
      answer = resolve;
    }));
    renderFlow({ onCreate });
    await press('Add goal');
    await press('submit');
    const drawer = screen.getByTestId('drawer').dataset;
    expect([drawer.busy, drawer.disabled, drawer.stepBusy]).toEqual(['true', 'true', 'false']);
    await press('submit');
    await press('cancel drawer');
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('drawer')).toBeTruthy();
    await act(async () => answer({ ok: true }));
    expect(screen.queryByTestId('drawer')).toBeNull();
  });

  it('spins the drawer while its edit is out, Add waiting', async () => {
    renderFlow({ onEdit: () => new Promise<RequestOutcome>(() => {}) });
    const add = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Add goal' });
    expect(add().disabled).toBe(false);
    await press('edit trip');
    await press('submit');
    expect(screen.getByTestId('drawer').dataset.busy).toBe('true');
    expect(add().disabled).toBe(true);
  });

  it('shows its drawer when no tab state is passed', async () => {
    renderInLocale(
      <AlertProvider queue={queue}>
        <GoalManagementFlow
          {...OWNER}
          goals={GOALS}
          onRetry={vi.fn()}
          onCreate={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onComplete={vi.fn()}
          onReopen={vi.fn()}
        />
      </AlertProvider>,
    );
    await press('Add goal');
    expect(screen.getByTestId('drawer')).toBeTruthy();
  });

  it('closes on cancel', async () => {
    renderFlow();
    await press('Add goal');
    await press('cancel drawer');
    expect(screen.queryByTestId('drawer')).toBeNull();
  });

  it('opens the drawer about its goal and sends all but the visibility (OQ-177)', async () => {
    const { onEdit } = renderFlow();
    await press('edit trip');
    const idle = screen.getByTestId('drawer').dataset;
    expect(idle.goal).toBe('trip');
    expect([idle.busy, idle.disabled, idle.stepBusy]).toEqual(['false', 'false', 'false']);
    await press('submit');
    expect(onEdit).toHaveBeenCalledWith({
      goalId: 'trip',
      name: 'Home',
      targetAmount: 500,
      targetCurrency: 'USD',
      dueDate: '2030-01-31',
    });
    expect(toasts()).toEqual(['Home updated.']);
  });

  it('closes the drawer and says so when its goal was deleted meanwhile (404)', async () => {
    renderFlow({ onEdit: async () => ({ ok: false, error: { code: 'goal.not_found' } }) });
    await press('edit trip');
    await press('submit');
    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(toasts())
      .toEqual(["trip was deleted by someone else, so your changes weren't saved."]);
  });
});

describe('a goal\'s steps, in its edit drawer (OQ-195)', () => {
  /**
   * Opens a goal's edit drawer and asks for one step.
   *
   * @param goalId - The goal.
   * @param step - The step.
   */
  const ask = async (goalId: string, step: string) => {
    await press(`edit ${goalId}`);
    await press(`ask ${step}`);
  };

  /** The drawer stub's data. */
  const drawer = () => screen.getByTestId('drawer').dataset;

  it('offers no steps on a create', async () => {
    renderFlow();
    await press('Add goal');
    expect(drawer().steps).toBe('false');
    await press('ask delete');
    expect(drawer().confirm).toBe('');
  });

  it.each([
    ['complete', 'onComplete', 'house marked completed.'],
    ['delete', 'onDelete', 'house deleted.'],
  ] as const)('%s asks first, sends on a yes, closes and toasts', async (step, request, toast) => {
    const requests = renderFlow();
    await ask('house', step);
    expect(drawer().confirm).toBe(step);
    await press('confirm');
    expect(requests[request]).toHaveBeenCalledWith('house');
    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(toasts()).toEqual([toast]);
  });

  it('reopens a completed goal', async () => {
    const { onReopen } = renderFlow();
    await press('show completed');
    await ask('car', 'reopen');
    await press('confirm');
    expect(onReopen).toHaveBeenCalledWith('car');
    expect(toasts()).toEqual(['car reopened.']);
  });

  it('spins its confirm while the step is out, the drawer waiting', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    renderFlow({
      onDelete: () => new Promise<RequestOutcome>((resolve) => {
        answer = resolve;
      }),
    });
    await ask('trip', 'delete');
    await press('confirm');
    expect([drawer().stepBusy, drawer().busy, drawer().disabled])
      .toEqual(['true', 'false', 'true']);
    await press('cancel confirm');
    await press('cancel drawer');
    expect(drawer().confirm).toBe('delete');
    await act(async () => answer({ ok: true }));
    expect(screen.queryByTestId('drawer')).toBeNull();
  });

  it('toasts a failure and keeps the drawer and its confirm for another try', async () => {
    renderFlow({ onDelete: async () => ({ ok: false, error: { code: 'auth.forbidden' } }) });
    await ask('trip', 'delete');
    await press('confirm');
    expect(drawer().confirm).toBe('delete');
    expect(toasts()).toEqual([translator.error('auth.forbidden')]);
  });

  it('closes the drawer and says so when the goal is gone (404)', async () => {
    renderFlow({ onComplete: async () => ({ ok: false, error: { code: 'goal.not_found' } }) });
    await ask('trip', 'complete');
    await press('confirm');
    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(toasts()).toEqual(['trip was deleted by someone else.']);
  });

  it('closes the confirm on cancel, and sends nothing without one open', async () => {
    const { onDelete } = renderFlow();
    await ask('trip', 'delete');
    await press('cancel confirm');
    expect(drawer().confirm).toBe('');
    await press('confirm');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('drops an open confirm when the drawer closes', async () => {
    renderFlow();
    await ask('trip', 'delete');
    await press('cancel drawer');
    await press('edit trip');
    expect(drawer().confirm).toBe('');
  });
});

describe('a hidden tab (OQ-197)', () => {
  it('leaves the description to the page header', () => {
    renderFlow();
    expect(screen.queryByText(/Savings and investment goals/)).toBeNull();
  });

  it('closes its drawer once hidden, and shows none when back', async () => {
    const { showTab } = renderFlow();
    await press('Add goal');
    await showTab(false);
    expect(screen.queryByTestId('drawer')).toBeNull();
    await showTab(true);
    expect(screen.queryByTestId('drawer')).toBeNull();
  });
});
