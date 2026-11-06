import {
  useEffect, useRef, useState,
  type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject,
} from 'react';
import { nearestIndex, steppedIndex, type PlotPosition } from './lineGeometry';

// Which value a line chart is reading out (K38, OQ-229): the one nearest the
// pointer, the one a tap landed on, or the one the arrow keys reached. Focus
// alone starts nothing, so a drawer that opens onto the plot shows no chip. A
// tap has no hover to end it, so it stays until a tap elsewhere, or until the
// browser takes the touch over to scroll. Picking a value ends the readout, so
// the chart shows what was picked. The value is held by key, so it survives a
// refreshed series, and goes if that value does.

/** One value the readout can land on. */
export interface ReadoutMark {
  /** The value's stable key. */
  readonly key: string;
  /** Where it sits in the plot. */
  readonly position: PlotPosition;
}

/** What the readout hands the plot's element. */
export interface ReadoutHandlers {
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: () => void;
  readonly onClick: (event: MouseEvent<HTMLElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
}

/** The readout's state and the handlers that drive it. */
export interface LineReadout {
  /** The active value's key, while one is being read. */
  readonly activeKey: string | undefined;
  /** Holds the plot's element, so a tap elsewhere can end the readout. */
  readonly plotRef: RefObject<HTMLDivElement | null>;
  /** Picks a value by key, ending the readout if it could be picked. */
  readonly pick: (key: string) => void;
  /** What to spread on the plot's element. */
  readonly handlers: ReadoutHandlers;
}

/**
 * Tells where a pointer is across an element.
 *
 * @param event - The pointer event.
 * @returns The distance from its left edge, in percent; 0 before it has a width.
 */
const pointerLeftPercent = (event: MouseEvent<HTMLElement>) => {
  const box = event.currentTarget.getBoundingClientRect();
  return box.width === 0 ? 0 : ((event.clientX - box.left) / box.width) * 100;
};

/**
 * Tells whether a key press carries a modifier: Alt+Left is the browser's, not
 * the chart's.
 *
 * @param event - The key press.
 * @returns Whether a modifier is held.
 */
const hasModifier = ({
  altKey, ctrlKey, metaKey, shiftKey,
}: KeyboardEvent<HTMLElement>) => altKey || ctrlKey || metaKey || shiftKey;

/**
 * Tracks which value a chart reads out.
 *
 * @param marks - The values to read, left to right.
 * @param onPick - Called with a value's key; answers whether it could be picked.
 * @returns The active key, the plot's ref, the pick and the plot's handlers.
 */
export default function useLineReadout(
  marks: readonly ReadoutMark[],
  onPick: (key: string) => boolean,
): LineReadout {
  const [heldKey, setHeldKey] = useState<string>();
  const plotRef = useRef<HTMLDivElement>(null);
  const activeIndex = marks.findIndex((mark) => mark.key === heldKey);
  const activeKey = marks[activeIndex]?.key;

  useEffect(() => {
    if (activeKey === undefined) {
      return undefined;
    }
    /**
     * Ends the readout when the press lands outside the plot.
     *
     * @param event - The press.
     */
    const dismissOutside = (event: globalThis.PointerEvent) => {
      if (!plotRef.current?.contains(event.target as Node)) {
        setHeldKey(undefined);
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [activeKey]);

  /**
   * Finds the value nearest the pointer.
   *
   * @param event - The pointer event.
   * @returns Its key.
   */
  const keyAtPointer = (event: MouseEvent<HTMLElement>) => {
    const positions = marks.map((mark) => mark.position);
    return marks[nearestIndex(positions, pointerLeftPercent(event))]?.key;
  };

  /**
   * Reads the value nearest the pointer.
   *
   * @param event - The pointer event.
   */
  const readAtPointer = (event: PointerEvent<HTMLElement>) => setHeldKey(keyAtPointer(event));

  /**
   * Picks a value, ending the readout if it could be picked.
   *
   * @param key - The value's key.
   * @returns Whether it was picked.
   */
  const pickValue = (key: string) => {
    const picked = onPick(key);
    if (picked) {
      setHeldKey(undefined);
    }
    return picked;
  };

  /**
   * Answers Escape: it ends a readout and goes no further, so the drawer around
   * the chart stays open. With nothing being read, it's the drawer's.
   *
   * @param event - The key press.
   */
  const endOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (activeKey !== undefined) {
      event.stopPropagation();
      setHeldKey(undefined);
    }
  };

  /**
   * Answers Enter or Space: picks the value being read. The key keeps its usual
   * job (Space scrolls the page) when there is nothing to pick.
   *
   * @param event - The key press.
   */
  const pickOnKey = (event: KeyboardEvent<HTMLElement>) => {
    if (activeKey !== undefined && pickValue(activeKey)) {
      event.preventDefault();
    }
  };

  /**
   * Answers a key: an arrow, Home or End moves, Escape ends, Enter or Space picks.
   *
   * @param event - The key press.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (hasModifier(event)) {
      return;
    }
    const stepped = steppedIndex(event.key, activeIndex, marks.length);
    if (stepped !== undefined) {
      event.preventDefault();
      setHeldKey(marks[stepped]?.key);
    } else if (event.key === 'Escape') {
      endOnEscape(event);
    } else if (event.key === 'Enter' || event.key === ' ') {
      pickOnKey(event);
    }
  };

  return {
    activeKey,
    plotRef,
    pick: pickValue,
    handlers: {
      onPointerMove: readAtPointer,
      onPointerDown: readAtPointer,
      onPointerLeave: (event) => {
        if (event.pointerType !== 'touch') {
          setHeldKey(undefined);
        }
      },
      onPointerCancel: () => setHeldKey(undefined),
      onClick: (event) => {
        // The chip's value, not the click's own: browsers round a click's
        // position, which near a midpoint lands on the neighbouring value.
        const key = activeKey ?? keyAtPointer(event);
        if (key !== undefined) {
          pickValue(key);
        }
      },
      onKeyDown,
      onBlur: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHeldKey(undefined);
        }
      },
    },
  };
}
