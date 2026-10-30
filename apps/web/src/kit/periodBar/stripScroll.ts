import {
  useEffect, useLayoutEffect, useRef, type CSSProperties, type RefCallback,
} from 'react';
import { periodBar } from '../../config/constants';
import { fadeMask, readEdges, useRailScroll } from '../cardRail/railScroll';
import type { Period } from './periodBar';

// The period bar's swiped strip (K40, OQ-216, PR #145 review): below `sm` the
// twelve months don't fit, so the strip scrolls. It keeps the selected month
// in view, fades the side with more months to scroll to (the card rail's
// fade, OQ-212), and turns a plain mouse wheel over it into a sideways
// scroll — until it reaches that end, when the wheel scrolls the page again.

/** A wheel turn, as the strip reads it. */
export type WheelTurn = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>;

/** What the strip's scrolling hands the bar. */
export interface StripScroll {
  /** Attach to the strip: it is measured, observed and listened to. */
  readonly attachStrip: RefCallback<HTMLDivElement>;
  /** The strip's fade. */
  readonly stripStyle: CSSProperties;
  /** Re-reads the fade's edges; the strip calls it on every scroll. */
  readonly onStripScroll: () => void;
}

/**
 * Turns a vertical wheel over the strip into how far to scroll it sideways.
 * A sideways wheel (a trackpad, shift) is the browser's already, and a strip
 * at the end the wheel points to leaves the turn to the page.
 *
 * @param strip - The months' strip.
 * @param turn - The wheel's deltas and their unit.
 * @returns The pixels to scroll the strip by, or `undefined` to leave it be.
 */
export const wheelStep = (strip: HTMLElement, turn: WheelTurn): number | undefined => {
  if (turn.deltaY === 0 || Math.abs(turn.deltaX) >= Math.abs(turn.deltaY)) return undefined;
  const edges = readEdges(strip);
  if (turn.deltaY < 0 ? edges.atStart : edges.atEnd) return undefined;
  return turn.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? turn.deltaY * periodBar.wheelLinePx
    : turn.deltaY;
};

/**
 * Scrolls a strip by a wheel turn, keeping the page still while it does.
 *
 * @param event - The wheel event over the strip.
 */
export const scrollByWheel = (event: WheelEvent) => {
  const strip = event.currentTarget as HTMLElement;
  const step = wheelStep(strip, event);
  if (step === undefined) return;
  event.preventDefault();
  strip.scrollBy({ left: step });
};

/**
 * Scrolls the strip so its selected month sits in the middle; with every
 * month showing (from `sm` up) there is nothing to scroll.
 *
 * @param strip - The months' strip, once mounted.
 * @param behavior - `instant` to jump there, `auto` to follow the strip's
 *   own smooth scrolling (kept off when the user asks for less motion).
 */
export const centreSelected = (strip: HTMLElement | null, behavior: ScrollBehavior) => {
  const selected = strip?.querySelector<HTMLElement>('[aria-current="true"]');
  if (!strip || !selected) return;
  const left = selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2;
  strip.scrollTo({ left, behavior });
};

/**
 * Runs the swiped strip: the selected month in view from the first paint and
 * gliding to one picked later, the edge fade, and the wheel. The wheel is
 * listened to directly, as React's own wheel listener can't keep the page still.
 *
 * @param period - The selected month.
 * @returns The strip's ref callback, style and scroll handler.
 */
export function useStripScroll(period: Period): StripScroll {
  const {
    attachTrack, trackRef, edges, update,
  } = useRailScroll(periodBar.fadePx);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    centreSelected(trackRef.current, mountedRef.current ? 'auto' : 'instant');
    mountedRef.current = true;
  }, [trackRef, period.year, period.month]);

  useEffect(() => {
    const strip = trackRef.current;
    strip?.addEventListener('wheel', scrollByWheel, { passive: false });
    return () => strip?.removeEventListener('wheel', scrollByWheel);
  }, [trackRef]);

  return {
    attachStrip: attachTrack,
    // Through a variable: Tailwind writes the prefixed `-webkit-mask-image` too.
    stripStyle: { '--strip-fade': fadeMask(edges, periodBar.fadePx) } as CSSProperties,
    onStripScroll: update,
  };
}
