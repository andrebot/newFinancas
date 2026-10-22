import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import type { Budget, Category } from '@financas/api-types';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  alertOf, BudgetManagementFlow, failureToastOf, jointViewOf, type BudgetManagementFlowProps,
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
   * The list's stand-in: each budget's id, its manage gate and the opener.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  BudgetList: ({ budgets, isManageable, onEdit }: BudgetListProps) => (
    <div data-testid="list">
      {budgets.map((budget) => (
        <div key={budget.id} data-testid="card" data-manage={String(isManageable(budget))}>
          <button type="button" onClick={() => onEdit(budget.id)}>{`edit ${budget.id}`}</button>
        </div>
      ))}
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/accountSetup/flows/budgetManagement/interactions/BudgetDrawer', () => ({
  /**
   * The drawer's stand-in: its budget, state, a submit of fixed fields and
   * its delete zone's handlers.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  BudgetDrawer: ({
    budget, personalOnly, busy, disabled, alert, deleteConfirmOpen, deleteBusy, onOpenDelete,
    onDelete, onCloseDelete, onSubmit, onCancel,
  }: BudgetDrawerProps) => (
    <div
      data-testid="drawer"
      data-budget={budget?.id ?? ''}
      data-personal={String(personalOnly)}
      data-busy={String(busy)}
      data-disabled={String(disabled)}
      data-alert={alert ?? ''}
      data-deleting={String(deleteConfirmOpen)}
      data-delete-busy={String(deleteBusy)}
    >
      <button type="button" onClick={onOpenDelete}>open delete</button>
      <button type="button" onClick={onDelete}>confirm delete</button>
      <button type="button" onClick={onCloseDelete}>cancel delete</button>
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
  const lists = {
    budgets: [budget('home', { name: 'Home', targets: [{ categoryId: 'food' }] })],
    categories: [FOOD],
  };

  it('names the target and the budget that took it (409)', () => {
    const failure = {
      code: 'budget.target_already_claimed', params: { categoryId: 'food', budgetId: 'home' },
    };
    expect(alertOf(failure, lists, translator))
      .toBe('Food was just added to Home. The list is up to date: pick again.');
  });

  it('says when the budget took part of the category, or its whole category (FR-4.7)', () => {
    const snacks = {
      id: 'snacks', categoryId: 'food', name: 'Snacks', archivedAt: null, createdAt: FOOD.createdAt,
    };
    const categories = [{ ...FOOD, subcategories: [snacks] }];
    const conflict = (target: object, held: Budget['targets']) => alertOf(
      { code: 'budget.target_already_claimed', params: { ...target, budgetId: 'home' } },
      { budgets: [budget('home', { name: 'Home', targets: held })], categories },
      translator,
    );
    expect(conflict({ categoryId: 'food' }, [{ subcategoryId: 'snacks' }]))
      .toBe('Part of Food was just added to Home. The list is up to date: pick again.');
    expect(conflict({ subcategoryId: 'snacks' }, [{ categoryId: 'food' }])).toBe(
      'Food › Snacks was just covered by Home, which took its whole category. '
      + 'The list is up to date: pick again.',
    );
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

describe('failureToastOf', () => {
  it('says an edited budget was deleted meanwhile, by the name it had (OQ-194)', () => {
    const edit = { kind: 'edit', budgetId: 'fun' } as const;
    expect(failureToastOf(edit, { code: 'budget.not_found' }, 'Fun Money', translator))
      .toBe("Fun Money was deleted by someone else, so your changes weren't saved.");
  });

  it('writes any other failure from its code', () => {
    const remove = { kind: 'delete', budgetId: 'fun' } as const;
    expect(failureToastOf(remove, { code: 'budget.not_found' }, 'Fun Money', translator))
      .toBe('Budget not found.');
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
    renderFlow({ onCreate: async () => ({ ok: false, error: { code: 'auth.forbidden' } }) });
    await press('Add budget');
    await press('submit');
    expect(screen.getByTestId('drawer').dataset.alert)
      .toBe(translator.error('auth.forbidden'));
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

  it('keeps the drawer on a target claimed meanwhile, naming who took it (409)', async () => {
    const onEdit = vi.fn(async (): Promise<RequestOutcome> => ({
      ok: false,
      error: {
        code: 'budget.target_already_claimed', params: { categoryId: 'food', budgetId: 'home' },
      },
    }));
    renderFlow({
      budgets: {
        status: 'loaded',
        budgets: [
          budget('fun'), budget('home', { name: 'Home', targets: [{ categoryId: 'food' }] }),
        ],
      },
      onEdit,
    });
    await press('edit fun');
    await press('submit');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('drawer').dataset.alert)
      .toBe('Food was just added to Home. The list is up to date: pick again.');
    expect(toasts()).toEqual([]);
  });

  it('closes the drawer and says so when its budget was deleted meanwhile (404)', async () => {
    /**
     * Holds the list as the Experience does: an edit's 404 fetches it again,
     * now without the budget, before the Flow is answered.
     *
     * @returns The Flow over that list.
     */
    function Harness() {
      const [budgets, setBudgets] = useState<BudgetsView>(BUDGETS);
      const onEdit = async (): Promise<RequestOutcome> => {
        setBudgets({ status: 'loaded', budgets: [budget('home')] });
        return { ok: false, error: { code: 'budget.not_found' } };
      };
      return (
        <AlertProvider queue={queue}>
          <BudgetManagementFlow
            {...OWNER}
            budgets={budgets}
            categories={CATEGORIES}
            onRetry={vi.fn()}
            onCreate={vi.fn()}
            onEdit={onEdit}
            onDelete={vi.fn()}
          />
        </AlertProvider>
      );
    }
    renderInLocale(<Harness />);
    await press('edit fun');
    await press('submit');
    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(toasts()).toEqual(["fun was deleted by someone else, so your changes weren't saved."]);
    await press('Add budget');
    expect(screen.getByTestId('drawer').dataset.alert).toBe('');
  });
});

