import { useState } from 'react';
import type { Budget, Category } from '@financas/api-types';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { EmptyState } from '../../../../kit/emptyState/EmptyState';
import { SkeletonRows } from '../../../../kit/skeleton/Skeleton';
import { useAlerts } from '../../../../utilities/AlertProvider';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { Translator } from '../../../../utilities/i18n';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import type { CategoriesView } from '../../sharedLists';
import {
  afterAction, budgetIn, deleteConfirmCancelled, deleteConfirmOpened, drawerClosed, drawerOpened,
  INITIAL_BUDGETS, isEditOfGone, mayCreateBudget, mayManageBudget, mayShareBudget, started,
  toastsFailure,
  type BudgetEdit, type BudgetManagementState, type BudgetsView, type NewBudget, type Outgoing,
} from './budgetManagementState';
import { conflictKindOf, targetName } from './claims';
import { BudgetDrawer } from './interactions/BudgetDrawer';
import { BudgetList } from './interactions/BudgetList';

// The Budget Management Flow (FL13, mockup 42; FR-4, OQ-176, OQ-194): the
// budgets the caller can see as cards — add one with its name, currency,
// visibility, monthly target and the categories it covers, edit it in the
// same drawer (currency and visibility locked), and delete it behind an
// inline confirm (a hard delete, FR-4.10). The budgets and the categories are
// the Account Setup Experience's and come in as display state; the Flow owns
// what is out, the open drawer, the delete confirm and the last failure. A
// success is toasted; a form's failure shows in the drawer's banner — a
// target claimed meanwhile names who took it, the list having been fetched
// again — and a delete's failure is toasted. It never calls the backend.

/** What the Flow asks of the Experience. */
export interface BudgetManagementFlowProps {
  /** The signed-in user's id: whose personal budgets are whose. */
  readonly selfUserId: string;
  /** Their role in this household (FR-1.7). */
  readonly role?: string | undefined;
  /** Every shared budget and the caller's personal ones, by name. */
  readonly budgets: BudgetsView;
  /** The household's categories, archived included, for the picker. */
  readonly categories: CategoriesView;
  /** Fetches both lists again (a retry). */
  readonly onRetry: () => void;
  /** `POST /households/:id/budgets`. */
  readonly onCreate: (budget: NewBudget) => Promise<RequestOutcome>;
  /** `PATCH /households/:id/budgets/:budgetId`. */
  readonly onEdit: (edit: BudgetEdit) => Promise<RequestOutcome>;
  /** `DELETE /households/:id/budgets/:budgetId`. */
  readonly onDelete: (budgetId: string) => Promise<RequestOutcome>;
}

/** What a failure is written from: the lists, to name a 409's target and budget. */
interface FailureContext {
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
}

/** The banner for each way a claimed target overlaps its claimer (409). */
const CONFLICT_KEYS = {
  same: 'conflict',
  partly: 'conflict.partly',
  covered: 'conflict.covered',
} as const;

/**
 * Writes a failure for the drawer's banner. A target claimed meanwhile (409)
 * names the target and the budget that took it when both are listed — and
 * whether that budget took it, part of it, or its whole category; any other
 * failure is the error code's own message.
 *
 * @param failure - The failure, if any.
 * @param context - The lists as they stand.
 * @param translator - The texts.
 * @returns The message, or nothing without a failure.
 */
export const alertOf = (
  failure: RequestFailure | undefined,
  context: FailureContext,
  translator: Translator,
): string | undefined => {
  if (failure === undefined) return undefined;
  const params = failure.params ?? {};
  const target = targetName(context.categories, params);
  const budget = context.budgets.find((candidate) => candidate.id === params.budgetId);
  if (failure.code === 'budget.target_already_claimed' && target && budget) {
    const key = CONFLICT_KEYS[conflictKindOf(params, budget)];
    return translator.text('budgetManagement', key, { target, budget: budget.name });
  }
  return translator.error(failure.code, failure.params);
};

/**
 * Writes a toasted failure: an edit whose budget is gone says so by the name
 * it had, as its drawer closes (OQ-194); any other is the error code's own
 * message.
 *
 * @param outgoing - The request that failed.
 * @param failure - Why.
 * @param name - The budget's name before the request went out.
 * @param translator - The texts.
 * @returns The toast's message.
 */
