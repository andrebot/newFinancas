import type {
  Account, AccountCreateRequest, ListAccountsResponse, AccountUpdateRequest, Category,
  CategoryColor, CategoryIcon, CategoryUpdateRequest, ListCategoriesResponse,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';
import send from '../../api/send';

// The Account Setup Experience's endpoints (X5; OQ-175, OQ-193). No tags: the
// accounts are the Account Management Flow's own list, fetched as it mounts and
// patched with what each write returns; the categories are the Experience's
// shared list (Category and Budget Management read it), fetched again by the
// Experience itself after each write before it answers the Flow. Nothing else
// reads either, so invalidating would only fetch them twice. The request
// shapes come straight from the contract (`@financas/api-types`).

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

/** The Experience's slice of the backend API. */
export const accountSetupApi = backendApi.injectEndpoints({
  endpoints: (build) => ({
    listAccounts: build.query<readonly Account[], string>({
      query: accountsPath,
      transformResponse: (response: ListAccountsResponse) => response.data ?? [],
    }),
    createAccount: build.mutation<Account, CreateAccountInput>({
      query: ({ householdId, ...request }) => send('POST', accountsPath(householdId), request),
    }),
    editAccount: build.mutation<Account, EditAccountInput>({
      query: ({ householdId, accountId, ...changes }) => (
        send('PATCH', accountPath({ householdId, accountId }), changes)
      ),
    }),
    archiveAccount: build.mutation<void, AccountTarget>({
      query: (target) => send('POST', `${accountPath(target)}/archive`),
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
  }),
});

export const {
  useLazyListAccountsQuery,
  useCreateAccountMutation,
  useEditAccountMutation,
  useArchiveAccountMutation,
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useEditCategoryMutation,
  useArchiveCategoryMutation,
  useArchiveSubcategoryMutation,
} = accountSetupApi;
