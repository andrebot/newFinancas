import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { useActiveHousehold } from '../../../src/shell/activeHousehold';
import { householdChosen } from '../../../src/shell/shellState';
import { fakeFetch } from '../experiences/hookFakes';
import { fakeStore } from './shellFakes';
import { envelope, jsonResponse } from '../api/fakes';

// The household page's starting point (BDT: the query hooks over the real
// store and API client; only `fetch` is fake).

const USER = {
  id: 'jane',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: '2024-01-01T00:00:00Z',
  preferences: { theme: 'dark', language: 'en-US' },
};

const DOE = {
  id: 'doe', name: 'The Doe Household', createdAt: '2024-01-01T00:00:00Z', role: 'Owner',
};

/**
 * Runs the hook over the real store, with a household chosen.
 *
 * @param answers - The API's answer per path.
 * @param activeId - The household chosen, if any.
 * @returns The hook's result and the fake `fetch`.
 */
const run = (answers: Readonly<Record<string, () => Response>>, activeId?: string) => {
  const fetchFn = fakeFetch(answers);
  const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
  if (activeId) store.dispatch(householdChosen(activeId));
  /**
   * Wraps the hook in the store.
   *
   * @param props - The hook's tree.
   * @returns The wrapped tree.
   */
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { result: renderHook(useActiveHousehold, { wrapper }).result, fetchFn };
};

const HOUSEHOLDS = () => jsonResponse(200, { data: [DOE] });

describe('useActiveHousehold', () => {
  it('gives the user’s id and the active household once both are known', async () => {
    const { result } = run(
      { '/users/me': () => jsonResponse(200, USER), '/households': HOUSEHOLDS },
      'doe',
    );

    await waitFor(() => expect(result.current).toEqual({
      status: 'ready', data: { userId: 'jane', household: DOE },
    }));
  });

  it('stays loading while the active household isn’t in the list', async () => {
    const { result, fetchFn } = run(
      { '/users/me': () => jsonResponse(200, USER), '/households': HOUSEHOLDS },
      'gone',
    );

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual({ status: 'loading' });
  });

  it('fails with a retry when the user can’t be fetched', async () => {
    let userAnswers = 0;
    const { result } = run({
      '/users/me': () => {
        userAnswers += 1;
        return userAnswers === 1
          ? jsonResponse(500, envelope('internal.unexpected'))
          : jsonResponse(200, USER);
      },
      '/households': HOUSEHOLDS,
    }, 'doe');

    await waitFor(() => expect(result.current.status).toBe('failed'));
    const failed = result.current;
    if (failed.status !== 'failed') throw new Error('the failure is gone');
    await act(async () => failed.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
