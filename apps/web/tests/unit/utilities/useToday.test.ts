import { act, renderHook } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import useToday, { isoDateOf, msUntilMidnight } from '../../../src/utilities/useToday';

// Utility (BDT: unit, mocking nothing but the clock).

describe('isoDateOf', () => {
  it('writes the local date, padded', () => {
    expect(isoDateOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('msUntilMidnight', () => {
  it('counts to the start of the next local day', () => {
    expect(msUntilMidnight(new Date(2026, 9, 31, 23, 59, 0))).toBe(60_000);
  });

  it('counts a whole day from midnight itself', () => {
    expect(msUntilMidnight(new Date(2026, 9, 22))).toBe(24 * 60 * 60 * 1000);
  });
});

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds today, and moves on at midnight and the one after', () => {
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-10-31');

    act(() => vi.advanceTimersByTime(59_999));
    expect(result.current).toBe('2026-10-31');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('2026-11-01');

    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(result.current).toBe('2026-11-02');
  });

  it('stops its timer once unmounted', () => {
    const { unmount } = renderHook(() => useToday());
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
