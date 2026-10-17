import type { SourceState } from '../utilities/sourceState';

// How an Experience hands the App Shell a query's data (S1, OQ-156; X3,
// OQ-159): the query hook's flags turned into the shell's `SourceState` —
// ready once there is data, failed with a retry, loading otherwise. Data kept
// from before stays ready while it is fetched again.

/** The part of an RTK Query hook's result a source reads. */
export interface QueryFlags<Data> {
  readonly data?: Data | undefined;
  readonly isError: boolean;
  readonly refetch: () => unknown;
}

/**
 * Turns a query hook's result into a shell source.
 *
 * @param query - The hook's data, error flag and refetch.
 * @returns The source's state; the data itself, so it keeps its identity.
 */
export const toSourceState = <Data>(query: QueryFlags<Data>): SourceState<Data> => {
  if (query.data !== undefined) {
    return { status: 'ready', data: query.data };
  }
  if (query.isError) {
    return {
      status: 'failed',
      retry: () => {
        query.refetch();
      },
    };
  }
  return { status: 'loading' };
};
