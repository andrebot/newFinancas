import { act, fireEvent, screen } from '@testing-library/react';
import type { Budget, Category } from '@financas/api-types';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  alertOf, BudgetManagementFlow, jointViewOf, type BudgetManagementFlowProps,
} from '../../../../../../src/experiences/accountSetup/flows/budgetManagement/BudgetManagementFlow';
import type { BudgetDrawerProps } from '../../../../../../src/experiences/accountSetup/flows/budgetManagement/interactions/BudgetDrawer';
import type { BudgetListProps } from '../../../../../../src/experiences/accountSetup/flows/budgetManagement/interactions/BudgetList';
import type { BudgetsView, CategoriesView } from '../../../../../../src/experiences/accountSetup/sharedLists';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import { createTranslator } from '../../../../../../src/utilities/i18n';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// The Budget Management Flow (BDT: Flow, unit). Its Interactions are stubbed —
// they have their own suites — so the Flow is tested against its state machine
// and handlers; the lists come in as the Experience's display state. The kit,
// the toast queue and the translator stay real.

vi.mock('../../../../../../src/experiences/accountSetup/flows/budgetManagement/interactions/BudgetList', () => ({
  /**
   * The list's stand-in: each budget's id, its manage gate and the Flow's handlers.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  BudgetList: ({
    budgets, isManageable, busy, deleting, deletingOut, onEdit, onDeleteRequest, onConfirmDelete,
    onCancelDelete,
  }: BudgetListProps) => (
    <div
      data-testid="list"
      data-busy={String(busy)}
      data-deleting={deleting ?? ''}
      data-out={deletingOut ?? ''}
    >
      {budgets.map((budget) => (
        <div key={budget.id} data-testid="card" data-manage={String(isManageable(budget))}>
          <button type="button" onClick={() => onEdit(budget.id)}>{`edit ${budget.id}`}</button>
          <button type="button" onClick={() => onDeleteRequest(budget.id)}>
            {`delete ${budget.id}`}
          </button>
        </div>
      ))}
      <button type="button" onClick={onConfirmDelete}>confirm delete</button>
      <button type="button" onClick={onCancelDelete}>cancel delete</button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/accountSetup/flows/budgetManagement/interactions/BudgetDrawer', () => ({
  /**
   * The drawer's stand-in: its budget, state and a submit of fixed fields.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  BudgetDrawer: ({
    budget, personalOnly, busy, disabled, alert, onSubmit, onCancel,
  }: BudgetDrawerProps) => (
    <div
      data-testid="drawer"
      data-budget={budget?.id ?? ''}
      data-personal={String(personalOnly)}
      data-busy={String(busy)}
      data-disabled={String(disabled)}
      data-alert={alert ?? ''}
    >
      <button
        type="button"
        onClick={() => onSubmit({
          name: 'Home',
          targetAmount: 500,
          currency: 'BRL',
          visibility: 'shared',
          targets: [{ categoryId: 'food' }],
        })}
      >
        submit
      </button>
      <button type="button" onClick={onCancel}>cancel drawer</button>
    </div>
  ),
}));

const FOOD: Category = {
  id: 'food',
  householdId: 'doe',
  name: 'Food',
  icon: 'home-outline',
  color: 'mint',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [],
};

/**
 * Builds a budget.
 *
 * @param id - Its id, also its name.
 * @param over - The fields to override.
 * @returns The budget.
 */
const budget = (id: string, over: Partial<Budget> = {}): Budget => ({
  id,
  householdId: 'doe',
  ownerUserId: 'jane',
  name: id,
  targetAmount: 1000,
  currency: 'BRL',
  visibility: 'shared',
  targets: [],
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

const BUDGETS: BudgetsView = { status: 'loaded', budgets: [budget('fun'), budget('home')] };
const CATEGORIES: CategoriesView = { status: 'loaded', categories: [FOOD] };
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
 * @returns The requests.
 */
const renderFlow = (over: Partial<BudgetManagementFlowProps> = {}) => {
  const requests = {
    onRetry: vi.fn(),
    onCreate: vi.fn(async (): Promise<RequestOutcome> => ({ ok: true })),
    onEdit: vi.fn(async (): Promise<RequestOutcome> => ({ ok: true })),
    onDelete: vi.fn(async (): Promise<RequestOutcome> => ({ ok: true })),
  };
  renderInLocale(
    <AlertProvider queue={queue}>
      <BudgetManagementFlow
        {...OWNER}
        budgets={BUDGETS}
        categories={CATEGORIES}
        {...requests}
        {...over}
      />
    </AlertProvider>,
  );
  return requests;
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

/** The toasts on screen, by text. */
const toasts = () => queue.visible().map(({ message }) => message);

describe('jointViewOf', () => {
  it('fails if either list\'s first load failed, else loads until both are in', () => {
    const failed = { status: 'failed', error: { code: 'x' } } as const;
    expect(jointViewOf(failed, CATEGORIES)).toEqual({ status: 'failed' });
    expect(jointViewOf(BUDGETS, failed)).toEqual({ status: 'failed' });
    expect(jointViewOf({ status: 'loading' }, CATEGORIES)).toEqual({ status: 'loading' });
    expect(jointViewOf(BUDGETS, { status: 'loading' })).toEqual({ status: 'loading' });
  });

  it('is stale when either list\'s latest fetch failed', () => {
    const refreshError = { code: 'internal.unexpected' };
    expect(jointViewOf(BUDGETS, CATEGORIES)).toEqual(expect.objectContaining({ stale: false }));
    expect(jointViewOf({ ...BUDGETS, refreshError }, CATEGORIES))
      .toEqual(expect.objectContaining({ stale: true }));
    expect(jointViewOf(BUDGETS, { ...CATEGORIES, refreshError }))
      .toEqual(expect.objectContaining({ stale: true }));
  });
});

describe('alertOf', () => {
  const lists = { budgets: [budget('home', { name: 'Home' })], categories: [FOOD] };

  it('names the target and the budget that took it (409)', () => {
    const failure = {
      code: 'budget.target_already_claimed', params: { categoryId: 'food', budgetId: 'home' },
    };
    expect(alertOf(failure, lists, translator))
      .toBe('Food was just added to Home. The list is up to date: pick again.');
  });

  it('falls back to the code\'s own message when either can\'t be named', () => {
    const unknownBudget = {
      code: 'budget.target_already_claimed', params: { categoryId: 'food', budgetId: 'x' },
    };
    const unknownTarget = { code: 'budget.target_already_claimed', params: { budgetId: 'home' } };
    const fallback = 'This category already belongs to another budget.';
    expect(alertOf(unknownBudget, lists, translator)).toBe(fallback);
    expect(alertOf(unknownTarget, lists, translator)).toBe(fallback);
  });

  it('writes any other failure from its code, and nothing without one', () => {
    expect(alertOf({ code: 'budget.not_found' }, lists, translator)).toBe('Budget not found.');
    expect(alertOf(undefined, lists, translator)).toBeUndefined();
  });
});

describe('its panel', () => {
  it('shows a skeleton while a list loads', () => {
    renderFlow({ budgets: { status: 'loading' } });
    expect(screen.getByRole('status', { name: 'Loading the budgets' })).toBeTruthy();
  });

  it('offers a retry when a first load failed', async () => {
    const { onRetry } = renderFlow({ categories: { status: 'failed', error: { code: 'x' } } });
    expect(screen.getByText("Couldn't load the budgets.")).toBeTruthy();
    await press('Try again');
    expect(onRetry).toHaveBeenCalled();
  });

  it('keeps the list beside a banner and its retry when a refetch failed', async () => {
    const { onRetry } = renderFlow({ budgets: { ...BUDGETS, refreshError: { code: 'x' } } });
    expect(screen.getByText("Couldn't refresh the budgets, so the list may be out of date."))
      .toBeTruthy();
    expect(screen.getAllByTestId('card')).toHaveLength(2);
    await press('Try again');
    expect(onRetry).toHaveBeenCalled();
  });

  it('offers Add to every member, a Viewer\'s budget personal (OQ-194)', async () => {
    renderFlow({ role: 'Viewer' });
    await press('Add budget');
    expect(screen.getByTestId('drawer').dataset.personal).toBe('true');
  });

  it('hides Add from someone outside the household', () => {
    renderFlow({ role: undefined });
    expect(screen.queryByRole('button', { name: 'Add budget' })).toBeNull();
  });

  it('gates each card on who may manage it', () => {
    const budgets = [budget('mine'), budget('theirs', { ownerUserId: 'ben' })];
    renderFlow({ role: 'Member', budgets: { status: 'loaded', budgets } });
    expect(screen.getAllByTestId('card').map((card) => card.dataset.manage))
      .toEqual(['true', 'false']);
  });
});

describe('creating a budget', () => {
  it('sends the fields, closes the drawer and toasts the success', async () => {
    const { onCreate } = renderFlow();
    await press('Add budget');
    expect(screen.getByTestId('drawer').dataset.personal).toBe('false');
    await press('submit');
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Home',
      targetAmount: 500,
      currency: 'BRL',
      visibility: 'shared',
      targets: [{ categoryId: 'food' }],
    });
    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(toasts()).toEqual(['Home created.']);
  });

  it('keeps the drawer with its failure in the banner, not toasted', async () => {
    renderFlow({ onCreate: async () => ({ ok: false, error: { code: 'budget.not_found' } }) });
    await press('Add budget');
    await press('submit');
    expect(screen.getByTestId('drawer').dataset.alert).toBe('Budget not found.');
    expect(toasts()).toEqual([]);
  });

  it('holds the drawer while the request is out, and sends nothing more', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    const onCreate = vi.fn(() => new Promise<RequestOutcome>((resolve) => {
      answer = resolve;
    }));
    renderFlow({ onCreate });
    await press('Add budget');
    await press('submit');
    const drawer = screen.getByTestId('drawer');
    expect(drawer.dataset.busy).toBe('true');
    expect(drawer.dataset.disabled).toBe('true');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add budget' }).disabled)
      .toBe(true);
    await press('cancel drawer');
    await press('submit');
    expect(screen.getByTestId('drawer')).toBeTruthy();
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => answer({ ok: true }));
    expect(screen.queryByTestId('drawer')).toBeNull();
  });

  it('closes on cancel', async () => {
    renderFlow();
    await press('Add budget');
    await press('cancel drawer');
    expect(screen.queryByTestId('drawer')).toBeNull();
  });
});

describe('editing a budget', () => {
  it('opens the drawer about it and sends only what may change', async () => {
    const { onEdit } = renderFlow();
    await press('edit fun');
    expect(screen.getByTestId('drawer').dataset.budget).toBe('fun');
    await press('submit');
    expect(onEdit).toHaveBeenCalledWith({
      budgetId: 'fun', name: 'Home', targetAmount: 500, targets: [{ categoryId: 'food' }],
    });
    expect(toasts()).toEqual(['Home updated.']);
  });

  it('closes the drawer when its budget leaves the list', async () => {
    const requests = {
      onRetry: vi.fn(), onCreate: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
    };
    /**
     * Builds the Flow over a list.
     *
     * @param budgets - The list.
     * @returns The Flow.
     */
    const flow = (budgets: BudgetsView) => (
      <AlertProvider queue={queue}>
        <BudgetManagementFlow
          {...OWNER}
          budgets={budgets}
          categories={CATEGORIES}
          {...requests}
        />
      </AlertProvider>
    );
    const { rerenderInLocale } = renderInLocale(flow(BUDGETS));
    await press('edit fun');
    expect(screen.getByTestId('drawer')).toBeTruthy();
    rerenderInLocale(flow({ status: 'loaded', budgets: [budget('home')] }));
    expect(screen.queryByTestId('drawer')).toBeNull();
  });
});

describe('deleting a budget', () => {
  it('opens its confirm, deletes on a yes and toasts the success', async () => {
    const { onDelete } = renderFlow();
    await press('delete home');
    expect(screen.getByTestId('list').dataset.deleting).toBe('home');
    await press('confirm delete');
    expect(onDelete).toHaveBeenCalledWith('home');
    expect(screen.getByTestId('list').dataset.deleting).toBe('');
    expect(toasts()).toEqual(['home deleted.']);
  });

  it('marks the confirm whose delete is out', async () => {
    const onDelete = vi.fn(() => new Promise<RequestOutcome>(() => {}));
    renderFlow({ onDelete });
    await press('delete home');
    await press('confirm delete');
    expect(screen.getByTestId('list').dataset.out).toBe('home');
    expect(screen.getByTestId('list').dataset.busy).toBe('true');
  });

  it('toasts a failure and keeps the confirm open', async () => {
    renderFlow({ onDelete: async () => ({ ok: false, error: { code: 'budget.not_found' } }) });
    await press('delete home');
    await press('confirm delete');
    expect(toasts()).toEqual(['Budget not found.']);
    expect(screen.getByTestId('list').dataset.deleting).toBe('home');
  });

  it('closes the confirm on cancel, and sends nothing without one open', async () => {
    const { onDelete } = renderFlow();
    await press('delete home');
    await press('cancel delete');
    expect(screen.getByTestId('list').dataset.deleting).toBe('');
    await press('confirm delete');
    expect(onDelete).not.toHaveBeenCalled();
  });
});
