import { act, renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import useMediaQuery, { mediaMatches, watchMedia } from '../../../src/utilities/useMediaQuery';

// MediaQueryUtility (BDT: Utility → unit, only the window's matchMedia faked —
// jsdom has none).

/**
 * Fakes `matchMedia` with one query list whose answer the test flips.
 *
 * @param initial - Whether it matches at first.
 * @returns The list's controls.
 */
const fakeMedia = (initial: boolean) => {
  let matches = initial;
  const listeners = new Set<() => void>();
  const list = {
    get matches() {
      return matches;
    },
    addEventListener: vi.fn((_: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_: string, listener: () => void) => listeners.delete(listener)),
  };
  const matchMedia = vi.fn(() => list);
  return {
    list,
    matchMedia,
    flip: (next: boolean) => {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mediaMatches', () => {
  it('asks the window, and answers the fallback when it can\'t', () => {
    const media = fakeMedia(true);

    expect(mediaMatches({ matchMedia: media.matchMedia as never }, '(x)', false)).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith('(x)');
    expect(mediaMatches({}, '(x)', false)).toBe(false);
    expect(mediaMatches({}, '(x)', true)).toBe(true);
  });
});

describe('watchMedia', () => {
  it('listens for changes and stops', () => {
    const media = fakeMedia(false);
    const onChange = vi.fn();

    const stop = watchMedia({ matchMedia: media.matchMedia as never }, '(x)', onChange);
    media.flip(true);
    stop();
    media.flip(false);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(media.list.removeEventListener).toHaveBeenCalledWith('change', onChange);
  });

  it('does nothing without matchMedia', () => {
    expect(watchMedia({}, '(x)', vi.fn())()).toBeUndefined();
  });
});

describe('useMediaQuery', () => {
  it('follows the query as it changes', () => {
    const media = fakeMedia(false);
    vi.stubGlobal('matchMedia', media.matchMedia);

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)', true));
    expect(result.current).toBe(false);

    act(() => media.flip(true));
    expect(result.current).toBe(true);
  });

  it('answers the fallback where the window can\'t tell', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)', true));

    expect(result.current).toBe(true);
  });
});
