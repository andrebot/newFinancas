import type {
  Budget, BudgetChanges, BudgetMonth, BudgetPeriod, BudgetTarget, TargetRejection,
} from '../../accessors/budgetAccessor';
import { monthKey, monthOf, type MonthRange } from '../../accessors/calendarMonth';
import type { ClaimedCategories } from '../../accessors/ledgerQuery';
import type { Category } from '../../accessors/categoryAccessor';
import type { Visibility } from '../../db/schema/values';
import { validationFailed, type DomainError } from '../../utilities/domainError';
import type { DataAction } from '../../utilities/authorization';
import { checkFields, nonBlank, type FieldDetail } from '../../utilities/validation';
import { accessToOwned, memberOnly, requireAccess } from '../access';
import { spendByMonth } from '../budgetSpend';
import type { SignedInContext } from '../requestContext';
import { requireNoProblems } from '../validation';
import {
  requestLogger, todayOf, type AccountDeps, type AccountStores,
} from './context';
import { budgetNotFound, targetAlreadyClaimed } from './errors';

// Budgets (budget-spending/uc-01..03, FR-4). A Budget is personal (its owner's
// alone) or shared (the permission table, plus a Member may edit what they
// created — OQ-111), like an Account. Its targets are whole Categories or single
// Subcategories, claimed once per scope (FR-4.7, OQ-166). Spend against target
// is the Budget status read, not this definition's (OQ-176) — but a new Budget,
// or one whose claims change, has its spend restated from this month on, from
// the transactions already in its scope (OQ-166, PR #145).

/** A target as the route validated it: the contract can't say "exactly one" (OQ-176). */
export interface TargetInput {
  readonly categoryId?: string | undefined;
  readonly subcategoryId?: string | undefined;
}

/** A Budget to create, as the route validated it. */
export interface BudgetInput {
  readonly name: string;
  /** Minor units, more than zero. */
  readonly targetAmount: number;
  readonly currency: string;
  readonly visibility: Visibility;
  readonly targets: readonly TargetInput[];
}

/** A Budget edit as the route validated it: any field may be left out; never the scope. */
export interface BudgetEdit {
  readonly name?: string | undefined;
  readonly targetAmount?: number | undefined;
  readonly targets?: readonly TargetInput[] | undefined;
}

/**
 * The claim a target names, or `undefined` unless exactly one id is set.
 *
 * @param input - The target as sent.
 * @returns The claim.
 */
export const targetOf = (input: TargetInput): BudgetTarget | undefined => {
  if (input.categoryId !== undefined && input.subcategoryId === undefined) {
    return { categoryId: input.categoryId };
  }
  if (input.subcategoryId !== undefined && input.categoryId === undefined) {
    return { subcategoryId: input.subcategoryId };
  }
  return undefined;
};

/**
 * The id a claim names, the same for a Category and a Subcategory (both UUIDv7).
 *
 * @param target - The claim.
 * @returns Its id.
 */
const idOf = (target: BudgetTarget): string => (
  'categoryId' in target ? target.categoryId : target.subcategoryId
);

/**
 * The field naming a target's id, as the route's contract check names fields.
 *
 * @param index - Its position in the request's `targets`.
 * @param target - The claim.
 * @returns E.g. `targets[1].subcategoryId`.
 */
const targetField = (index: number, target: BudgetTarget): string => (
  `targets[${index}].${'categoryId' in target ? 'categoryId' : 'subcategoryId'}`
);

/**
 * Reads the targets sent: each must name exactly one id.
 *
 * @param inputs - The targets as sent.
 * @returns The claims, in the request's order, and one problem per malformed one.
 */
export const parseTargets = (inputs: readonly TargetInput[]) => {
  const targets = inputs.map(targetOf);
  const problems: FieldDetail[] = targets.flatMap((target, index) => (
    target ? [] : [{ field: `targets[${index}]`, code: 'field.invalid' as const }]
  ));
  return { targets: targets.filter((target) => target !== undefined), problems };
};

/**
 * The ids a new claim may name: the household's open Categories and Subcategories.
 *
 * @param categories - The open Categories, with their open Subcategories.
 * @returns Their ids.
 */
export const claimableIds = (categories: readonly Category[]): ReadonlySet<string> => new Set(
  categories.flatMap((category) => [category.id, ...category.subcategories.map(({ id }) => id)]),
);

