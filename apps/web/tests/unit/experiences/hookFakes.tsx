import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import { envelope, jsonResponse } from '../api/fakes';
import { fakeStore } from '../shell/shellFakes';

// Shared fakes for testing an Experience's query hooks (X3): the real store
// and API client, signed in, over a fake `fetch`.

/**
 * Builds a fake `fetch` answering each path from a table.
 *
 * @param answers - The answer per path (after `/api/v1`).
 * @returns The fake.
 */
export const fakeFetch = (answers: Readonly<Record<string, () => Response>>) => (
  vi.fn<typeof fetch>(async (input) => {
    const path = new URL((input as Request).url).pathname.replace('/api/v1', '');
    return answers[path]?.() ?? jsonResponse(404, envelope('route.not_found'));
  })
);

/**
 * Runs a hook over the real store.
 *
 * @param hook - The hook.
 * @param fetchFn - The fake `fetch`.
 * @returns The hook's result.
 */
export const runHook = <Result,>(hook: () => Result, fetchFn: typeof fetch) => {
  const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
  /**
   * Wraps the hook in the store.
   *
   * @param props - The hook's tree.
   * @returns The wrapped tree.
   */
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(hook, { wrapper }).result;
};
