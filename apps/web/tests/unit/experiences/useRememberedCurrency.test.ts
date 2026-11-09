import { act, renderHook } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import useRememberedCurrency, { rememberedCurrency } from '../../../src/experiences/useRememberedCurrency';
import type { PreferenceStorage } from '../../../src/utilities/safeStorage';

// A $ / R$ switch's remembered currency (BDT: Flow state, unit; only the
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

describe('rememberedCurrency', () => {
  it('reads a remembered currency', () => {
    expect(rememberedCurrency('USD')).toBe('USD');
  });

  it('opens on R$ when nothing is remembered', () => {
    expect(rememberedCurrency(null)).toBe('BRL');
  });

  it('opens on R$ when what is stored is not a currency', () => {
    expect(rememberedCurrency('EUR')).toBe('BRL');
  });
});

describe('useRememberedCurrency', () => {
  it('opens on the remembered currency', () => {
    const { result } = renderHook(() => useRememberedCurrency(memoryOf('USD')));
    expect(result.current.currency).toBe('USD');
  });

  it('opens on R$ the first time', () => {
    const { result } = renderHook(() => useRememberedCurrency(memoryOf(null)));
    expect(result.current.currency).toBe('BRL');
  });

  it('switches and remembers the pick', () => {
    const memory = memoryOf(null);
    const { result } = renderHook(() => useRememberedCurrency(memory));
    act(() => result.current.changeCurrency('USD'));
    expect(result.current.currency).toBe('USD');
    expect(memory.write).toHaveBeenCalledWith('USD');
  });
});
