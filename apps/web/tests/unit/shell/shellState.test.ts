import {
  describe, expect, it, vi,
} from 'vitest';
import backendApi from '../../../src/api/backendApi';
import { sessionEnded } from '../../../src/api/baseQuery';
import {
  chooseActiveHousehold, householdChosen, initialShellState, selectActiveHouseholdId,
  selectSession, sessionStarted, settleActiveHousehold, shellReducer, switchHousehold,
} from '../../../src/shell/shellState';
import { jsonResponse } from '../api/fakes';
import {
  DOE, fakeStore, HOUSEHOLDS, RIVERA,
} from './shellFakes';

// The shell's state (BDT: Utility-like state → unit). The reducer is pure;
// the thunks run on the real store over fake storage and `fetch`.

/** An endpoint injected as an Experience would, to fill the API cache. */
const probeApi = backendApi.injectEndpoints({
  endpoints: (build) => ({
    probe: build.query<unknown, void>({ query: () => '/probe' }),
  }),
});

describe('shellReducer', () => {
  it('starts signed in only when a session survives from before', () => {
    expect(initialShellState(true)).toEqual({ session: 'signedIn', activeHouseholdId: null });
    expect(initialShellState(false).session).toBe('signedOut');
  });

  it('starts a session, picks a household, and forgets both when the session ends', () => {
    const started = shellReducer(initialShellState(false), sessionStarted());
    const chosen = shellReducer(started, householdChosen('doe'));
    expect(chosen).toEqual({ session: 'signedIn', activeHouseholdId: 'doe' });
    expect(shellReducer(chosen, sessionEnded())).toEqual(initialShellState(false));
  });

  it('is read through its selectors', () => {
    const state = { shell: { session: 'signedIn' as const, activeHouseholdId: 'doe' } };
    expect(selectSession(state)).toBe('signedIn');
    expect(selectActiveHouseholdId(state)).toBe('doe');
  });
});

describe('chooseActiveHousehold', () => {
  it('keeps the preferred household while the user belongs to it', () => {
    expect(chooseActiveHousehold(HOUSEHOLDS, 'rivera')).toBe('rivera');
  });

  it('falls back to the first household, or none', () => {
    expect(chooseActiveHousehold(HOUSEHOLDS, 'gone')).toBe('doe');
    expect(chooseActiveHousehold(HOUSEHOLDS, null)).toBe('doe');
    expect(chooseActiveHousehold([], 'doe')).toBeNull();
  });
});

describe('settleActiveHousehold', () => {
  it('returns to the remembered household', () => {
    const { store } = fakeStore({ rememberedHousehold: 'rivera' });
    store.dispatch(settleActiveHousehold(HOUSEHOLDS));
    expect(selectActiveHouseholdId(store.getState())).toBe('rivera');
  });

  it('picks and remembers the first one when the remembered one is gone', () => {
    const { store, householdMemory } = fakeStore({ rememberedHousehold: 'gone' });
    store.dispatch(settleActiveHousehold(HOUSEHOLDS));
    expect(selectActiveHouseholdId(store.getState())).toBe('doe');
    expect(householdMemory.value).toBe('doe');
  });

  it('keeps the current household over the remembered one, and does nothing then', () => {
    const { store, householdMemory } = fakeStore({ rememberedHousehold: 'doe' });
    store.dispatch(householdChosen('rivera'));
    const write = vi.spyOn(householdMemory, 'write');
    store.dispatch(settleActiveHousehold(HOUSEHOLDS));
    expect(selectActiveHouseholdId(store.getState())).toBe('rivera');
    expect(write).not.toHaveBeenCalled();
  });

  it('moves off a household the user left', () => {
    const { store } = fakeStore();
    store.dispatch(householdChosen('doe'));
    store.dispatch(settleActiveHousehold([RIVERA]));
    expect(selectActiveHouseholdId(store.getState())).toBe('rivera');
  });

  it('chooses nothing when the user has no household', () => {
    const { store } = fakeStore();
    store.dispatch(settleActiveHousehold([]));
    expect(selectActiveHouseholdId(store.getState())).toBeNull();
  });
});

describe('switchHousehold', () => {
  it('switches, remembers it and drops every cached answer', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(200, { ok: true }));
    const { store, householdMemory } = fakeStore({ fetchFn });
    store.dispatch(householdChosen(DOE.id));
    await store.dispatch(probeApi.endpoints.probe.initiate());
    expect(Object.keys(store.getState().backendApi.queries)).toHaveLength(1);

    store.dispatch(switchHousehold(RIVERA.id));

    expect(selectActiveHouseholdId(store.getState())).toBe('rivera');
    expect(householdMemory.value).toBe('rivera');
    expect(store.getState().backendApi.queries).toEqual({});
  });

  it('does nothing when the household is already active', async () => {
    const { store, householdMemory } = fakeStore();
    store.dispatch(householdChosen(DOE.id));
    await store.dispatch(probeApi.endpoints.probe.initiate());

    store.dispatch(switchHousehold(DOE.id));

    expect(householdMemory.value).toBeNull();
    expect(Object.keys(store.getState().backendApi.queries)).toHaveLength(1);
  });
});
