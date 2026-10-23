import type {
  Account, AccountCreateRequest, AccountStatus, AccountUpdateRequest, Budget, BudgetCreateRequest,
  BudgetUpdateRequest, Category, CategoryColor, CategoryIcon, CategoryUpdateRequest,
  ListAccountsResponse, ListBudgetsResponse, ListCategoriesResponse,
} from '@financas/api-types';
import { skipToken } from '@reduxjs/toolkit/query/react';
import backendApi from './backendApi';
import send from './send';
import type { SourceState } from '../utilities/sourceState';
import { toSourceState } from './sourceState';

// The household setup endpoints several Experiences share (X5, X2G; OQ-175,
// OQ-193, OQ-194, OQ-198): the accounts, the categories and the budgets.
// Account Setup manages them; Onboard's Guided Setup creates the first ones;
// the App Shell's household gate asks whether an account is in use. Like the
// identity reads (`identityApi.ts`), they belong to no one Experience, so each
// imports them from here and never from a sibling.
// - The accounts are the Account Management Flow's own list, fetched as it
//   mounts and patched with what each write returns.
// - The categories and the budgets are a host Experience's shared lists. It
//   fetches them again after each write, before it answers the Flow
//   (`setupRequests.ts`). Nothing else reads them, so invalidating would only
//   fetch them twice.
// - The account status (FR-1.22) carries the one tag. A create or archive that
//   went through invalidates it.
// The request shapes come straight from the contract (`@financas/api-types`).

/** What addresses an account inside its household. */
export interface AccountTarget {
  readonly householdId: string;
  readonly accountId: string;
}

/** A create, addressed to its household. */
export type CreateAccountInput = AccountCreateRequest & { readonly householdId: string };

/** An edit, addressed to its account. */
export type EditAccountInput = AccountUpdateRequest & AccountTarget;

/** What addresses a category inside its household (FL12). */
export interface CategoryTarget {
  readonly householdId: string;
  readonly categoryId: string;
}

/** What addresses a subcategory under its category. */
export interface SubcategoryTarget extends CategoryTarget {
  readonly subcategoryId: string;
}

/** A create, addressed to its household (FR-10.1). */
export interface CreateCategoryInput {
  readonly householdId: string;
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: CategoryColor;
}

/** An edit — fields and/or subcategories, addressed to its category (OQ-173). */
export type EditCategoryInput = CategoryUpdateRequest & CategoryTarget;

/** What addresses a budget inside its household (FL13). */
export interface BudgetTarget {
  readonly householdId: string;
  readonly budgetId: string;
}

/** A create, addressed to its household (FR-4.1). */
export type CreateBudgetInput = BudgetCreateRequest & { readonly householdId: string };

/** An edit — name, target and/or targets, addressed to its budget (OQ-176). */
export type EditBudgetInput = BudgetUpdateRequest & BudgetTarget;

/**
 * Builds a household's accounts path.
 *
 * @param householdId - The household.
 * @returns Its accounts' path.
 */
const accountsPath = (householdId: string) => (
  `/households/${encodeURIComponent(householdId)}/accounts`);

/**
 * Builds one account's path inside its household.
 *
 * @param target - The household and the account.
 * @returns The account's path.
 */
const accountPath = ({ householdId, accountId }: AccountTarget) => (
  `${accountsPath(householdId)}/${encodeURIComponent(accountId)}`);

/** Builds a household's categories path (FL12). */
const categoriesPath = (householdId: string) => (
  `/households/${encodeURIComponent(householdId)}/categories`);

/** Builds one category's path inside its household. */
const categoryPath = ({ householdId, categoryId }: CategoryTarget) => (
  `${categoriesPath(householdId)}/${encodeURIComponent(categoryId)}`);

/** Builds a household's budgets path (FL13). */
const budgetsPath = (householdId: string) => (
  `/households/${encodeURIComponent(householdId)}/budgets`);

/** Builds one budget's path inside its household. */
const budgetPath = ({ householdId, budgetId }: BudgetTarget) => (
  `${budgetsPath(householdId)}/${encodeURIComponent(budgetId)}`);

/**
 * Names a household's account status, once a write went through; a failed
 * one changed nothing.
 *
 * @param error - The write's failure, if any.
 * @param householdId - The household it wrote to.
 * @returns The tag to invalidate, or none.
 */