/**
 * Checks each target may be claimed: one already held stays claimable; a new one
 * must be an open Category or Subcategory of the household (OQ-176).
 *
 * @param deps - The tier below.
 * @param householdId - The household.
 * @param targets - The claims, in the request's order.
 * @param held - The claims the Budget already holds.
 * @throws {DomainError} `field.invalid_option` on each target that isn't.
 */
const requireClaimable = async (
  deps: AccountDeps,
  householdId: string,
  targets: readonly BudgetTarget[],
  held: readonly BudgetTarget[] = [],
): Promise<void> => {
  const kept = new Set(held.map(idOf));
  const open = claimableIds(await deps.categories.list(householdId));
  requireNoProblems(targets.flatMap((target, index) => (
    kept.has(idOf(target)) || open.has(idOf(target))
      ? []
      : [{ field: targetField(index, target), code: 'field.invalid_option' as const }]
  )));
};

/**
 * Drops repeated claims, so a target sent twice counts once (OQ-176).
 *
 * @param targets - The claims.
 * @returns Each claim once, first occurrence first.
 */
export const uniqueTargets = (targets: readonly BudgetTarget[]): BudgetTarget[] => [
  ...new Map(targets.map((target) => [idOf(target), target])).values(),
];

/**
 * The API's answer to a refused target set: claimed elsewhere in the scope is a
 * conflict; one gone meanwhile is answered on its field, like the check before.
 *
 * @param rejection - Why BudgetAccessor refused it.
 * @param targets - The claims sent, to name the field.
 * @returns `budget.target_already_claimed`, or `field.invalid_option`.
 */
export const rejectionError = (
  rejection: TargetRejection,
  targets: readonly BudgetTarget[],
): DomainError => {
  if (rejection.reason === 'target_claimed') {
    return targetAlreadyClaimed(rejection.target, rejection.claimedByBudgetId);
  }
  const index = targets.findIndex((target) => idOf(target) === idOf(rejection.target));
  return validationFailed([
    { field: targetField(index, rejection.target), code: 'field.invalid_option' },
  ]);
};

/**
 * The fields a Budget edit changes: the name trimmed, fields not sent left out.
 *
 * @param edit - The edit, its name already checked as non-blank.
 * @returns What BudgetAccessor's `update` writes.
 */
export const budgetChangesOf = (edit: BudgetEdit): BudgetChanges => {
  const candidates = { name: edit.name?.trim(), targetAmount: edit.targetAmount };
  return Object.fromEntries(
    Object.entries(candidates).filter(([, value]) => value !== undefined),
  );
};

/**
 * Reads a request's fields and targets, refusing a blank name or a malformed
 * target in one answer.
 *
 * @param fields - The name, if sent.
 * @param fields.name - The name.
 * @param inputs - The targets as sent.
 * @returns The claims, in the request's order.
 * @throws {DomainError} `validation.failed`.
 */
const requireValidRequest = (
  fields: { readonly name?: string | undefined },
  inputs: readonly TargetInput[],
): BudgetTarget[] => {
  const { targets, problems } = parseTargets(inputs);
  requireNoProblems([...checkFields(fields, { name: nonBlank }), ...problems]);
  return targets;
};

/**
 * Splits a Budget's claims into Categories and Subcategories.
 *
 * @param targets - The claims.
 * @returns Their ids, by level.
 */
export const claimsOf = (targets: readonly BudgetTarget[]): ClaimedCategories => ({
  categoryIds: targets.flatMap((target) => ('categoryId' in target ? [target.categoryId] : [])),
  subcategoryIds: targets.flatMap((target) => (
    'subcategoryId' in target ? [target.subcategoryId] : []
  )),
});

/**
 * Restates a Budget's spend from a month on, from the transactions in its
 * scope — the Accounts and cards a spend of it accrues from (OQ-166): its
 * household's shared ones, or its owner's personal ones.
 *
 * @param stores - The Accessors, over the write's transaction.
 * @param budget - The Budget, with its claims as they now stand.
 * @param from - The first month restated: the current one.
 * @param actorId - The member writing it: who reads a shared Budget's Accounts
 *   when its owner is gone (a personal one always has its owner).
 */
