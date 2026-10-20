import type {
  Account, AccountCreateRequest, ListAccountsResponse, AccountUpdateRequest,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';

// The Account Setup Experience's endpoints (X5/FL11; OQ-175). The accounts are
// cached per household under the `Accounts` tag: create, edit and archive all
// invalidate it, so the list refetches after any change. The request shapes
// come straight from the contract (`@financas/api-types`).

/** What addresses an account inside its household. */
export interface AccountTarget {
  readonly householdId: string;
  readonly accountId: string;
}

/** A create, addressed to its household. */
export type CreateAccountInput = AccountCreateRequest & { readonly householdId: string };

/** An edit, addressed to its account. */
export type EditAccountInput = AccountUpdateRequest & AccountTarget;

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

/** The Experience's slice of the backend API. */
export const accountSetupApi = backendApi.enhanceEndpoints({
  addTagTypes: ['Accounts'],
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
  }),
});

export const {
  useListAccountsQuery,
  useLazyListAccountsQuery,
  useCreateAccountMutation,
  useEditAccountMutation,
  useArchiveAccountMutation,
} = accountSetupApi;