export const failureToastOf = (
  outgoing: Outgoing,
  failure: RequestFailure,
  name: string,
  translator: Translator,
): string => (
  isEditOfGone(outgoing, failure)
    ? translator.text('budgetManagement', 'edit.gone', { name })
    : translator.error(failure.code, failure.params)
);

/**
 * Reads the two lists together: loaded once both are, failed if either's
 * first load failed, loading otherwise.
 *
 * @param budgets - The budgets' view.
 * @param categories - The categories' view.
 * @returns Both lists with the latest refetch failure, or the joint status.
 */
export const jointViewOf = (budgets: BudgetsView, categories: CategoriesView) => {
  if (budgets.status === 'failed' || categories.status === 'failed') {
    return { status: 'failed' } as const;
  }
  if (budgets.status === 'loading' || categories.status === 'loading') {
    return { status: 'loading' } as const;
  }
  return {
    status: 'loaded',
    budgets: budgets.budgets,
    categories: categories.categories,
    stale: budgets.refreshError !== undefined || categories.refreshError !== undefined,
  } as const;
};

/**
 * Finds the budget the open edit drawer is about.
 *
 * @param budgets - The loaded budgets.
 * @param state - The Flow's state.
 * @returns It, or nothing while no edit drawer is open (or it is gone).
 */
const editTargetOf = (budgets: readonly Budget[], state: BudgetManagementState) => {
  const { drawer } = state;
  if (drawer?.kind !== 'edit') return undefined;
  return budgets.find((budget) => budget.id === drawer.budgetId);
};

/**
 * Tells whether the open drawer's own request is out: a create or an edit.
 *
 * @param out - The request that is out, if any.
 * @returns Whether the drawer's submit spins.
 */
const isFormOut = (out: Outgoing | undefined) => out !== undefined && out.kind !== 'delete';

/**
 * Names the budget whose delete is out, so only its confirm spins.
 *
 * @param out - The request that is out, if any.
 * @returns That budget's id, or nothing while no delete is out.
 */
const deletingOutOf = (out: Outgoing | undefined) => (
  out?.kind === 'delete' ? out.budgetId : undefined
);

/** The loaded panel's props: both lists, the state and the Flow's handlers. */
interface BudgetsPanelProps {
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  readonly state: BudgetManagementState;
  readonly selfUserId: string;
  readonly role?: string | undefined;
  readonly onSubmit: (fields: NewBudget) => void;
  readonly onConfirmDelete: () => void;
  readonly setState: (update: (state: BudgetManagementState) => BudgetManagementState) => void;
}

/**
 * Renders the loaded grid and whatever drawer is open.
 *
 * @param props - The lists, the state, the actor and the handlers.
 * @returns The grid and its drawer.
 */
function BudgetsPanel({
  budgets, categories, state, selfUserId, role, onSubmit, onConfirmDelete, setState,
}: BudgetsPanelProps) {
  const translator = useI18n();
  const { out } = state;
  const editTarget = editTargetOf(budgets, state);
  const drawerOpen = state.drawer?.kind === 'create' || editTarget !== undefined;

  /**
   * Applies one transition to the Flow's state.
   *
   * @param transition - The transition, given the budget it is about.
   * @returns A handler taking that budget's id.
   */
  const onBudget = (
    transition: (current: BudgetManagementState, budgetId: string) => BudgetManagementState,
  ) => (budgetId: string) => setState((current) => transition(current, budgetId));

  return (
    <>
      <BudgetList
        budgets={budgets}
        categories={categories}
        isManageable={(budget) => mayManageBudget(budget, selfUserId, role)}
        busy={out !== undefined}
        deletingOut={deletingOutOf(out)}
        deleting={state.deleting}
        onEdit={onBudget((current, budgetId) => drawerOpened(current, { kind: 'edit', budgetId }))}
        onDeleteRequest={onBudget(deleteConfirmOpened)}
        onConfirmDelete={onConfirmDelete}
        onCancelDelete={() => setState(deleteConfirmCancelled)}
      />
      {drawerOpen && (
        <BudgetDrawer
          key={editTarget?.id ?? 'create'}
          budget={editTarget}
          categories={categories}
          budgets={budgets}
          selfUserId={selfUserId}
          personalOnly={!mayShareBudget(role)}
          busy={isFormOut(out)}
          disabled={out !== undefined}
          alert={alertOf(state.lastError, { budgets, categories }, translator)}
          onSubmit={onSubmit}
          onCancel={() => setState(drawerClosed)}
        />
      )}
    </>
  );
}

