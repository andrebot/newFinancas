import { act, fireEvent, screen } from '@testing-library/react';
import type {
  Account, Budget, Category,
} from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { NewAccount } from '../../../../../../src/experiences/accountSetup/flows/accountManagement/accountManagementState';
import type { NewBudget } from '../../../../../../src/experiences/accountSetup/flows/budgetManagement/budgetManagementState';
import type { BudgetsView, CategoriesView } from '../../../../../../src/experiences/accountSetup/sharedLists';
import {
  GuidedSetupFlow, type GuidedSetupFlowProps,
} from '../../../../../../src/experiences/onboard/flows/guidedSetup/GuidedSetupFlow';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';
import { deferred } from '../../../experienceFakes';

// The Guided Setup Flow (BDT: Flow, unit, the Interactions beneath mocked —
// and the Category Management Flow it hosts). Each stub shows the props it got
// as data attributes and emits its events from plain buttons; the Experience
// is represented by stub requests answering outcomes. FR-1.22: the account
// step has no way on without an account; the other two do.

vi.mock('../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/FirstAccountEntry', () => ({
  /**
   * First Account Entry's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  FirstAccountEntry: ({
    busy, alert, personalOnly, onSubmit, onCancel,
  }: {
    busy: boolean;
    alert?: string;
    personalOnly: boolean;
    onSubmit: (account: NewAccount) => void;
    onCancel?: () => void;
  }) => (
    <div
      data-testid="account-entry"
      data-busy={String(busy)}
      data-alert={alert ?? ''}
      data-personal={String(personalOnly)}
    >
      <button
        type="button"
        onClick={() => onSubmit({
          name: 'Main',
          type: 'checking',
          currency: 'BRL',
          visibility: 'shared',
          openingBalance: null,
          cards: [],
        })}
      >
        submit account
      </button>
      {onCancel && <button type="button" onClick={onCancel}>cancel account</button>}
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/BudgetEntry', () => ({
  /**
   * Budget Entry's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  BudgetEntry: ({
    budget, busy, alert, personalOnly, discardConfirmOpen, onCreate, onEdit, onCancelEdit, onBack,
    onFinish, onDiscard, onKeepEditing,
  }: {
    budget?: Budget;
    busy: boolean;
    alert?: string;
    personalOnly: boolean;
    discardConfirmOpen: boolean;
    onCreate: (budget: NewBudget) => void;
    onEdit: (edit: { budgetId: string; name: string; targetAmount: number; targets: [] }) => void;
    onCancelEdit: () => void;
    onBack: () => void;
    onFinish: (unsaved: boolean) => void;
    onDiscard: () => void;
    onKeepEditing: () => void;
  }) => (
    <div
      data-testid="budget-entry"
      data-budget={budget?.id ?? ''}
      data-busy={String(busy)}
      data-alert={alert ?? ''}
      data-personal={String(personalOnly)}
      data-confirm={String(discardConfirmOpen)}
    >
      <button
        type="button"
        onClick={() => onCreate({
          name: 'Food', targetAmount: 100, currency: 'BRL', visibility: 'shared', targets: [],
        })}
      >
        create budget
      </button>
      <button
        type="button"
        onClick={() => onEdit({
          budgetId: 'b1', name: 'Fun', targetAmount: 100, targets: [],
        })}
      >
        edit budget
      </button>
      <button type="button" onClick={onCancelEdit}>cancel edit</button>
      <button type="button" onClick={onBack}>budget back</button>
      <button type="button" onClick={() => onFinish(false)}>finish clean</button>
      <button type="button" onClick={() => onFinish(true)}>finish unsaved</button>
      <button type="button" onClick={onDiscard}>discard</button>
      <button type="button" onClick={onKeepEditing}>keep editing</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/WizardNavigation', () => ({
  /**
   * Wizard Navigation's stand-in: its actions as plain buttons.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  WizardNavigation: ({ primary, secondary, onBack }: {
    primary: { label: string; onClick: () => void };
    secondary?: { label: string; onClick: () => void };
    onBack?: () => void;
  }) => (
    <div>
      {onBack && <button type="button" onClick={onBack}>nav back</button>}
      {secondary && <button type="button" onClick={secondary.onClick}>{secondary.label}</button>}
      <button type="button" onClick={primary.onClick}>{primary.label}</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/SetupDoneRow', () => ({
  /**
   * A done row's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  SetupDoneRow: ({ title, detail, trailing }: {
    title: string;
    detail?: string;
    trailing?: React.ReactNode;
  }) => (
    <li data-testid="done-row">
      {title}
      {' | '}
      {detail}
      {trailing}
    </li>
  ),
}));

vi.mock('../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/SetupCompleteSummary', () => ({
  /**
   * The summary's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  SetupCompleteSummary: ({ householdName, summary, onFinish }: {
    householdName: string;
    summary: object;
    onFinish: (destination: string) => void;
  }) => (
    <div
      data-testid="summary"
      data-household={householdName}
      data-summary={JSON.stringify(summary)}
    >
      <button type="button" onClick={() => onFinish('household')}>go</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow', () => ({
  /**
   * The hosted Category Management Flow's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  CategoryManagementFlow: ({ role }: { role?: string }) => (
    <div data-testid="categories-flow" data-role={role ?? ''} />
  ),
}));

/**
 * Builds an account.
 *
 * @param id - Its id, also its name.
 * @returns The account.
 */
const account = (id: string): Account => ({
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
  cards: [],
} as unknown as Account);

const DINING: Category = {
  id: 'dining',
  householdId: 'doe',
  name: 'Dining',
  icon: 'restaurant',
  color: 'sun',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [],
};

const FUN: Budget = {
  id: 'b1',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Fun Money',
  targetAmount: 30000,
  currency: 'BRL',
  visibility: 'shared',
  targets: [{ categoryId: 'dining' }],
  createdAt: '2026-10-01T00:00:00Z',
};

// Passed as a spread: a literal `role` attribute reads as an ARIA role to the linter.
const OWNER = { selfUserId: 'jane', role: 'Owner' };

const CATEGORIES: CategoriesView = { status: 'loaded', categories: [DINING] };
const BUDGETS: BudgetsView = { status: 'loaded', budgets: [FUN] };
const OK: RequestOutcome = { ok: true };

/**
 * Renders the Flow with stub requests, the household's accounts empty unless overridden.
 *
 * @param props - The props to set or override.
 * @returns The stubs.
 */
const renderFlow = (props: Partial<GuidedSetupFlowProps> = {}) => {
  const stubs = {
    onLoadAccounts: vi.fn(async () => ({ ok: true as const, data: [] as Account[] })),
    onCreateAccount: vi.fn(async () => ({ ok: true as const, data: account('Main') })),
    onRetryBudgets: vi.fn(),
    onCreateBudget: vi.fn(async () => OK),
    onEditBudget: vi.fn(async () => OK),
    onFinish: vi.fn(),
    ...props,
  };
  const categories = {
    categories: CATEGORIES,
    onRetry: vi.fn(),
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onAddSubcategory: vi.fn(),
    onArchiveCategory: vi.fn(),
    onArchiveSubcategory: vi.fn(),
    ...props.categories,
  };
  renderInLocale(
    <GuidedSetupFlow
      householdName="The Doe Family"
      {...OWNER}
      budgets={BUDGETS}
      {...stubs}
      categories={categories}
    />,
  );
  return { ...stubs, categories };
};

/** Lets the pending answers land. */
const settle = async () => {
  await act(async () => {});
};

/**
 * Presses a button by its name, letting what it sends settle.
 *
 * @param name - The button's name.
 */
const press = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

/** Renders the Flow and walks it to the budget step. */
const toBudgetStep = async (props: Partial<GuidedSetupFlowProps> = {}) => {
  const stubs = renderFlow(props);
  await settle();
  await press('submit account');
  await press('Looks good, continue');
  return stubs;
};

describe('the account step (FR-1.22)', () => {
  it('loads the accounts and shows the form, step 1 of 3, with no way on', async () => {
    const stubs = renderFlow();
    await settle();
    expect(stubs.onLoadAccounts).toHaveBeenCalledOnce();
    expect(screen.getByText('Getting started · step 1 of 3')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Add your first account' })).toBeTruthy();
    expect(screen.getByTestId('account-entry').dataset.personal).toBe('false');
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('creates the account and moves to the categories', async () => {
    const stubs = renderFlow();
    await settle();
    await press('submit account');
    expect(stubs.onCreateAccount).toHaveBeenCalledWith(expect.objectContaining({ name: 'Main' }));
    expect(screen.getByText('Getting started · step 2 of 3')).toBeTruthy();
    expect(screen.getByTestId('categories-flow').dataset.role).toBe('Owner');
  });

  it('keeps the form with the failure in its banner', async () => {
    renderFlow({
      onCreateAccount: vi.fn(async () => ({
        ok: false as const, error: { code: 'network.unavailable' },
      })),
    });
    await settle();
    await press('submit account');
    expect(screen.getByTestId('account-entry').dataset.alert).toMatch(/connect/i);
  });

  it('spins while the create is out and sends one at a time', async () => {
    const pending = deferred();
    const onCreateAccount = vi.fn(async () => {
      await pending.promise;
      return { ok: true as const, data: account('Main') };
    });
    renderFlow({ onCreateAccount });
    await settle();
    await press('submit account');
    expect(screen.getByTestId('account-entry').dataset.busy).toBe('true');
    await press('submit account');
    expect(onCreateAccount).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve(new Response());
    });
    expect(screen.getByTestId('categories-flow')).toBeTruthy();
  });

  it('makes a Viewer’s account personal', async () => {
    renderFlow({ role: 'Viewer' });
    await settle();
    expect(screen.getByTestId('account-entry').dataset.personal).toBe('true');
  });

  it('says when the accounts can’t be loaded, and loads them again', async () => {
    const onLoadAccounts = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'network.unavailable' } })
      .mockResolvedValueOnce({ ok: true, data: [account('Main')] });
    renderFlow({ onLoadAccounts });
    await settle();
    expect(screen.getByText('Couldn’t load your accounts.'.replace('’', "'"))).toBeTruthy();
    expect(screen.getByTestId('account-entry')).toBeTruthy();
    await press('Try again');
    expect(onLoadAccounts).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('done-row').textContent).toContain('Main');
  });

  it('shows the loading accounts while they are fetched', () => {
    renderFlow({ onLoadAccounts: vi.fn(() => new Promise<never>(() => {})) });
    expect(screen.getByRole('status', { name: 'Loading your accounts' })).toBeTruthy();
  });

  it('drops an answer that lands after the Flow is gone', async () => {
    const pending = deferred();
    const { unmount } = renderInLocale(
      <GuidedSetupFlow
        householdName="Doe"
        selfUserId="jane"
        budgets={BUDGETS}
        onLoadAccounts={async () => {
          await pending.promise;
          return { ok: true, data: [] };
        }}
        onCreateAccount={vi.fn()}
        categories={{ categories: CATEGORIES } as GuidedSetupFlowProps['categories']}
        onRetryBudgets={vi.fn()}
        onCreateBudget={vi.fn()}
        onEditBudget={vi.fn()}
        onFinish={vi.fn()}
      />,
    );
    unmount();
    await act(async () => {
      pending.resolve(new Response());
    });
    expect(screen.queryByTestId('account-entry')).toBeNull();
  });
});

