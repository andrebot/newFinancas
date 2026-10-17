// The state of one piece of data an Experience provides (S1, OQ-156): loading,
// ready with the data, or failed with a retry. A display type, so the App
// Shell's chrome and its Interactions can take it without knowing where the
// data comes from (`api/sourceState.ts` builds it from a query; OQ-163).

/** One piece of data an Experience provides, as its query reports it. */
export type SourceState<Data> = { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: Data }
  | { readonly status: 'failed'; readonly retry: () => void };
