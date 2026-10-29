import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject,
} from 'react';

// The card rail's scrolling (K35, OQ-212): where the track sits between its
// two ends, the edge fade that follows it, and the arrows' page-wide scroll.
// The browser does the scrolling and the snapping; this only reads where it
// landed. The smoothness comes from the track's `motion-safe:scroll-smooth`,
// so a reduced-motion user jumps instead.

/** A scroll position this close to an end counts as the end (sub-pixel layouts). */
const EDGE_TOLERANCE_PX = 1;

/** Which way an arrow scrolls the rail. */
export type RailDirection = 'back' | 'forward';

/** Whether the track sits at its start, at its end, or both (nothing overflows). */
export interface RailEdges {
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

/** What the rail's scrolling hands its component. */
export interface RailScroll {
  readonly trackRef: RefObject<HTMLDivElement | null>;
  readonly edges: RailEdges;
  /** Re-reads the edges; the track calls it on every scroll. */
  readonly update: () => void;
  /** Scrolls one visible width back or forward; snapping settles on a card. */
  readonly scrollPage: (direction: RailDirection) => void;
}

/**
 * Reads where a track sits between its ends.
 *
 * @param track - The scrolling element.
 * @returns Whether it is at its start and whether it is at its end.
 */
export const readEdges = (track: HTMLElement): RailEdges => ({
  atStart: track.scrollLeft <= EDGE_TOLERANCE_PX,
  atEnd: track.scrollLeft + track.clientWidth >= track.scrollWidth - EDGE_TOLERANCE_PX,
});

/**
 * Builds the track's edge fade: a mask that thins the cards out on each side
 * with more to scroll to, and leaves an end that is reached sharp.
 *
 * @param edges - Where the track sits.
 * @param fadePx - How far the fade reaches in.
 * @returns The `mask-image`, or `undefined` when nothing overflows.
 */
export const fadeMask = ({ atStart, atEnd }: RailEdges, fadePx: number) => {
  if (atStart && atEnd) {
    return undefined;
  }
  const start = atStart ? '#000 0' : `transparent 0, #000 ${fadePx}px`;
  const end = atEnd ? '#000 100%' : `#000 calc(100% - ${fadePx}px), transparent 100%`;
  return `linear-gradient(to right, ${start}, ${end})`;
};

/**
 * Tracks a rail's scroll position and scrolls it a page at a time. The edges
 * are re-read after every render (the cards may have changed) and on window
 * resize (the visible width may have).
 *
 * @returns The track's ref, its edges, the scroll handler and the page scroll.
 */
export function useRailScroll(): RailScroll {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const update = useCallback(() => {
    if (trackRef.current) {
      const edges = readEdges(trackRef.current);
      setAtStart(edges.atStart);
      setAtEnd(edges.atEnd);
    }
  }, []);

  // No dependency list on purpose: new cards change the scroll width. Equal
  // values bail out, so this settles after one pass.
  useLayoutEffect(update);

  useEffect(() => {
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);

  const scrollPage = useCallback((direction: RailDirection) => {
    const track = trackRef.current;
    if (track) {
      const sign = direction === 'back' ? -1 : 1;
      track.scrollBy({ left: sign * track.clientWidth });
    }
  }, []);

  return {
    trackRef, edges: { atStart, atEnd }, update, scrollPage,
  };
}
