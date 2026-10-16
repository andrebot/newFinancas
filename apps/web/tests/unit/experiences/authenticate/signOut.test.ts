import {
  describe, expect, it, vi,
} from 'vitest';
import signOut from '../../../../src/experiences/authenticate/signOut';
import { selectSession } from '../../../../src/shell/shellState';
import { jsonResponse } from '../../api/fakes';
import { fakeStore } from '../../shell/shellFakes';

// Sign Out (BDT: Experience seam → integration over the real store; only
// `fetch` is fake).

/**
 * Builds a signed-in store whose `fetch` records the session state it was
 * called in.
 *
 * @param answer - What `fetch` does.
 * @returns The store, its fakes, the fake `fetch` and the recorded states.
 */
const signedInStore = (answer: () => Promise<Response>) => {
  const sessionsSeen: string[] = [];
  const holder: { store?: ReturnType<typeof fakeStore>['store'] } = {};
  const fetchFn = vi.fn<typeof fetch>(async () => {
    sessionsSeen.push(selectSession(holder.store!.getState()));
    return answer();
  });
  const fakes = fakeStore({ refreshToken: 'refresh-1', fetchFn });
  holder.store = fakes.store;
  fakes.api.tokens.save({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  return { ...fakes, fetchFn, sessionsSeen };
};

describe('signOut', () => {
  it('logs this session out on the server, then ends it here', async () => {
    const {
      store, fetchFn, sessionsSeen, tokenStorage,
    } = signedInStore(async () => jsonResponse(204));

    await store.dispatch(signOut());

    const request = fetchFn.mock.calls[0]?.[0] as Request;
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/api/v1/auth/logout');
    expect(request.headers.get('Authorization')).toBe('Bearer access-1');
    expect(sessionsSeen).toEqual(['signedIn']);
    expect(selectSession(store.getState())).toBe('signedOut');
    expect(tokenStorage.value).toBeNull();
  });

  it('ends the session here even when the logout gets no answer', async () => {
    const { store, tokenStorage } = signedInStore(
      () => Promise.reject(new TypeError('Failed to fetch')),
    );

    await store.dispatch(signOut());

    expect(selectSession(store.getState())).toBe('signedOut');
    expect(tokenStorage.value).toBeNull();
  });
});
