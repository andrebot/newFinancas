import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import {
  afterEach, describe, expect, it,
} from 'vitest';
import usePayoutChart from '../../../src/experiences/usePayoutChart';
import { jsonResponse } from '../api/fakes';
import { fakeFetch, settle } from './experienceFakes';
import { fakeStore } from '../shell/shellFakes';

// The payout chart's inputs (BDT: unit over the real store and API client —
// only `fetch` is fake): the remembered choice is each household's own, also
// across a household switch, which remounts neither Investments nor the
// Dashboard (R5 V4).

const KEY = 'financas.payouts.holdings';

/**
 * Answers a household's Holdings list.
 *
 * @param ids - The Holdings' ids.
 * @returns The answer.
 */
const holdingsOf = (ids: readonly string[]) => () => jsonResponse(200, {
  data: ids.map((id) => ({ id, accountId: 'brokerage', assetType: 'stock' })),
});

/**
 * Renders the hook for a household over a store whose API knows two households.
 *
 * @param householdId - The household it opens on.
 * @returns The hook's handle.
 */
const renderFor = (householdId: string) => {
  const fetchFn = fakeFetch({
    'GET /households/home/holdings': holdingsOf(['h-1', 'h-2']),
    'GET /households/rivera/holdings': holdingsOf(['h-3', 'h-4']),
    'GET /households/home/reports/payouts': () => jsonResponse(200, {}),
    'GET /households/rivera/reports/payouts': () => jsonResponse(200, {}),
  });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  /**
   * Wraps the hook in the store.
   *
   * @param props - The children.
   * @param props.children - The hook's host.
   * @returns The wrapped tree.
   */
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook((id: string) => usePayoutChart(id), { initialProps: householdId, wrapper });
};

afterEach(() => {
  window.localStorage.clear();
});

describe('usePayoutChart', () => {
  it('reads and writes the choice of the household now shown, after a switch', async () => {
    window.localStorage.setItem(`${KEY}.home`, JSON.stringify(['h-1']));
    window.localStorage.setItem(`${KEY}.rivera`, JSON.stringify(['h-4']));
    const hook = renderFor('home');
    await settle();
    expect(hook.result.current.chosen).toEqual(['h-1']);

    hook.rerender('rivera');
    await settle();
    expect(hook.result.current.chosen).toEqual(['h-4']);

    act(() => hook.result.current.onChosenChange(['h-3']));
    expect(window.localStorage.getItem(`${KEY}.rivera`)).toBe(JSON.stringify(['h-3']));
    expect(window.localStorage.getItem(`${KEY}.home`)).toBe(JSON.stringify(['h-1']));
  });
});
