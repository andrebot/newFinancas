import type {
  Account, AccountCreateRequest, ListAccountsResponse, AccountUpdateRequest, Budget,
  BudgetCreateRequest, BudgetUpdateRequest, Category, CategoryColor, CategoryIcon,
  CategoryUpdateRequest, Goal, GoalCreateRequest, GoalUpdateRequest, GoalWithProgress,
  ListBudgetsResponse, ListCategoriesResponse, ListGoalProgressResponse, ListGoalsResponse,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';
import send from '../../api/send';

// The Account Setup Experience's endpoints (X5; OQ-175, OQ-193..195). The
// accounts are the Account Management Flow's own list, fetched as it mounts
// and patched with what each write returns; the App Shell's household gate
// reads them apart — only whether one is in use (FR-1.22, OQ-198) — in its own
// cache entry, under the one tag here, which a create or archive that went
// through invalidates; the Flow's list isn't fetched again. The categories
// (Category and Budget Management read them), the budgets and the goals — definitions
// and progress, two reads joined by goal id (OQ-177) — are the Experience's
// shared lists, fetched again by the Experience itself after each write before
// it answers the Flow. Nothing else reads them, so invalidating would only
// fetch them twice. The request shapes come straight from the contract
// (`@financas/api-types`).

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

/** What addresses a goal inside its household (FL14). */
export interface GoalTarget {
  readonly householdId: string;
  readonly goalId: string;
}

/** Which of a household's goals to list: one status at a time (OQ-177). */
export interface GoalListInput {
  readonly householdId: string;
  readonly status: 'active' | 'completed';
}

/** A create, addressed to its household (FR-8.1). */
export type CreateGoalInput = GoalCreateRequest & { readonly householdId: string };

/** An edit — name, target, target currency and/or due date, addressed to its goal (OQ-177). */
export type EditGoalInput = GoalUpdateRequest & GoalTarget;

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

/** Builds a household's goals path (FL14). */
const goalsPath = (householdId: string) => (
  `/households/${encodeURIComponent(householdId)}/goals`);

/** Builds one goal's path inside its household. */
const goalPath = ({ householdId, goalId }: GoalTarget) => (
  `${goalsPath(householdId)}/${encodeURIComponent(goalId)}`);

/**
 * Names whether a household has an account in use, once a write went
 * through; a failed one changed nothing.
 *
 * @param error - The write's failure, if any.
 * @param householdId - The household it wrote to.
 * @returns The tag to invalidate, or none.
 */
const accountsInUseTag = (error: unknown, householdId: string) => (
  error ? [] : [{ type: 'AccountsInUse' as const, id: householdId }]
);

/** The Experience's slice of the backend API. */
export const accountSetupApi = backendApi.enhanceEndpoints({
  addTagTypes: ['AccountsInUse'],
}).injectEndpoints({
  endpoints: (build) => ({
    listAccounts: build.query<readonly Account[], string>({
      query: accountsPath,
      transformResponse: (response: ListAccountsResponse) => response.data ?? [],
    }),
    // The household gate's read: whether any account isn't archived.
    hasAccountInUse: build.query<boolean, string>({
      query: accountsPath,
      transformResponse: (response: ListAccountsResponse) => (
        (response.data ?? []).some((account) => account.archivedAt === null)
      ),
      providesTags: (_result, _error, householdId) => accountsInUseTag(undefined, householdId),
    }),
    createAccount: build.mutation<Account, CreateAccountInput>({
      query: ({ householdId, ...request }) => send('POST', accountsPath(householdId), request),
      invalidatesTags: (_result, error, { householdId }) => accountsInUseTag(error, householdId),
    }),
    editAccount: build.mutation<Account, EditAccountInput>({
      query: ({ householdId, accountId, ...changes }) => (
        send('PATCH', accountPath({ householdId, accountId }), changes)
      ),
    }),
    archiveAccount: build.mutation<void, AccountTarget>({
      query: (target) => send('POST', `${accountPath(target)}/archive`),
      invalidatesTags: (_result, error, { householdId }) => accountsInUseTag(error, householdId),
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
    listGoals: build.query<readonly Goal[], GoalListInput>({
      query: ({ householdId, status }) => `${goalsPath(householdId)}?status=${status}`,
      transformResponse: (response: ListGoalsResponse) => response.data ?? [],
    }),
    // InsightsManager's reshaped read (OQ-177), built with M4: until then it
    // fails and the Flow shows the definitions alone (OQ-195).
    listGoalProgress: build.query<readonly GoalWithProgress[], GoalListInput>({
      query: ({ householdId, status }) => (
        `/households/${encodeURIComponent(householdId)}/goal-progress?status=${status}`
      ),
      transformResponse: (response: ListGoalProgressResponse) => response.data ?? [],
    }),
    createGoal: build.mutation<Goal, CreateGoalInput>({
      query: ({ householdId, ...request }) => send('POST', goalsPath(householdId), request),
    }),
    editGoal: build.mutation<Goal, EditGoalInput>({
      query: ({ householdId, goalId, ...changes }) => (
        send('PATCH', goalPath({ householdId, goalId }), changes)
      ),
    }),
    deleteGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('DELETE', goalPath(target)),
    }),
    completeGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('POST', `${goalPath(target)}/complete`),
    }),
    reopenGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('POST', `${goalPath(target)}/reopen`),
    }),
  }),
});

export const {
  useLazyListAccountsQuery,
  useHasAccountInUseQuery,
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
  useListGoalsQuery,
  useListGoalProgressQuery,
  useCreateGoalMutation,
  useEditGoalMutation,
  useDeleteGoalMutation,
  useCompleteGoalMutation,
  useReopenGoalMutation,
} = accountSetupApi;
