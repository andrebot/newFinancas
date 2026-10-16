import { describe, expect, it } from 'vitest';
import { identityApi } from '../../../../src/api/identityApi';
import { moveOnFrom } from '../../../../src/experiences/manageHousehold/householdExit';
import { householdChosen, selectActiveHouseholdId } from '../../../../src/shell/shellState';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeStore } from '../../shell/shellFakes';
import { fakeFetch } from '../hookFakes';

// The way out of a household gone (BDT: the thunk over the real store, the
// shell's switch and the API client; only `fetch` is fake).

const SMITH = {
  id: 'smith', name: 'The Smith Household', createdAt: '2026-02-01T00:00:00Z', role: 'Member',
};

/**
 * Builds the real store, signed in with Doe active and the households cached.
 *
 * @param households - What `GET /households` answers now.
 * @returns The store and the remembered household.
 */
const storeAfterLeaving = async (households: () => Response) => {
  const doe = { ...SMITH, id: 'doe', name: 'The Doe Household' };
  let answer = () => jsonResponse(200, { data: [doe] });
  const fetchFn = fakeFetch({ '/households': () => answer() });
  const { store, householdMemory } = fakeStore({ refreshToken: 'r-0', fetchFn });
  store.dispatch(householdChosen('doe'));
  const cached = store.dispatch(identityApi.endpoints.listHouseholds.initiate());
  await cached;
  cached.unsubscribe();
  answer = households;
  return { store, householdMemory, fetchFn };
};

describe('moveOnFrom', () => {
  it('switches to the next household and lands on its Dashboard', async () => {
    const { store, householdMemory, fetchFn } = await storeAfterLeaving(
      () => jsonResponse(200, { data: [SMITH] }),
    );

    await expect(store.dispatch(moveOnFrom('doe'))).resolves.toBe('dashboard');

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(selectActiveHouseholdId(store.getState())).toBe('smith');
    expect(householdMemory.value).toBe('smith');
  });

  it('never picks the household gone, should the list still hold it', async () => {
    const { store } = await storeAfterLeaving(() => jsonResponse(200, {
      data: [{ ...SMITH, id: 'doe' }, SMITH],
    }));

    await store.dispatch(moveOnFrom('doe'));

    expect(selectActiveHouseholdId(store.getState())).toBe('smith');
  });

  it('sends the user to Onboard with no household left', async () => {
    const { store } = await storeAfterLeaving(() => jsonResponse(200, { data: [] }));

    await expect(store.dispatch(moveOnFrom('doe'))).resolves.toBe('onboard');

    expect(selectActiveHouseholdId(store.getState())).toBe('doe');
  });

  it('drops the cache when the list can’t be fetched, so the gate asks again', async () => {
    const { store } = await storeAfterLeaving(
      () => jsonResponse(500, envelope('internal.unexpected')),
    );

    await expect(store.dispatch(moveOnFrom('doe'))).resolves.toBe('dashboard');

    const selectHouseholds = identityApi.endpoints.listHouseholds.select();
    const households = selectHouseholds(
      store.getState() as unknown as Parameters<typeof selectHouseholds>[0],
    );
    expect(households.status).toBe('uninitialized');
  });
});
