import { act, renderHook } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  cardSpans, fadeMask, pageTarget, readEdges, useRailScroll,
} from '../../../../src/kit/cardRail/railScroll';

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

/** The mask's second layer: the unfaded strip along the bottom. */
const SOLID = 'linear-gradient(#000, #000)';

describe('fadeMask', () => {
  it('draws no mask when nothing overflows', () => {
    expect(fadeMask({ atStart: true, atEnd: true }, 56)).toBeUndefined();
  });

  it('fades only the end at the start', () => {
    expect(fadeMask({ atStart: true, atEnd: false }, 56)).toBe(
      `linear-gradient(to right, #000 0, #000 calc(100% - 56px), transparent 100%), ${SOLID}`,
    );
  });

  it('fades only the start at the end', () => {
    expect(fadeMask({ atStart: false, atEnd: true }, 56)).toBe(
      `linear-gradient(to right, transparent 0, #000 56px, #000 100%), ${SOLID}`,
    );
  });

  it('fades both sides in the middle', () => {
    expect(fadeMask({ atStart: false, atEnd: false }, 40)).toBe(
      'linear-gradient(to right, transparent 0, #000 40px, '
        + `#000 calc(100% - 40px), transparent 100%), ${SOLID}`,
    );
  });
});

/** Four 272px cards, a new one every 284px; a 540px window; a 56px fade. */
const CARDS = [0, 284, 568, 852].map((start) => ({ start, end: start + 272 }));
const WIDTH = 540;
const INSET = 56;

describe('pageTarget', () => {
  it('brings the card cut at the right to the left inset', () => {
    expect(pageTarget(CARDS, { scrollLeft: 0, clientWidth: WIDTH }, INSET, 'forward')).toBe(228);
  });

  it('skips a card already clear of the fades going forward', () => {
    expect(pageTarget(CARDS, { scrollLeft: 228, clientWidth: WIDTH }, INSET, 'forward')).toBe(512);
  });

  it('has nowhere to go forward once the last card is clear', () => {
    expect(pageTarget(CARDS, { scrollLeft: 652, clientWidth: 600 }, INSET, 'forward'))
      .toBeUndefined();
  });

  it('pages back as far as still shows the card cut at the left whole', () => {
    expect(pageTarget(CARDS, { scrollLeft: 512, clientWidth: WIDTH }, INSET, 'back')).toBe(228);
  });

  it('pages back over several cards when the window holds them', () => {
    expect(pageTarget(CARDS, { scrollLeft: 796, clientWidth: 1000 }, INSET, 'back')).toBe(-56);
  });

  it('has nowhere to go back with no cards', () => {
    expect(pageTarget([], { scrollLeft: 0, clientWidth: WIDTH }, INSET, 'back')).toBeUndefined();
  });

  it('moves on from a card wider than the window, each way', () => {
    const wide = [{ start: 0, end: 1000 }, { start: 1012, end: 2012 }];

    expect(pageTarget(wide, { scrollLeft: 0, clientWidth: WIDTH }, INSET, 'forward')).toBe(956);
    expect(pageTarget(wide, { scrollLeft: 956, clientWidth: WIDTH }, INSET, 'back')).toBe(-56);
  });
});

describe('pageTarget at its tolerances (review V7)', () => {
  // A card counts as cut only past the 1px tolerance: on it, it is clear.
  it('goes forward past a card that starts exactly on the tolerance', () => {
    const cards = [{ start: 57, end: 600 }, { start: 612, end: 884 }];
    expect(pageTarget(cards, { scrollLeft: 0, clientWidth: WIDTH }, INSET, 'forward')).toBe(556);
  });

  it('goes forward past a card that ends exactly on the tolerance', () => {
    const cards = [{ start: 100, end: 485 }, { start: 497, end: 769 }];
    expect(pageTarget(cards, { scrollLeft: 0, clientWidth: WIDTH }, INSET, 'forward')).toBe(441);
  });

  it('pages back from the card cut at the left inset, not before it', () => {
    expect(pageTarget(CARDS, { scrollLeft: 300, clientWidth: WIDTH }, INSET, 'back')).toBe(228);
  });

  it('takes no card starting exactly on the tolerance as cut', () => {
    expect(pageTarget(CARDS, { scrollLeft: 229, clientWidth: WIDTH }, INSET, 'back')).toBe(-56);
  });

  it('keeps both insets clear of the cut card on the way back', () => {
    expect(pageTarget(CARDS, { scrollLeft: 700, clientWidth: 600 }, INSET, 'back')).toBe(512);
  });

  it('takes a card starting exactly where the cut card still shows whole', () => {
    expect(pageTarget(CARDS, { scrollLeft: 700, clientWidth: 668 }, INSET, 'back')).toBe(228);
  });
});

describe('cardSpans', () => {
  it('reads each card start and end from its offsets', () => {
    const rail = document.createElement('div');
    [[0, 196], [208, 196]].forEach(([offsetLeft, offsetWidth]) => {
      const card = document.createElement('article');
      Object.defineProperty(card, 'offsetLeft', { value: offsetLeft });
      Object.defineProperty(card, 'offsetWidth', { value: offsetWidth });
      rail.append(card);
    });

    expect(cardSpans(rail)).toEqual([{ start: 0, end: 196 }, { start: 208, end: 404 }]);
  });
});

describe('useRailScroll', () => {
  it('starts at both ends and ignores a scroll before the track is attached', () => {
    const { result } = renderHook(() => useRailScroll(INSET));

    expect(result.current.edges).toEqual({ atStart: true, atEnd: true });
    expect(() => result.current.scrollPage('forward')).not.toThrow();
    expect(() => result.current.update()).not.toThrow();
  });

  it('scrolls an attached track only when there is somewhere to go', () => {
    const { result } = renderHook(() => useRailScroll(INSET));
    const rail = document.createElement('div');
    const card = document.createElement('article');
    Object.defineProperty(card, 'offsetWidth', { value: 272 });
    rail.append(card);
    Object.defineProperty(rail, 'clientWidth', { value: WIDTH });
    rail.scrollTo = vi.fn();
    act(() => {
      result.current.attachTrack(rail);
    });

    result.current.scrollPage('forward');

    expect(rail.scrollTo).not.toHaveBeenCalled();
  });
});
