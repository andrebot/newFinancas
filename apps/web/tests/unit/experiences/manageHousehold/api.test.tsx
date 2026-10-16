import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHouseholds } from '../../../../src/experiences/manageHousehold/api';
import { jsonResponse } from '../../api/fakes';
import { fakeFetch, runHook as run } from '../hookFakes';

// The households source the App Shell's gate reads (BDT: the query hook over
// the real store and API client; only `fetch` is fake).

describe('useHouseholds', () => {
  it('gives the households with the user’s role in each', async () => {
    const doe = {
      id: 'doe', name: 'The Doe Household', createdAt: '2026-01-01T00:00:00Z', role: 'Owner',
    };
    const result = run(useHouseholds, fakeFetch({
      '/households': () => jsonResponse(200, { data: [doe] }),
    }));

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: [doe] }));
  });

  it('reads an answer with no list as none', async () => {
    const result = run(useHouseholds, fakeFetch({ '/households': () => jsonResponse(200, {}) }));

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: [] }));
  });
});
