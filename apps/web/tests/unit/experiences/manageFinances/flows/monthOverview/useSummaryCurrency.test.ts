import { act, renderHook } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import useSummaryCurrency from '../../../../../../src/experiences/manageFinances/flows/monthOverview/useSummaryCurrency';
import type { PreferenceStorage } from '../../../../../../src/utilities/safeStorage';

// The $ / R$ switch's remembered currency (BDT: Flow state, unit; only the
// storage it is handed is faked).

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

describe('useSummaryCurrency', () => {
  it('opens on the remembered currency', () => {
    const { result } = renderHook(() => useSummaryCurrency(memoryOf('USD')));
    expect(result.current.currency).toBe('USD');
  });

  it('opens on R$ the first time', () => {
    const { result } = renderHook(() => useSummaryCurrency(memoryOf(null)));
    expect(result.current.currency).toBe('BRL');
  });

  it('switches and remembers the pick', () => {
    const memory = memoryOf(null);
    const { result } = renderHook(() => useSummaryCurrency(memory));
    act(() => result.current.changeCurrency('USD'));
    expect(result.current.currency).toBe('USD');
    expect(memory.write).toHaveBeenCalledWith('USD');
  });
});
