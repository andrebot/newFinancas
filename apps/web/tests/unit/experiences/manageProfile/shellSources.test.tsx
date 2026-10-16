import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  useIdentity, usePendingInvitationCount,
} from '../../../../src/experiences/manageProfile/shellSources';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeFetch, runHook as run } from '../hookFakes';

// The sources the App Shell reads (BDT: the query hooks over the real store
// and API client; only `fetch` is fake).

const USER = {
  id: 'jane',
  email: 'jane.doe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: '2026-01-01T00:00:00Z',
  preferences: { theme: 'light', language: 'pt-BR' },
};

describe('useIdentity', () => {
  it('loads, then gives the user with their saved preferences', async () => {
    const result = run(useIdentity, fakeFetch({ '/users/me': () => jsonResponse(200, USER) }));
    expect(result.current).toEqual({ status: 'loading' });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toEqual({
      status: 'ready',
      data: {
        id: 'jane',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        theme: 'light',
        language: 'pt-BR',
      },
    });
  });

  it('fails with a retry when the profile can’t load', async () => {
    const result = run(useIdentity, fakeFetch({
      '/users/me': () => jsonResponse(500, envelope('internal.unexpected')),
    }));

    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
});

describe('usePendingInvitationCount', () => {
  it('is 0 until the list loads, then counts the invitations', async () => {
    const result = run(usePendingInvitationCount, fakeFetch({
      '/users/me/invitations': () => jsonResponse(200, { data: [{ id: 'one' }, { id: 'two' }] }),
    }));
    expect(result.current).toBe(0);

    await waitFor(() => expect(result.current).toBe(2));
  });
});
