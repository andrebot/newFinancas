import { createApi } from '@reduxjs/toolkit/query/react';
import { apiBaseQuery } from './baseQuery';

// The one RTK Query API (FU7, OQ-124). It starts with no endpoints: each
// Experience injects its own, with their cache tags
// (`backendApi.enhanceEndpoints({ addTagTypes }).injectEndpoints(…)` in
// `experiences/<name>/api.ts`), typed by `@financas/api-types`. Only
// Experiences may import endpoints — ESLint stops Flows, Interactions, the kit
// and Utilities from reaching the backend. The App Shell (S1) adds the reducer
// and middleware to the store and gives it the `ApiEnvironment`.

/** The backend API, ready for Experiences to inject endpoints into. */
const backendApi = createApi({
  reducerPath: 'backendApi',
  baseQuery: apiBaseQuery,
  endpoints: () => ({}),
});

export default backendApi;