const accountStatusTag = (error: unknown, householdId: string) => (
  error ? [] : [{ type: 'AccountStatus' as const, id: householdId }]
);

/** The shared setup endpoints. */
export const setupApi = backendApi.enhanceEndpoints({
  addTagTypes: ['AccountStatus'],
}).injectEndpoints({
  endpoints: (build) => ({
    listAccounts: build.query<readonly Account[], string>({
      query: accountsPath,
      transformResponse: (response: ListAccountsResponse) => response.data ?? [],
    }),
    // The household gate's read: whether any account, of any visibility, is in use.
    getAccountStatus: build.query<boolean, string>({
      query: (householdId) => `/households/${encodeURIComponent(householdId)}/account-status`,
      transformResponse: (response: AccountStatus) => response.inUse,
      providesTags: (_result, _error, householdId) => [{ type: 'AccountStatus', id: householdId }],
    }),
    createAccount: build.mutation<Account, CreateAccountInput>({
      query: ({ householdId, ...request }) => send('POST', accountsPath(householdId), request),
      invalidatesTags: (_result, error, { householdId }) => accountStatusTag(error, householdId),
    }),
    editAccount: build.mutation<Account, EditAccountInput>({
      query: ({ householdId, accountId, ...changes }) => (
        send('PATCH', accountPath({ householdId, accountId }), changes)
      ),
    }),
    archiveAccount: build.mutation<void, AccountTarget>({
      query: (target) => send('POST', `${accountPath(target)}/archive`),
      invalidatesTags: (_result, error, { householdId }) => accountStatusTag(error, householdId),
    }),
    listCategories: build.query<readonly Category[], string>({
      query: (householdId) => `${categoriesPath(householdId)}?includeArchived=true`,
      transformResponse: (response: ListCategoriesResponse) => response.data ?? [],
    }),
    createCategory: build.mutation<Category, CreateCategoryInput>({
      query: ({ householdId, ...request }) => send('POST', categoriesPath(householdId), request),
    }),
    editCategory: build.mutation<Category, EditCategoryInput>({
      query: ({ householdId, categoryId, ...changes }) => (
        send('PATCH', categoryPath({ householdId, categoryId }), changes)
      ),
    }),
    archiveCategory: build.mutation<void, CategoryTarget>({
      query: (target) => send('POST', `${categoryPath(target)}/archive`),
    }),
    archiveSubcategory: build.mutation<void, SubcategoryTarget>({
      query: ({ householdId, categoryId, subcategoryId }) => {
        const base = categoryPath({ householdId, categoryId });
        return send('POST', `${base}/subcategories/${encodeURIComponent(subcategoryId)}/archive`);
      },
    }),
    listBudgets: build.query<readonly Budget[], string>({
      query: budgetsPath,
      transformResponse: (response: ListBudgetsResponse) => response.data ?? [],
    }),
    createBudget: build.mutation<Budget, CreateBudgetInput>({
      query: ({ householdId, ...request }) => send('POST', budgetsPath(householdId), request),
    }),
    editBudget: build.mutation<Budget, EditBudgetInput>({
      query: ({ householdId, budgetId, ...changes }) => (
        send('PATCH', budgetPath({ householdId, budgetId }), changes)
      ),
    }),
    deleteBudget: build.mutation<void, BudgetTarget>({
      query: (target) => send('DELETE', budgetPath(target)),
    }),
  }),
});

export const {
  useLazyListAccountsQuery,
  useGetAccountStatusQuery,
  useCreateAccountMutation,
  useEditAccountMutation,
  useArchiveAccountMutation,
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useEditCategoryMutation,
  useArchiveCategoryMutation,
  useArchiveSubcategoryMutation,
  useListBudgetsQuery,
  useCreateBudgetMutation,
  useEditBudgetMutation,
  useDeleteBudgetMutation,
} = setupApi;

/**
 * Whether a household has an account in use, of any visibility, as the App
 * Shell's household gate takes it (`ShellSources.useAccountInUse`). Without
 * one, the gate opens Guided Setup (FR-1.22, OQ-198).
 *
 * @param householdId - The household; none asks nothing and stays loading.
 * @returns The answer's state.
 */
export const useAccountInUse = (householdId: string | undefined): SourceState<boolean> => (
  toSourceState(useGetAccountStatusQuery(householdId ?? skipToken))
);
