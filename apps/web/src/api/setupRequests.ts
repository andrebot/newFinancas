import { useCallback } from 'react';
import type { SerializedError } from '@reduxjs/toolkit';
import type { Account } from '@financas/api-types';
import type { ApiError } from './errors';
import {
  failureOf, toDataOutcome, toRequestOutcome, type EndpointResult,
} from './outcome';
import type { RequestOutcome } from '../utilities/requestOutcome';
import {
  useArchiveAccountMutation, useCreateAccountMutation, useEditAccountMutation,
  useLazyListAccountsQuery, useListCategoriesQuery, useCreateCategoryMutation,
  useEditCategoryMutation, useArchiveCategoryMutation, useArchiveSubcategoryMutation,
  useListBudgetsQuery, useCreateBudgetMutation, useEditBudgetMutation, useDeleteBudgetMutation,
} from './setupApi';
import type { AccountManagementFlowProps } from '../experiences/accountSetup/flows/accountManagement/AccountManagementFlow';
import type { BudgetManagementFlowProps } from '../experiences/accountSetup/flows/budgetManagement/BudgetManagementFlow';
import type { CategoryManagementFlowProps } from '../experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow';
import type { SharedListView } from '../experiences/accountSetup/sharedLists';

// The setup requests both hosts of Account Setup's Flows answer (X5, X2G;
// OQ-198): the accounts, the category list and the budgets, each bound to one
// household. The Account Setup Experience and Onboard (its Guided Setup step)
// call them — each still the only tier on its page that reaches the backend —
// so a rule on how a write is answered (what is fetched again, and when) lives
// in one place that neither Experience owns. They answer in the shapes the
// Flows both Experiences compose ask for.

/**
 * Builds the Account Management Flow's requests for one household. The load
 * is stable, so the Flow fetches once as it mounts.
 *
 * @param householdId - The household.
 * @returns The Flow's four requests.
 */
export const useAccountRequests = (
  householdId: string,
): Omit<AccountManagementFlowProps, 'selfUserId' | 'role'> => {
  const [loadAccounts] = useLazyListAccountsQuery();
  const [createAccount] = useCreateAccountMutation();
  const [editAccount] = useEditAccountMutation();
  const [archiveAccount] = useArchiveAccountMutation();

  /** Lists the household's accounts, archived included. */
  const onLoad = useCallback(async () => (
    // An awaited trigger has settled: its result holds the data or the error.
    toDataOutcome(await (
      loadAccounts(householdId) as Promise<EndpointResult<readonly Account[]>>
    ))
  ), [householdId, loadAccounts]);

  return {
    onLoad,
    onCreate: async (account) => toDataOutcome(await createAccount({
      householdId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      visibility: account.visibility,
      ...(account.openingBalance === null ? {} : { openingBalance: account.openingBalance }),
      cards: account.cards,
    })),
    onEdit: async (edit) => toDataOutcome(await editAccount({
      householdId,
      accountId: edit.accountId,
      name: edit.name,
      ...(edit.visibility === undefined ? {} : { visibility: edit.visibility }),
      ...(edit.cards === undefined ? {} : { cards: edit.cards }),
    })),
    onArchive: async (accountId) => toRequestOutcome(
      await archiveAccount({ householdId, accountId }),
    ),
  };
};

/** What a list query holds, as far as a Flow's view needs. */
export interface ListQueryState<Item> {
  readonly data?: readonly Item[] | undefined;
  readonly error?: ApiError | SerializedError | undefined;
}

/**
 * Reads a list query into a Flow's view: its data once there is some (kept
 * while it refetches) under the view's field, its failure, or loading. A list
 * whose latest fetch failed carries that failure, since it may lack a write
 * that just went through (OQ-193); the query keeps its error until a fetch
 * succeeds.
 *
 * @param field - The view's field for the items, e.g. `categories`.
 * @param query - The query's data and error.
 * @returns The view.
 */
export const listViewOf = <Field extends string, Item>(
  field: Field,
  { data, error }: ListQueryState<Item>,
): SharedListView<Field, Item> => {
  if (data !== undefined) {
    const loaded = error === undefined
      ? { status: 'loaded', [field]: data }
      : { status: 'loaded', [field]: data, refreshError: failureOf(error) };
    // A computed key widens to a string index; it is exactly `field`.
    return loaded as SharedListView<Field, Item>;
  }
  if (error !== undefined) return { status: 'failed', error: failureOf(error) };
  return { status: 'loading' };
};

/**
 * Holds the household's category list — the Experience's, shared by its
 * Flows — and builds the Category Management Flow's requests (FL12). After a
 * successful write it fetches the list again and answers only then, so the
 * Flow's spinner stops on a list that already holds the change — or, if that
 * fetch fails, on the list beside its failure and a retry.
 *
 * @param householdId - The household.
 * @returns The list and the Flow's requests.
 */
