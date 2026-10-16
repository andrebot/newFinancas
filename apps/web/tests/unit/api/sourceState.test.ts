import {
  describe, expect, it, vi,
} from 'vitest';
import { toSourceState } from '../../../src/api/sourceState';

// Utility (BDT: unit, mocking nothing): a query's flags in, the shell's
// source state out.

describe('toSourceState', () => {
  it('is ready with the data itself, even while it is fetched again or failed', () => {
    const data = [{ id: 'doe' }];

    const state = toSourceState({ data, isError: true, refetch: vi.fn() });

    expect(state).toEqual({ status: 'ready', data });
    expect(state.status === 'ready' && state.data).toBe(data);
  });

  it('fails with a retry that fetches again when there is no data', () => {
    const refetch = vi.fn();

    const state = toSourceState({ data: undefined, isError: true, refetch });
    if (state.status === 'failed') state.retry();

    expect(state.status).toBe('failed');
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('is loading otherwise', () => {
    expect(toSourceState({ isError: false, refetch: vi.fn() })).toEqual({ status: 'loading' });
  });
});
