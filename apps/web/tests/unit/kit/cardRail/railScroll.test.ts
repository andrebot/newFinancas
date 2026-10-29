import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fadeMask, readEdges, useRailScroll } from '../../../../src/kit/cardRail/railScroll';

// Kit helper (BDT: Interaction tier → unit): pure reads of a track's
// geometry and the mask built from them; nothing to stand in for. The hook
// itself is driven through CardRail's tests; here only its unattached state.

/**
 * Builds a stand-in track with the geometry the edges are read from.
 *
 * @param scrollLeft - How far it is scrolled.
 * @param clientWidth - Its visible width.
 * @param scrollWidth - Its full content width.
 * @returns An element-shaped object.
 */
const track = (scrollLeft: number, clientWidth: number, scrollWidth: number) => (
  { scrollLeft, clientWidth, scrollWidth } as HTMLElement
);

describe('readEdges', () => {
  it('is at both ends when every card fits', () => {
    expect(readEdges(track(0, 600, 600))).toEqual({ atStart: true, atEnd: true });
  });

  it('is at the start before any scroll', () => {
    expect(readEdges(track(0, 600, 1200))).toEqual({ atStart: true, atEnd: false });
  });

  it('is at neither end in the middle', () => {
    expect(readEdges(track(300, 600, 1200))).toEqual({ atStart: false, atEnd: false });
  });

  it('is at the end when scrolled all the way', () => {
    expect(readEdges(track(600, 600, 1200))).toEqual({ atStart: false, atEnd: true });
  });

  it('counts a sub-pixel gap from either end as the end', () => {
    expect(readEdges(track(1, 600, 1200))).toEqual({ atStart: true, atEnd: false });
    expect(readEdges(track(599, 600, 1200))).toEqual({ atStart: false, atEnd: true });
  });

  it('counts a gap past the tolerance as more to scroll', () => {
    expect(readEdges(track(2, 600, 1200)).atStart).toBe(false);
    expect(readEdges(track(598, 600, 1200)).atEnd).toBe(false);
  });
});

describe('fadeMask', () => {
  it('draws no mask when nothing overflows', () => {
    expect(fadeMask({ atStart: true, atEnd: true }, 56)).toBeUndefined();
  });

  it('fades only the end at the start', () => {
    expect(fadeMask({ atStart: true, atEnd: false }, 56)).toBe(
      'linear-gradient(to right, #000 0, #000 calc(100% - 56px), transparent 100%)',
    );
  });

  it('fades only the start at the end', () => {
    expect(fadeMask({ atStart: false, atEnd: true }, 56)).toBe(
      'linear-gradient(to right, transparent 0, #000 56px, #000 100%)',
    );
  });

  it('fades both sides in the middle', () => {
    expect(fadeMask({ atStart: false, atEnd: false }, 40)).toBe(
      'linear-gradient(to right, transparent 0, #000 40px, '
        + '#000 calc(100% - 40px), transparent 100%)',
    );
  });
});

describe('useRailScroll', () => {
  it('starts at both ends and ignores a scroll before the track is attached', () => {
    const { result } = renderHook(() => useRailScroll());

    expect(result.current.edges).toEqual({ atStart: true, atEnd: true });
    expect(() => result.current.scrollPage('forward')).not.toThrow();
    expect(() => result.current.update()).not.toThrow();
  });
});