export const useCategories = (householdId: string): Omit<CategoryManagementFlowProps, 'role'> => {
  const categoriesQuery = useListCategoriesQuery(householdId);
  const { refetch } = categoriesQuery;
  const [createCategory] = useCreateCategoryMutation();
  const [editCategory] = useEditCategoryMutation();
  const [archiveCategory] = useArchiveCategoryMutation();
  const [archiveSubcategory] = useArchiveSubcategoryMutation();

  /**
   * Answers a write: on a success, once the list is fetched again. The write
   * went through either way, so it stays ok; a failed fetch shows in the
   * list's view instead.
   *
   * @param result - What the write's trigger resolved to.
   * @returns Its outcome.
   */
  const answer = async (result: EndpointResult<unknown>): Promise<RequestOutcome> => {
    const outcome = toRequestOutcome(result);
    if (outcome.ok) await refetch();
    return outcome;
  };

  return {
    categories: listViewOf('categories', categoriesQuery),
    onRetry: () => {
      refetch();
    },
    onCreate: async (category) => answer(await createCategory({ householdId, ...category })),
    onEdit: async (edit) => answer(await editCategory({
      householdId, categoryId: edit.categoryId, name: edit.name, icon: edit.icon, color: edit.color,
    })),
    // Adding a subcategory is the same atomic edit, listing only the new one
    // (OQ-173: unlisted ones are untouched).
    onAddSubcategory: async (categoryId, name) => answer(await editCategory({
      householdId, categoryId, subcategories: [{ name }],
    })),
    onArchiveCategory: async (categoryId) => answer(
      await archiveCategory({ householdId, categoryId }),
    ),
    onArchiveSubcategory: async (categoryId, subcategoryId) => answer(
      await archiveSubcategory({ householdId, categoryId, subcategoryId }),
    ),
  };
};

/** The failures that mean the lists moved under the form (OQ-194). */
const STALE_CODES: ReadonlySet<string> = new Set([
  'budget.target_already_claimed', 'budget.not_found', 'validation.failed',
]);

/**
 * Tells which lists to fetch again before answering a budget write: the
 * budgets after a success, or after a failure that says they moved — a
 * target claimed meanwhile (409), a budget deleted meanwhile (404) — and the
 * categories too after a target refused as gone (422, a category archived
 * meanwhile), so the picker shows what is free now.
 *
 * @param outcome - The write's outcome.
 * @returns Which lists to fetch again.
 */
export const listsToRefresh = (outcome: RequestOutcome) => {
  if (outcome.ok) return { budgets: true, categories: false };
  const { code } = outcome.error;
  return { budgets: STALE_CODES.has(code), categories: code === 'validation.failed' };
};

/**
 * Holds the budgets the caller can see — the Experience's, since their claims
 * are shared state other members change — and builds the Budget Management
 * Flow's requests (FL13). After a write it fetches what moved again and
 * answers only then, so the picker already shows what is free.
 *
 * @param householdId - The household.
 * @returns The budgets' view and the Flow's requests.
 */
export const useBudgets = (
  householdId: string,
): Omit<BudgetManagementFlowProps, 'selfUserId' | 'role' | 'categories'> => {
  const budgetsQuery = useListBudgetsQuery(householdId);
  // The same subscription Category Management reads: only its refetch is needed here.
  const { refetch: refetchCategories } = useListCategoriesQuery(householdId);
  const { refetch: refetchBudgets } = budgetsQuery;
  const [createBudget] = useCreateBudgetMutation();
  const [editBudget] = useEditBudgetMutation();
  const [deleteBudget] = useDeleteBudgetMutation();

  /**
   * Answers a write once the lists it moved are fetched again. The write's
   * outcome stands either way; a failed fetch shows in the lists' view.
   *
   * @param result - What the write's trigger resolved to.
   * @returns Its outcome.
   */
  const answer = async (result: EndpointResult<unknown>): Promise<RequestOutcome> => {
    const outcome = toRequestOutcome(result);
    const refresh = listsToRefresh(outcome);
    await Promise.all([
      refresh.budgets ? refetchBudgets() : undefined,
      refresh.categories ? refetchCategories() : undefined,
    ]);
    return outcome;
  };

  return {
    budgets: listViewOf('budgets', budgetsQuery),
    onRetry: () => {
      refetchBudgets();
      refetchCategories();
    },
    onCreate: async (budget) => answer(await createBudget({ householdId, ...budget })),
    onEdit: async ({ budgetId, ...changes }) => answer(
      await editBudget({ householdId, budgetId, ...changes }),
    ),
    onDelete: async (budgetId) => answer(await deleteBudget({ householdId, budgetId })),
  };
};
