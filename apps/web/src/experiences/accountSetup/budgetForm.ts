import type {
  Budget, BudgetTargetInput, Category, Currency,
} from '@financas/api-types';
import type { Translator } from '../../utilities/i18n';
import type { RequestFailure } from '../../utilities/requestOutcome';
import { nonBlank } from '../../utilities/validation';
import {
  conflictKindOf, isEmptyPick, NO_PICKS, picksOf, targetName, type Picks, type Visibility,
} from './budgetClaims';
import type { BudgetsView, CategoriesView } from './sharedLists';

// A budget's form and how it reads (FL13, FL6; OQ-176, OQ-194, OQ-196): the
// fields a form opens with, its checks before a send, the banner a failure
// shows, the chips a budget's covers read as, and the budgets and categories
// read together. Budget Management's drawer and Guided Setup's budget step
// both build a budget, so they read these here rather than from each other
// (EBD: no sideways calls), as ownership.ts holds who may manage one.

/** The form's refusals, already translated, by field. */
export interface Objections {
  readonly name?: string | undefined;
  readonly target?: string | undefined;
  readonly covers?: string | undefined;
}

/**
 * Checks the form before it is sent.
 *
 * @param name - The typed name.
 * @param target - The monthly target in minor units, or nothing typed.
 * @param picks - What is ticked and still free.
 * @param translator - The texts.
 * @returns Each field's refusal, if any.
 */
export const objectionsOf = (
  name: string,
  target: number | null,
  picks: Picks,
  translator: Translator,
): Objections => {
  const blank = nonBlank(name);
  return {
    name: blank && translator.field(blank.code, blank.params),
    target: target === null || target < 1
      ? translator.text('budgetManagement', 'error.target')
      : undefined,
    covers: isEmptyPick(picks) ? translator.text('budgetManagement', 'error.covers') : undefined,
  };
};

/**
 * Tells whether the form may be sent.
 *
 * @param objections - The form's refusals.
 * @returns Whether none is set.
 */
export const passes = (objections: Objections) => Object.values(objections).every(
  (objection) => objection === undefined,
);

/** What the form starts from. */
export interface InitialFields {
  readonly name: string;
  readonly currency: Currency;
  readonly visibility: Visibility;
  readonly target: number | null;
  /** What the edited budget holds on the server: nothing on a create. */
  readonly held: Picks;
}

/**
 * Builds the form's starting fields: the budget's on an edit; on a create, an
 * empty form in BRL, shared unless the actor can't share (mockup 42).
 *
 * @param budget - The budget an edit is about, if any.
 * @param personalOnly - The actor can't share (a Viewer).
 * @returns The fields the form opens with.
 */
export const initialFieldsOf = (
  budget: Budget | undefined,
  personalOnly: boolean,
): InitialFields => (budget
  ? {
    name: budget.name,
    currency: budget.currency,
    visibility: budget.visibility,
    target: budget.targetAmount,
    held: picksOf(budget.targets),
  }
  : {
    name: '',
    currency: 'BRL',
    visibility: personalOnly ? 'personal' : 'shared',
    target: null,
    held: NO_PICKS,
  });

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

/** What a covered target's chip shows: its name and its category's look. */
interface CoverChip {
  readonly key: string;
  readonly name: string;
  readonly category: Category;
}

/**
 * Builds the chips a card lists under "Covers", in the budget's order. A
 * target not among the categories (none should be) is left out.
 *
 * @param targets - The budget's targets.
 * @param categories - The household's categories, archived included.
 * @returns One chip per target found: a subcategory carries its category's look.
 */
export const coverChipsOf = (
  targets: readonly BudgetTargetInput[],
  categories: readonly Category[],
): CoverChip[] => targets.flatMap((target) => {
  const category = categories.find((candidate) => (
    candidate.id === target.categoryId
    || candidate.subcategories.some((subcategory) => subcategory.id === target.subcategoryId)
  ));
  const name = targetName(categories, target);
  if (!category || name === undefined) return [];
  // Exactly one of the ids is set (OQ-176); names aren't unique, so the key is the id.
  return [{ key: String(target.categoryId ?? target.subcategoryId), name, category }];
});
