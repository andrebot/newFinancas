import type { Goal, GoalChanges, GoalStatus } from '../../accessors/goalAccessor';
import type { Visibility } from '../../db/schema/values';
import type { DataAction } from '../../utilities/authorization';
import { checkFields, nonBlank } from '../../utilities/validation';
import { accessToOwned, memberOnly, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import { requireNoProblems } from '../validation';
import { requestLogger, type AccountDeps } from './context';
import { goalNotFound } from './errors';

// Goals' definitions (goals/uc-01..05, FR-8.1/8.6/8.8/8.9). A Goal is personal
// (its owner's alone) or shared (the permission table, plus a Member may edit
// what they created — OQ-111), like a Budget. It is funded from the Holding's
// side (OQ-48), so nothing here touches an allocation; progress is a reshaped
// read, InsightsManager's (OQ-174, OQ-177).

/** A Goal to create, as the route validated it. */
export interface GoalInput {
  readonly name: string;
  /** Minor units of `targetCurrency`, more than zero. */
  readonly targetAmount: number;
  readonly targetCurrency: string;
  /** `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly visibility: Visibility;
}

/** A Goal edit as the route validated it: any field may be left out; never the scope. */
export interface GoalEdit {
  readonly name?: string | undefined;
  readonly targetAmount?: number | undefined;
  readonly targetCurrency?: string | undefined;
  readonly dueDate?: string | undefined;
}

interface GoalIds {
  readonly householdId: string;
  readonly goalId: string;
}

/**
 * The fields a Goal edit changes: the name trimmed, fields not sent left out.
 *
 * @param edit - The edit, its name already checked as non-blank.
 * @returns What GoalAccessor's `update` writes.
 */
export const goalChangesOf = (edit: GoalEdit): GoalChanges => {
  const candidates = {
    name: edit.name?.trim(),
    targetAmount: edit.targetAmount,
    targetCurrency: edit.targetCurrency,
    dueDate: edit.dueDate,
  };
  return Object.fromEntries(
    Object.entries(candidates).filter(([, value]) => value !== undefined),
  );
};

/**
 * Loads a Goal the caller may take an action on.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param ids - The household and the Goal.
 * @param action - The data action.
 * @returns The Goal.
 * @throws {DomainError} `household.not_found` / `goal.not_found`; `auth.forbidden`.
 */
const loadGoal = async (
  deps: AccountDeps,
  context: SignedInContext,
  ids: GoalIds,
  action: DataAction,
): Promise<Goal> => {
  const goal = await deps.goals.findById(ids.householdId, ids.goalId);
  await requireAccess(
    deps.authorization,
    context.actor.userId,
    ids.householdId,
    accessToOwned(goal, action),
    goalNotFound,
  );
  if (!goal) throw goalNotFound();
  return goal;
};

/**
 * Completes or reopens a Goal (FR-8.8/8.9). A Goal already in that state is left
 * as it is, unaudited (OQ-177).
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param ids - The household and the Goal.
 * @param completed - `true` to complete it, `false` to reopen it.
 * @throws {DomainError} `household.not_found` / `goal.not_found`; `auth.forbidden`.
 */
const setCompleted = async (
  deps: AccountDeps,
  context: SignedInContext,
  ids: GoalIds,
  completed: boolean,
): Promise<void> => {
  const goal = await loadGoal(deps, context, ids, 'data.edit');
  if ((goal.completedAt !== null) === completed) return;
  const write = completed ? deps.goals.complete : deps.goals.reopen;
  if (!(await write(ids.householdId, ids.goalId))) throw goalNotFound();
  requestLogger(context).audit(completed ? 'CompleteGoal' : 'ReopenGoal', {
    entityType: 'Goal', entityId: ids.goalId, householdId: ids.householdId,
  });
};

/**
 * Builds the Goal use cases.
 *
 * @param deps - The tier below.
 * @returns `listGoals`, `getGoal`, `createGoal`, `editGoal`, `completeGoal`,
 *   `reopenGoal`, `deleteGoal`.
 */
const createGoals = (deps: AccountDeps) => ({
  /**
   * The Goals the caller can see — every shared one and their own personal
   * ones — in one status, soonest due first, all of them (OQ-177).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param status - Active or completed.
   * @returns The Goals.
   * @throws {DomainError} `household.not_found`.
   */
  listGoals: async (
    context: SignedInContext,
    householdId: string,
    status: GoalStatus,
  ): Promise<Goal[]> => {
    const { userId } = context.actor;
    await requireAccess(deps.authorization, userId, householdId, memberOnly);
    return deps.goals.list(householdId, userId, status);
  },

  /**
   * One Goal the caller can see.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @returns The Goal.
   * @throws {DomainError} `household.not_found` / `goal.not_found`.
   */
  getGoal: (
    context: SignedInContext,
    householdId: string,
    goalId: string,
  ): Promise<Goal> => loadGoal(deps, context, { householdId, goalId }, 'data.view'),

  /**
   * Creates a Goal, open and unfunded, owned by its creator (uc-01, FR-8.1,
   * OQ-48).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param input - The Goal; its name is trimmed and must not be blank.
   * @returns The Goal.
   * @throws {DomainError} `household.not_found`; `auth.forbidden`;
   *   `validation.failed`.
   */
  createGoal: async (
    context: SignedInContext,
    householdId: string,
    input: GoalInput,
  ): Promise<Goal> => {
    const ownerUserId = context.actor.userId;
    await requireAccess(deps.authorization, ownerUserId, householdId, {
      action: 'data.create', visibility: input.visibility, ownerUserId,
    });
    requireNoProblems(checkFields(input, { name: nonBlank }));
    const goal = await deps.goals.insert({
      householdId,
      ownerUserId,
      visibility: input.visibility,
      name: input.name.trim(),
      targetAmount: input.targetAmount,
      targetCurrency: input.targetCurrency,
      dueDate: input.dueDate,
    });
    requestLogger(context).audit('CreateGoal', {
      entityType: 'Goal', entityId: goal.id, householdId,
    });
    return goal;
  },

  /**
   * Edits a Goal's name, target, target currency and/or due date (uc-02,
   * FR-8.1) — a completed one too: only new funding is closed to it (FR-8.9,
   * OQ-177). An empty edit reads the Goal back, unaudited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @param edit - The fields to change; a name is trimmed and must not be blank.
   * @returns The Goal as it now stands.
   * @throws {DomainError} `household.not_found` / `goal.not_found`;
   *   `auth.forbidden`; `validation.failed`.
   */
  editGoal: async (
    context: SignedInContext,
    householdId: string,
    goalId: string,
    edit: GoalEdit,
  ): Promise<Goal> => {
    const goal = await loadGoal(deps, context, { householdId, goalId }, 'data.edit');
    requireNoProblems(checkFields(edit, { name: nonBlank }));
    const changes = goalChangesOf(edit);
    if (Object.keys(changes).length === 0) return goal;
    const edited = await deps.goals.update(householdId, goalId, changes);
    if (!edited) throw goalNotFound();
    requestLogger(context).audit('EditGoal', {
      entityType: 'Goal', entityId: goalId, householdId,
    });
    return edited;
  },

  /**
   * Marks a Goal completed — "this goal is done", reversible (uc-03, FR-8.8).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @throws {DomainError} `household.not_found` / `goal.not_found`; `auth.forbidden`.
   */
  completeGoal: (
    context: SignedInContext,
    householdId: string,
    goalId: string,
  ): Promise<void> => setCompleted(deps, context, { householdId, goalId }, true),

  /**
   * Reopens a completed Goal, back to active (uc-04, FR-8.9).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @throws {DomainError} `household.not_found` / `goal.not_found`; `auth.forbidden`.
   */
  reopenGoal: (
    context: SignedInContext,
    householdId: string,
    goalId: string,
  ): Promise<void> => setCompleted(deps, context, { householdId, goalId }, false),

  /**
   * Deletes a Goal, no history kept: its allocations go with it, the Holdings
   * that funded it stay (uc-05, FR-8.6, OQ-47).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @throws {DomainError} `household.not_found` / `goal.not_found`; `auth.forbidden`.
   */
  deleteGoal: async (
    context: SignedInContext,
    householdId: string,
    goalId: string,
  ): Promise<void> => {
    await loadGoal(deps, context, { householdId, goalId }, 'data.delete');
    if (!(await deps.goals.delete(householdId, goalId))) throw goalNotFound();
    requestLogger(context).audit('DeleteGoal', {
      entityType: 'Goal', entityId: goalId, householdId,
    });
  },
});

export default createGoals;