/**
 * Renders the budgets panel and runs its requests.
 *
 * @param props - The actor, their role, the Experience's lists and its requests.
 * @returns The panel with whatever drawer or confirm is open.
 */
export function BudgetManagementFlow({
  selfUserId, role, budgets: budgetsView, categories: categoriesView, onRetry, onCreate, onEdit,
  onDelete,
}: BudgetManagementFlowProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const [state, setState] = useState<BudgetManagementState>(INITIAL_BUDGETS);
  const view = jointViewOf(budgetsView, categoriesView);

  /**
   * Sends a request and applies its answer: a success closes what it came
   * from and is toasted; a form's failure stays in its banner, a delete's —
   * and an edit's whose budget is gone — is toasted. One request at a time.
   *
   * @param outgoing - Which request goes out.
   * @param subject - The budget's name for the toast, as sent.
   * @param request - The Experience's request for it.
   */
  const run = async (
    outgoing: Outgoing,
    subject: string,
    request: () => Promise<RequestOutcome>,
  ) => {
    if (state.out) return;
    // Read before the request: the list fetched again may no longer hold it.
    // A create has no budget yet, so its name is the one sent.
    const budgetId = 'budgetId' in outgoing ? outgoing.budgetId : undefined;
    const former = budgetIn(budgetsView, budgetId)?.name ?? subject;
    setState((current) => started(current, outgoing));
    const outcome = await request();
    setState((current) => afterAction(current, outcome));
    if (outcome.ok) {
      alerts.success(
        translator.text('budgetManagement', `${outgoing.kind}.done`, { name: subject }),
      );
    } else if (toastsFailure(outgoing, outcome.error)) {
      alerts.error(failureToastOf(outgoing, outcome.error, former, translator));
    }
  };

  /**
   * Sends the open drawer's fields: a create, or an edit of its budget.
   *
   * @param fields - The form's fields as they passed.
   */
  const submit = (fields: NewBudget) => {
    const { drawer } = state;
    if (drawer?.kind === 'edit') {
      const edit = {
        budgetId: drawer.budgetId,
        name: fields.name,
        targetAmount: fields.targetAmount,
        targets: fields.targets,
      };
      run({ kind: 'edit', budgetId: drawer.budgetId }, fields.name, () => onEdit(edit));
      return;
    }
    run({ kind: 'create' }, fields.name, () => onCreate(fields));
  };

  /** Confirms the open delete of its budget. */
  const confirmDelete = () => {
    const target = budgetIn(budgetsView, state.deleting);
    if (target === undefined) return;
    run({ kind: 'delete', budgetId: target.id }, target.name, () => onDelete(target.id));
  };

  if (view.status === 'failed') {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('budgetManagement', 'load.failed')}
        action={<Button onClick={onRetry}>{translator.text('budgetManagement', 'retry')}</Button>}
      />
    );
  }
  if (view.status === 'loading') {
    return <SkeletonRows label={translator.text('budgetManagement', 'loading')} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {view.stale && (
        <InlineBanner
          tone="error"
          message={translator.text('budgetManagement', 'refresh.failed')}
          action={(
            <Button variant="ghost" onClick={onRetry}>
              {translator.text('budgetManagement', 'retry')}
            </Button>
          )}
        />
      )}
      <div className="flex items-center justify-between gap-4">
        <p className="type-body-sm text-muted">
          {translator.text('budgetManagement', 'description')}
        </p>
        {mayCreateBudget(role) && (
          <Button
            variant="primary"
            leadingIcon="add"
            disabled={state.out !== undefined}
            onClick={() => setState((current) => drawerOpened(current, { kind: 'create' }))}
          >
            {translator.text('budgetManagement', 'add')}
          </Button>
        )}
      </div>
      <BudgetsPanel
        budgets={view.budgets}
        categories={view.categories}
        state={state}
        selfUserId={selfUserId}
        role={role}
        onSubmit={submit}
        onConfirmDelete={confirmDelete}
        setState={setState}
      />
    </div>
  );
}
