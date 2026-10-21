import type {
  Account, AccountCreateRequest, ListAccountsResponse, AccountUpdateRequest, Category,
  CategoryColor, CategoryIcon, CategoryUpdateRequest, ListCategoriesResponse,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';

// The Account Setup Experience's endpoints (X5; OQ-175/FL12). The accounts are
// cached per household under the `Accounts` tag and the categories under the
// `Categories` one: create, edit and archive all invalidate their tag, so the
// list refetches after any change. The request shapes come straight from the
// contract (`@financas/api-types`).

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
 * Builds a request with a method and an optional JSON body.
 *
 * @param method - The HTTP method.
 * @param url - The path, relative to the API's base URL.
 * @param body - The JSON body, if any.
 * @returns The request's fetch arguments.
 */
const send = (method: string, url: string, body?: object) => ({ url, method, body });

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

/** Names the cached accounts of one household. */
const accountsTag = (householdId: string) => [{ type: 'Accounts' as const, id: householdId }];

/** Builds a household's categories path (FL12). */
const categoriesPath = (householdId: string) => (
  `/households/${encodeURIComponent(householdId)}/categories`);

/** Builds one category's path inside its household. */
const categoryPath = ({ householdId, categoryId }: CategoryTarget) => (
  `${categoriesPath(householdId)}/${encodeURIComponent(categoryId)}`);

/** Names the cached categories of one household. */
const categoriesTag = (householdId: string) => [{ type: 'Categories' as const, id: householdId }];

/** The Experience's slice of the backend API. */
export const accountSetupApi = backendApi.enhanceEndpoints({
  addTagTypes: ['Accounts', 'Categories'],
}).injectEndpoints({
  endpoints: (build) => ({
    listAccounts: build.query<readonly Account[], string>({
      query: accountsPath,
      transformResponse: (response: ListAccountsResponse) => response.data ?? [],
      providesTags: (_result, _error, householdId) => accountsTag(householdId),
    }),
    createAccount: build.mutation<Account, CreateAccountInput>({
      query: ({ householdId, ...request }) => send('POST', accountsPath(householdId), request),
      invalidatesTags: (_result, _error, { householdId }) => accountsTag(householdId),
    }),
    editAccount: build.mutation<Account, EditAccountInput>({
      query: ({ householdId, accountId, ...changes }) => (
        send('PATCH', accountPath({ householdId, accountId }), changes)
      ),
      invalidatesTags: (_result, _error, { householdId }) => accountsTag(householdId),
    }),
    archiveAccount: build.mutation<void, AccountTarget>({
      query: (target) => send('POST', `${accountPath(target)}/archive`),
      invalidatesTags: (_result, _error, { householdId }) => accountsTag(householdId),
    }),
    listCategories: build.query<readonly Category[], string>({
      query: (householdId) => `${categoriesPath(householdId)}?includeArchived=true`,
      transformResponse: (response: ListCategoriesResponse) => response.data ?? [],
      providesTags: (_result, _error, householdId) => categoriesTag(householdId),
    }),
    createCategory: build.mutation<Category, CreateCategoryInput>({
      query: ({ householdId, ...request }) => send('POST', categoriesPath(householdId), request),
      invalidatesTags: (_result, _error, { householdId }) => categoriesTag(householdId),
    }),
    editCategory: build.mutation<Category, EditCategoryInput>({
      query: ({ householdId, categoryId, ...changes }) => (
        send('PATCH', categoryPath({ householdId, categoryId }), changes)
      ),
      invalidatesTags: (_result, _error, { householdId }) => categoriesTag(householdId),
    }),
    archiveCategory: build.mutation<void, CategoryTarget>({
      query: (target) => send('POST', `${categoryPath(target)}/archive`),
      invalidatesTags: (_result, _error, { householdId }) => categoriesTag(householdId),
    }),
    archiveSubcategory: build.mutation<void, SubcategoryTarget>({
      query: ({ householdId, categoryId, subcategoryId }) => {
        const base = categoryPath({ householdId, categoryId });
        return send('POST', `${base}/subcategories/${encodeURIComponent(subcategoryId)}/archive`);
      },
      invalidatesTags: (_result, _error, { householdId }) => categoriesTag(householdId),
    }),
  }),
});

export const {
  useListAccountsQuery,
  useLazyListAccountsQuery,
  useCreateAccountMutation,
  useEditAccountMutation,
  useArchiveAccountMutation,
  useLazyListCategoriesQuery,
  useCreateCategoryMutation,
  useEditCategoryMutation,
  useArchiveCategoryMutation,
  useArchiveSubcategoryMutation,
} = accountSetupApi;
