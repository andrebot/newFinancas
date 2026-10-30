import { createApi } from '@reduxjs/toolkit/query/react';
import { apiBaseQuery } from './baseQuery';

// The one RTK Query API (FU7, OQ-124). It starts with no endpoints: each
// Experience injects its own, with their cache tags
// (`backendApi.enhanceEndpoints({ addTagTypes }).injectEndpoints(…)` in
// `experiences/<name>/api.ts`), typed by `@financas/api-types`. Only
// Experiences may import endpoints — ESLint stops Flows, Interactions, the kit
// and Utilities from reaching the backend. The App Shell (S1) adds the reducer
// and middleware to the store and gives it the `ApiEnvironment`.
// The household's setup data — its accounts, budgets and categories — is
// shown by more than one Experience, so its tags are declared here and owned
// by none: the setup reads provide them, the writes that change the data
// invalidate them, and any other read built on that data provides them too,
// so a write on one page refreshes every page showing it (PR #145).

/** The tags of the household data several Experiences show. */
export const SHARED_TAGS = ['Accounts', 'Budgets', 'Categories'] as const;

/** One of the shared tags. */
export type SharedTag = (typeof SHARED_TAGS)[number];

/**
 * Names the data a write changed: its tags once it went through, or when it
 * says what it wrote to is already gone (when that is worth a refresh); none
 * when it failed otherwise.
 *
 * @param tags - The data the write changes.
 * @param error - The write's failure, if any.
 * @param goneCode - The code saying the target is gone, e.g. `budget.not_found`.
 * @returns The tags to invalidate.
 */
export const changedTags = <const Tag extends string>(
  tags: readonly Tag[],
  error: unknown,
  goneCode?: string,
): Tag[] => {
  const gone = typeof error === 'object' && error !== null
    && 'code' in error && error.code === goneCode;
  return error === undefined || gone ? [...tags] : [];
};

/** The backend API, ready for Experiences to inject endpoints into. */
const backendApi = createApi({
  reducerPath: 'backendApi',
  baseQuery: apiBaseQuery,
  tagTypes: SHARED_TAGS,
  endpoints: () => ({}),
});

export default backendApi;