describe('the account step once there is an account', () => {
  /** Renders the Flow with one account already in the household. */
  const renderWithAccount = async () => {
    const stubs = renderFlow({
      onLoadAccounts: vi.fn(async () => ({
        ok: true as const,
        data: [account('Main'), { ...account('Old'), archivedAt: '2026-10-01T00:00:00Z' }],
      })),
    });
    await settle();
    return stubs;
  };

  it('lists the accounts in use, offering another and Continue', async () => {
    await renderWithAccount();
    expect(screen.getByRole('heading', { name: 'Your accounts' })).toBeTruthy();
    expect(screen.getAllByTestId('done-row')).toHaveLength(1);
    expect(screen.getByTestId('done-row').textContent).toBe('Main | Checking · BRL');
    expect(screen.queryByTestId('account-entry')).toBeNull();
  });

  it('opens the form for another, and closes it again', async () => {
    await renderWithAccount();
    await press('Add another account');
    expect(screen.getByTestId('account-entry')).toBeTruthy();
    await press('cancel account');
    expect(screen.queryByTestId('account-entry')).toBeNull();
  });

  it('continues to the categories', async () => {
    await renderWithAccount();
    await press('Continue');
    expect(screen.getByTestId('categories-flow')).toBeTruthy();
  });
});

describe('the categories step', () => {
  it('goes back to the accounts, and on to the budget', async () => {
    renderFlow();
    await settle();
    await press('submit account');
    expect(screen.getByRole('heading', { name: 'Review your categories' })).toBeTruthy();
    await press('nav back');
    expect(screen.getByRole('heading', { name: 'Your accounts' })).toBeTruthy();
    await press('Continue');
    await press('Looks good, continue');
    expect(screen.getByText('Getting started · step 3 of 3')).toBeTruthy();
  });
});

