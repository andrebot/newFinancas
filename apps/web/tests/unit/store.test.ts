import { describe, expect, it } from 'vitest';
import backendApi from '../../src/api/backendApi';
import { sessionEnded } from '../../src/api/baseQuery';
import { selectSession } from '../../src/shell/shellState';
import { fakeStore } from './shell/shellFakes';

// The page's store (BDT: composition → unit over fake surroundings).

const probeApi = backendApi.injectEndpoints({
  endpoints: (build) => ({
    storeProbe: build.query<unknown, void>({ query: () => '/probe' }),
  }),
});

describe('createAppStore', () => {
  it('loads signed in when a refresh token survives from before', () => {
    const kept = fakeStore({ refreshToken: 'refresh-1' }).store;
    expect(selectSession(kept.getState())).toBe('signedIn');
    expect(selectSession(fakeStore().store.getState())).toBe('signedOut');
  });

  it('runs injected endpoints through the API environment', async () => {
    const { store } = fakeStore();
    const result = await store.dispatch(probeApi.endpoints.storeProbe.initiate());
    expect(result.data).toEqual({});
  });

  it('forgets the tokens and every cached answer when the session ends', async () => {
    const { store, api, tokenStorage } = fakeStore({ refreshToken: 'refresh-1' });
    api.tokens.save({ accessToken: 'access-1', refreshToken: 'refresh-2' });
    await store.dispatch(probeApi.endpoints.storeProbe.initiate());

    store.dispatch(sessionEnded());

    expect(api.tokens.accessToken()).toBeUndefined();
    expect(tokenStorage.value).toBeNull();
    expect(store.getState().backendApi.queries).toEqual({});
    expect(selectSession(store.getState())).toBe('signedOut');
  });
});
