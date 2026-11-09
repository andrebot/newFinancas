import type { InvestmentHolding } from '@financas/api-types';
import { act, renderHook } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import usePayoutSelection from '../../../src/experiences/usePayoutSelection';
import type { PreferenceStorage } from '../../../src/utilities/safeStorage';

// The payout chart's remembered Holdings (BDT: Experience state, unit; only
// the storage it is handed is faked).

const HOLDINGS: InvestmentHolding[] = [{ id: 'h1' }, { id: 'h2' }];

/**
 * Builds a storage holding a value.
 *
 * @param stored - What it holds.
 * @returns The storage, its write a spy.
 */
const memoryOf = (stored: string | null): PreferenceStorage => ({
  read: () => stored,
  write: vi.fn(),
});

describe('usePayoutSelection', () => {
  it('opens on every Holding the first time', () => {
    const { result } = renderHook(() => usePayoutSelection(memoryOf(null)));
    expect(result.current.selection).toBe('all');
  });

  it('opens on the remembered choice', () => {
    const { result } = renderHook(() => usePayoutSelection(memoryOf('["h2"]')));
    expect(result.current.selection).toEqual(['h2']);
  });

  it('remembers a partial choice as its ids', () => {
    const memory = memoryOf(null);
    const { result } = renderHook(() => usePayoutSelection(memory));
    act(() => result.current.choose(['h1'], HOLDINGS));
    expect(result.current.selection).toEqual(['h1']);
    expect(memory.write).toHaveBeenCalledWith('["h1"]');
  });

  it('reads another household\'s storage afresh, never carrying a choice over', () => {
    const first = memoryOf(null);
    const { result, rerender } = renderHook(
      ({ memory }) => usePayoutSelection(memory),
      { initialProps: { memory: first } },
    );
    act(() => result.current.choose(['h1'], HOLDINGS));
    const second = memoryOf('["h2"]');
    rerender({ memory: second });
    expect(result.current.selection).toEqual(['h2']);
    act(() => result.current.choose(['h1', 'h2'], HOLDINGS));
    expect(second.write).toHaveBeenCalledWith('"all"');
    expect(result.current.selection).toBe('all');
  });

  it('remembers every Holding chosen as "all"', () => {
    const memory = memoryOf('["h1"]');
    const { result } = renderHook(() => usePayoutSelection(memory));
    act(() => result.current.choose(['h1', 'h2'], HOLDINGS));
    expect(result.current.selection).toBe('all');
    expect(memory.write).toHaveBeenCalledWith('"all"');
  });
});