const restateSpend = async (
  stores: AccountStores,
  budget: Budget,
  from: BudgetMonth,
  actorId: string,
) => {
  const viewerId = budget.ownerUserId ?? actorId;
  const accountIds = (await stores.accounts.list(budget.householdId, viewerId, {
    visibility: budget.visibility,
  })).map((account) => account.id);
  const cardIds = (await stores.creditCards.listByAccounts(accountIds)).map((card) => card.id);
  const claims = claimsOf(budget.targets);
  const firstDay = `${monthKey(from)}-01`;
  const sums = [
    ...await stores.accountTransactions.claimedSums(accountIds, claims, firstDay),
    ...await stores.cardTransactions.claimedSums(cardIds, claims, firstDay),
  ];
  await stores.budgets.restateSpend(budget, from, spendByMonth(sums, budget.currency));
};

/**
 * Loads a Budget the caller may take an action on.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param ids - The household and the Budget.
 * @param action - The data action.
 * @returns The Budget.
 * @throws {DomainError} `household.not_found` / `budget.not_found`; `auth.forbidden`.
 */
const loadBudget = async (
  deps: AccountDeps,
  context: SignedInContext,
  ids: { readonly householdId: string; readonly budgetId: string },
  action: DataAction,
): Promise<Budget> => {
  const budget = await deps.budgets.findById(ids.householdId, ids.budgetId);
  await requireAccess(
    deps.authorization,
    context.actor.userId,
    ids.householdId,
    accessToOwned(budget, action),
    budgetNotFound,
  );
  if (!budget) throw budgetNotFound();
  return budget;
};

/**
 * Writes an edit — name and target, then targets — in one transaction, so a
 * refused target keeps none of it (OQ-176). New targets restate the spend from
 * this month on (OQ-166). Every check ran before.
 *
 * @param deps - The tier below.
 * @param actorId - The member editing it.
 * @param budget - The Budget as it stood.
 * @param changes - The name and target to write, if any.
 * @param targets - The new claims, if sent.
 * @throws {DomainError} `budget.not_found`; `budget.target_already_claimed`;
 *   `field.invalid_option`.
 */
const writeEdit = (
  deps: AccountDeps,
  actorId: string,
  budget: Budget,
  changes: BudgetChanges,
  targets: readonly BudgetTarget[] | undefined,
): Promise<void> => deps.inTransaction(async (stores) => {
  const { householdId, id: budgetId } = budget;
  const month = monthOf(todayOf(deps));
  if (Object.keys(changes).length > 0) {
    const updated = await stores.budgets.update(householdId, budgetId, changes, month);
    if (updated === 'not_found') throw budgetNotFound();
  }
  if (!targets) return;
  const claimed = uniqueTargets(targets);
  const result = await stores.budgets.replaceTargets(householdId, budgetId, claimed);
  if (!result.ok) {
    throw result.reason === 'not_found' ? budgetNotFound() : rejectionError(result, targets);
  }
  await restateSpend(stores, { ...budget, targets: claimed }, month, actorId);
});

/**
 * Builds the Budget use cases.
 *
 * @param deps - The tier below.
 * @returns `listBudgets`, `getBudget`, `createBudget`, `editBudget`,
 *   `deleteBudget`, `listBudgetPeriods`.
 */
