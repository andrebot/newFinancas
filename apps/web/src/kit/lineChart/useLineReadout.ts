import {
  useCallback, useEffect, useRef, useState,
  type FocusEvent, type KeyboardEvent, type PointerEvent,
} from 'react';
import { nearestIndex, steppedIndex, type PlotPosition } from './lineGeometry';

// Which value a line chart is reading out (K38, OQ-229): the one nearest the
// pointer, the one a tap landed on, or the one the arrow keys reached. A tap
// has no hover to end it, so it stays until a tap elsewhere. It is held by key,
// so it survives a refreshed series, and goes if that value does.

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
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly onFocus: () => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
}

/** The readout's state and the handlers that drive it. */
export interface LineReadout {
  /** The active value's key, while one is being read. */
  readonly activeKey: string | undefined;
  /** Holds the plot's element, so a tap elsewhere can end the readout. */
  readonly plotRef: React.RefObject<HTMLDivElement | null>;
  /** What to spread on the plot's element. */
  readonly handlers: ReadoutHandlers;
}

/**
 * Tells where a pointer is across an element.
 *
 * @param event - The pointer event.
 * @returns The distance from its left edge, in percent; 0 before it has a width.
 */
const pointerLeftPercent = (event: PointerEvent<HTMLElement>) => {
  const box = event.currentTarget.getBoundingClientRect();
  return box.width === 0 ? 0 : ((event.clientX - box.left) / box.width) * 100;
};

/**
 * Tracks which value a chart reads out.
 *
 * @param marks - The values to read, left to right.
 * @param onConfirm - Called with a value's key on Enter or Space, when it can be picked.
 * @returns The active key, the plot's ref and its handlers.
 */
export default function useLineReadout(
  marks: readonly ReadoutMark[],
  onConfirm: (key: string) => void,
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

  const readAtPointer = useCallback((event: PointerEvent<HTMLElement>) => {
    const positions = marks.map((mark) => mark.position);
    setHeldKey(marks[nearestIndex(positions, pointerLeftPercent(event))]?.key);
  }, [marks]);

  /**
   * Answers a key: an arrow, Home or End moves, Escape ends, Enter or Space
   * confirms the active value.
   *
   * @param event - The key press.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const stepped = steppedIndex(event.key, activeIndex, marks.length);
    if (stepped !== undefined) {
      event.preventDefault();
      setHeldKey(marks[stepped]?.key);
    } else if (event.key === 'Escape') {
      setHeldKey(undefined);
    } else if ((event.key === 'Enter' || event.key === ' ') && activeKey !== undefined) {
      event.preventDefault();
      onConfirm(activeKey);
    }
  };

  return {
    activeKey,
    plotRef,
    handlers: {
      onPointerMove: readAtPointer,
      onPointerDown: readAtPointer,
      onPointerLeave: (event) => {
        if (event.pointerType !== 'touch') {
          setHeldKey(undefined);
        }
      },
      onKeyDown,
      onFocus: () => setHeldKey((held) => held ?? marks[marks.length - 1]?.key),
      onBlur: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHeldKey(undefined);
        }
      },
    },
  };
}