describe('deleting a budget', () => {
  /** The open drawer's stand-in. */
  const drawer = () => screen.getByTestId('drawer');

  it('opens its confirm in the edit drawer, deletes on a yes, closes and toasts', async () => {
    const { onDelete } = renderFlow();
    await press('edit home');
    await press('open delete');
    expect(drawer().dataset.deleting).toBe('true');
    await press('confirm delete');
    expect(onDelete).toHaveBeenCalledWith('home');
    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(toasts()).toEqual(['home deleted.']);
  });

  it('spins the confirm while the delete is out, the drawer waiting', async () => {
    const onDelete = vi.fn(() => new Promise<RequestOutcome>(() => {}));
    renderFlow({ onDelete });
    await press('edit home');
    await press('open delete');
    await press('confirm delete');
    expect(drawer().dataset.deleteBusy).toBe('true');
    expect(drawer().dataset.busy).toBe('false');
    expect(drawer().dataset.disabled).toBe('true');
  });

  it('toasts a failure and keeps the drawer and its confirm open', async () => {
    renderFlow({ onDelete: async () => ({ ok: false, error: { code: 'auth.forbidden' } }) });
    await press('edit home');
    await press('open delete');
    await press('confirm delete');
    expect(toasts()).toEqual([translator.error('auth.forbidden')]);
    expect(drawer().dataset.deleting).toBe('true');
    expect(drawer().dataset.alert).toBe('');
  });

  it('closes the confirm on cancel, and sends nothing without one open', async () => {
    const { onDelete } = renderFlow();
    await press('edit home');
    await press('open delete');
    await press('cancel delete');
    expect(drawer().dataset.deleting).toBe('false');
    await press('confirm delete');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('drops an open confirm when the drawer closes', async () => {
    renderFlow();
    await press('edit home');
    await press('open delete');
    await press('cancel drawer');
    await press('edit home');
    expect(drawer().dataset.deleting).toBe('false');
  });
});