const createBudgets = (deps: AccountDeps) => ({
  /**
   * The Budgets the caller can see — every shared one and their own personal
   * ones — by name, all of them (OQ-176).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param filter - An optional visibility.
   * @param filter.visibility - The visibility.
   * @returns The Budgets.
   * @throws {DomainError} `household.not_found`.
   */
  listBudgets: async (
    context: SignedInContext,
    householdId: string,
    filter: { readonly visibility?: Visibility | undefined },
  ): Promise<Budget[]> => {
    const { userId } = context.actor;
    await requireAccess(deps.authorization, userId, householdId, memberOnly);
    return deps.budgets.list(householdId, userId, filter);
  },

  /**
   * One Budget the caller can see.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @returns The Budget.
   * @throws {DomainError} `household.not_found` / `budget.not_found`.
   */
  getBudget: (
    context: SignedInContext,
    householdId: string,
    budgetId: string,
  ): Promise<Budget> => loadBudget(deps, context, { householdId, budgetId }, 'data.view'),

  /**
   * Creates a Budget, owned by its creator, claiming its targets and opening this
   * month's period with the spend already recorded in it — together or not at
   * all (uc-01, FR-4.1/4.2/4.7, OQ-166).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param input - The Budget; its name is trimmed and must not be blank.
   * @returns The Budget.
   * @throws {DomainError} `household.not_found`; `auth.forbidden`;
   *   `budget.target_already_claimed`; `validation.failed`.
   */
  createBudget: async (
    context: SignedInContext,
    householdId: string,
    input: BudgetInput,
  ): Promise<Budget> => {
    const ownerUserId = context.actor.userId;
    await requireAccess(deps.authorization, ownerUserId, householdId, {
      action: 'data.create', visibility: input.visibility, ownerUserId,
    });
    const targets = requireValidRequest(input, input.targets);
    await requireClaimable(deps, householdId, targets);
    const month = monthOf(todayOf(deps));
    const budget = await deps.inTransaction(async (stores) => {
      const result = await stores.budgets.insert({
        householdId,
        ownerUserId,
        visibility: input.visibility,
        name: input.name.trim(),
        targetAmount: input.targetAmount,
        currency: input.currency,
      }, uniqueTargets(targets), month);
      if (!result.ok) throw rejectionError(result, targets);
      await restateSpend(stores, result.budget, month, ownerUserId);
      return result.budget;
    });
    requestLogger(context).audit('CreateBudget', {
      entityType: 'Budget', entityId: budget.id, householdId,
    });
    return budget;
  },

  /**
   * Edits a Budget's name, target and targets in one write (uc-02, FR-4.7/4.9,
   * OQ-176): a new target applies from this month on, and new targets restate
   * its spend from this month on (OQ-166). An empty edit reads the Budget back,
   * unaudited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @param edit - The fields to change; a name is trimmed and must not be blank.
   * @returns The Budget as it now stands.
   * @throws {DomainError} `household.not_found` / `budget.not_found`;
   *   `auth.forbidden`; `budget.target_already_claimed`; `validation.failed`.
   */
  editBudget: async (
    context: SignedInContext,
    householdId: string,
    budgetId: string,
    edit: BudgetEdit,
  ): Promise<Budget> => {
    const ids = { householdId, budgetId };
    const budget = await loadBudget(deps, context, ids, 'data.edit');
    const targets = edit.targets && requireValidRequest(edit, edit.targets);
    if (!targets) requireNoProblems(checkFields(edit, { name: nonBlank }));
    if (targets) await requireClaimable(deps, householdId, targets, budget.targets);
    const changes = budgetChangesOf(edit);
    if (Object.keys(changes).length === 0 && !targets) return budget;
    await writeEdit(deps, context.actor.userId, budget, changes, targets);
    requestLogger(context).audit('EditBudget', {
      entityType: 'Budget', entityId: budgetId, householdId,
    });
    const edited = await deps.budgets.findById(householdId, budgetId);
    if (!edited) throw budgetNotFound();
    return edited;
  },

  /**
   * Deletes a Budget: a hard delete of the definition, releasing its claims; its
   * periods stay, as history (uc-03, FR-4.10, OQ-40).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @throws {DomainError} `household.not_found` / `budget.not_found`;
   *   `auth.forbidden`.
   */
  deleteBudget: async (
    context: SignedInContext,
    householdId: string,
    budgetId: string,
  ): Promise<void> => {
    await loadBudget(deps, context, { householdId, budgetId }, 'data.delete');
    if (!(await deps.budgets.delete(householdId, budgetId))) throw budgetNotFound();
    requestLogger(context).audit('DeleteBudget', {
      entityType: 'Budget', entityId: budgetId, householdId,
    });
  },

  /**
   * A Budget's months — the target in effect and the spend accrued — oldest
   * first (FR-4.3/4.9).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @param range - The months; open ends reach the history's ends.
   * @returns The periods.
   * @throws {DomainError} `household.not_found` / `budget.not_found`.
   */
  listBudgetPeriods: async (
    context: SignedInContext,
    householdId: string,
    budgetId: string,
    range: MonthRange,
  ): Promise<BudgetPeriod[]> => {
    await loadBudget(deps, context, { householdId, budgetId }, 'data.view');
    return deps.budgets.listPeriods(householdId, budgetId, range);
  },
});

export default createBudgets;