describe('the budget step', () => {
  it('lists the budgets made so far, each with what it covers', async () => {
    await toBudgetStep();
    expect(screen.getByTestId('done-row').textContent).toContain('Fun Money · R$');
    expect(screen.getByTestId('done-row').textContent).toContain('| Dining');
    expect(screen.getByText('Add another')).toBeTruthy();
    expect(screen.getByTestId('budget-entry').dataset.budget).toBe('');
  });

  it('loads a budget into the form from its Edit, and back to a create', async () => {
    await toBudgetStep();
    await press('Edit Fun Money');
    expect(screen.getByTestId('budget-entry').dataset.budget).toBe('b1');
    expect(screen.queryByText('Add another')).toBeNull();
    await press('cancel edit');
    expect(screen.getByTestId('budget-entry').dataset.budget).toBe('');
  });

  it('offers no Edit on a budget the caller can’t manage', async () => {
    await toBudgetStep({
      role: 'Member', budgets: { status: 'loaded', budgets: [{ ...FUN, ownerUserId: 'john' }] },
    });
    expect(screen.queryByRole('button', { name: 'Edit Fun Money' })).toBeNull();
  });

  it('sends a create and an edit', async () => {
    const stubs = await toBudgetStep();
    await press('create budget');
    expect(stubs.onCreateBudget).toHaveBeenCalledWith(expect.objectContaining({ name: 'Food' }));
    await press('edit budget');
    expect(stubs.onEditBudget).toHaveBeenCalledWith(expect.objectContaining({ budgetId: 'b1' }));
  });

  it('spins while a save is out', async () => {
    const pending = deferred();
    await toBudgetStep({
      onCreateBudget: vi.fn(async () => {
        await pending.promise;
        return OK;
      }),
    });
    await press('create budget');
    expect(screen.getByTestId('budget-entry').dataset.busy).toBe('true');
    await act(async () => {
      pending.resolve(new Response());
    });
    expect(screen.getByTestId('budget-entry').dataset.busy).toBe('false');
  });

  it('names the budget that took a target meanwhile (409)', async () => {
    await toBudgetStep({
      onCreateBudget: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'budget.target_already_claimed', params: { categoryId: 'dining', budgetId: 'b1' },
        },
      })),
    });
    await press('create budget');
    expect(screen.getByTestId('budget-entry').dataset.alert)
      .toBe('Dining was just added to Fun Money. The list is up to date: pick again.');
  });

  it('makes a Viewer’s budget personal', async () => {
    await toBudgetStep({ role: 'Viewer' });
    expect(screen.getByTestId('budget-entry').dataset.personal).toBe('true');
  });

  it('shows the lists loading', async () => {
    await toBudgetStep({ budgets: { status: 'loading' } });
    expect(screen.getByRole('status', { name: 'Loading the budgets' })).toBeTruthy();
  });

  it('says when the lists can’t be loaded, and fetches both again', async () => {
    const stubs = await toBudgetStep({ budgets: { status: 'failed', error: { code: 'x' } } });
    await press('Try again');
    expect(stubs.onRetryBudgets).toHaveBeenCalledOnce();
    expect(stubs.categories.onRetry).toHaveBeenCalledOnce();
  });

  it('goes back to the categories', async () => {
    await toBudgetStep();
    await press('budget back');
    expect(screen.getByTestId('categories-flow')).toBeTruthy();
  });

  it('omits the list and its divider while there are no budgets', async () => {
    await toBudgetStep({ budgets: { status: 'loaded', budgets: [] } });
    expect(screen.queryByTestId('done-row')).toBeNull();
    expect(screen.queryByText('Add another')).toBeNull();
  });
});

describe('finishing', () => {
  it('opens the summary with the counts, and emits where to go', async () => {
    const stubs = await toBudgetStep();
    await press('finish clean');
    const summary = screen.getByTestId('summary');
    expect(summary.dataset.household).toBe('The Doe Family');
    expect(JSON.parse(summary.dataset.summary ?? '')).toEqual({
      accounts: 1, cards: 0, categories: 1, budgets: 1,
    });
    await press('go');
    expect(stubs.onFinish).toHaveBeenCalledWith('household');
  });

  it('asks first when a budget is unsaved, then keeps it or drops it', async () => {
    await toBudgetStep();
    await press('finish unsaved');
    expect(screen.getByTestId('budget-entry').dataset.confirm).toBe('true');
    await press('keep editing');
    expect(screen.getByTestId('budget-entry').dataset.confirm).toBe('false');
    await press('finish unsaved');
    await press('discard');
    expect(screen.getByTestId('summary')).toBeTruthy();
  });
});
