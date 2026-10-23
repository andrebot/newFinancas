import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useAccountInUse from '../../../../src/experiences/accountSetup/shellSources';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeFetch, runHook as run } from '../hookFakes';

// The source the App Shell's household gate reads (BDT: the query hook over
// the real store and API client; only `fetch` is fake).

describe('useAccountInUse', () => {
  it('loads, then tells whether the household has an account in use', async () => {
    const result = run(() => useAccountInUse('doe'), fakeFetch({
      '/households/doe/accounts': () => jsonResponse(200, { data: [] }),
    }));
    expect(result.current).toEqual({ status: 'loading' });

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: false }));
  });

  it('fails with a retry when the accounts can’t load', async () => {
    const result = run(() => useAccountInUse('doe'), fakeFetch({
      '/households/doe/accounts': () => jsonResponse(500, envelope('internal.unexpected')),
    }));

    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
});
