import {
  useCallback, useLayoutEffect, useRef, useState, type RefCallback, type RefObject,
} from 'react';

// The card rail's scrolling (K35, OQ-212): where the track sits between its
// two ends, the edge fade that follows it, and the arrows' page scroll. The
// browser does the scrolling and the snapping; this reads where it landed and
// picks the arrows' targets from the cards' own positions, so a card cut at
// an edge is the next one shown whole. The smoothness comes from the track's
// `motion-safe:scroll-smooth`, so a reduced-motion user jumps instead.

/** A scroll position this close to an end counts as the end (sub-pixel layouts). */
const EDGE_TOLERANCE_PX = 1;

/** Which way an arrow scrolls the rail. */
export type RailDirection = 'back' | 'forward';

/** Whether the track sits at its start, at its end, or both (nothing overflows). */
export interface RailEdges {
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

/** A card's span along the track, in the track's scroll coordinates. */
export interface CardSpan {
  readonly start: number;
  readonly end: number;
}

/** The track's visible window: where it is scrolled to and how wide it is. */
export interface RailView {
  readonly scrollLeft: number;
  readonly clientWidth: number;
}

/** What the rail's scrolling hands its component. */
export interface RailScroll {
  /** Attach to the track: it is measured, and observed for size changes. */
  readonly attachTrack: RefCallback<HTMLDivElement>;
  /** The attached track, for focus. */
  readonly trackRef: RefObject<HTMLDivElement | null>;
  readonly edges: RailEdges;
  /** Re-reads the edges; the track calls it on every scroll. */
  readonly update: () => void;
  /** Scrolls a page back or forward, to a card's snap position. */
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
 * with more to scroll to, and leaves an end that is reached sharp. A second,
 * solid layer keeps the strip along the bottom (the scrollbar) unfaded; the
 * track's classes size the two layers.
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
  return `linear-gradient(to right, ${start}, ${end}), linear-gradient(#000, #000)`;
};

/**
 * Picks where the next card forward snaps: the first card past the current
 * one that isn't wholly clear of the right fade, brought to the left inset.
 *
 * @param cards - The cards' spans, in order.
 * @param view - The track's visible window.
 * @param insetPx - The fade's width, which is also the snap inset.
 * @returns The scroll position, or `undefined` when every card is shown.
 */
const forwardTarget = (cards: readonly CardSpan[], view: RailView, insetPx: number) => {
  const clearStart = view.scrollLeft + insetPx;
  const clearEnd = view.scrollLeft + view.clientWidth - insetPx;
  const next = cards.find((card) => (
    card.start > clearStart + EDGE_TOLERANCE_PX && card.end > clearEnd + EDGE_TOLERANCE_PX
  ));
  return next && next.start - insetPx;
};

/**
 * Picks where a page back snaps: as far back as still shows whole the card
 * cut at the left edge, so no card is skipped.
 *
 * @param cards - The cards' spans, in order.
 * @param view - The track's visible window.
 * @param insetPx - The fade's width, which is also the snap inset.
 * @returns The scroll position, or `undefined` when no card is cut at the left.
 */
const backTarget = (cards: readonly CardSpan[], view: RailView, insetPx: number) => {
  const clearStart = view.scrollLeft + insetPx;
  const cut = cards.findLast((card) => card.start < clearStart - EDGE_TOLERANCE_PX);
  if (!cut) {
    return undefined;
  }
  const earliest = cut.end - view.clientWidth + 2 * insetPx;
  // A card wider than the clear window can't be shown whole; its start is the best on offer.
  const first = cards.find((card) => card.start >= earliest && card.start <= cut.start) ?? cut;
  return first.start - insetPx;
};

/**
 * Picks an arrow's scroll target from the cards' positions.
 *
 * @param cards - The cards' spans, in order.
 * @param view - The track's visible window.
 * @param insetPx - The fade's width, which is also the snap inset.
 * @param direction - Which arrow was pressed.
 * @returns The scroll position, or `undefined` when there is nothing that way.
 */
export const pageTarget = (
  cards: readonly CardSpan[],
  view: RailView,
  insetPx: number,
  direction: RailDirection,
) => (direction === 'forward'
  ? forwardTarget(cards, view, insetPx)
  : backTarget(cards, view, insetPx));

/**
 * Reads the cards' spans from a track (the track is their offset parent).
 *
 * @param track - The scrolling element.
 * @returns Each card's start and end.
 */
export const cardSpans = (track: HTMLElement): CardSpan[] => (
  Array.from(track.children, (card) => {
    const { offsetLeft, offsetWidth } = card as HTMLElement;
    return { start: offsetLeft, end: offsetLeft + offsetWidth };
  })
);

/**
 * Tracks a rail's scroll position and scrolls it a page at a time. The edges
 * are re-read after every render (the cards may have changed) and whenever the
 * track's size changes (a resize, a layout or a scrollbar narrowing it).
 *
 * @param insetPx - The fade's width: the snap inset the arrows aim for.
 * @returns The track's ref callback and ref, its edges, the scroll handler and the page scroll.
 */
export function useRailScroll(insetPx: number): RailScroll {
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

  const attachTrack = useCallback((track: HTMLDivElement) => {
    trackRef.current = track;
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      observer.disconnect();
      trackRef.current = null;
    };
  }, [update]);

  const scrollPage = useCallback((direction: RailDirection) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const target = pageTarget(cardSpans(track), track, insetPx, direction);
    if (target !== undefined) {
      track.scrollTo({ left: target });
    }
  }, [insetPx]);

  return {
    attachTrack, trackRef, edges: { atStart, atEnd }, update, scrollPage,
  };
}
