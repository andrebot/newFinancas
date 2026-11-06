import {
  useEffect, useRef, useState,
  type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject,
} from 'react';
import { nearestIndex, steppedIndex, type PlotPosition } from './lineGeometry';

// Which value a line chart is reading out (K38, OQ-229): the one nearest the
// pointer, the one a tap landed on, or the one the keys reached. Focus alone
// starts nothing, so a drawer that opens onto the plot shows no chip; Enter or
// an arrow does, from the value being edited or else the newest. Only a mouse
// has a hover to end: on a chart with nothing to pick, a tap's value stays until
// a tap elsewhere or until the browser takes the touch over to scroll. Picking a
// value ends the readout, so the chart shows what was picked: on an editable
// chart, a tap picks at once. The value is held by key, so it survives a
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

/** What the readout works from. */
export interface LineReadoutOptions {
  /** The values to read, left to right. */
  readonly marks: readonly ReadoutMark[];
  /** Called with a value's key; answers whether it could be picked. */
  readonly onPick: (key: string) => boolean;
  /** The key of the value being edited: where the keyboard starts from. */
  readonly startKey: string | undefined;
  /** Whether the chart has values to pick, which gives Space a job here. */
  readonly pickable: boolean;
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

/** The keys that start a readout or pick its value. */
const CONFIRM_KEYS = ['Enter', ' '];

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
 * @param options - The values, the pick, where to start and whether anything can be picked.
 * @returns The active key, the plot's ref, the pick and the plot's handlers.
 */
export default function useLineReadout({
  marks, onPick, startKey, pickable,
}: LineReadoutOptions): LineReadout {
  const [heldKey, setHeldKey] = useState<string>();
  const plotRef = useRef<HTMLDivElement>(null);
  const activeIndex = marks.findIndex((mark) => mark.key === heldKey);
  const activeKey = marks[activeIndex]?.key;
  const startIndex = marks.findIndex((mark) => mark.key === startKey);

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
   * Starts reading from the value being edited or else the newest, or picks the
   * value being read.
   *
   * @returns Whether the key had something to do.
   */
  const startOrPick = () => {
    if (activeKey !== undefined) {
      return pickValue(activeKey);
    }
    const start = marks[startIndex] ?? marks.at(-1);
    setHeldKey(start?.key);
    return start !== undefined;
  };

  /**
   * Answers Enter or Space on the plot. Space keeps its usual job (it scrolls the
   * page) on a chart with nothing to pick; on a marker the key is the button's
   * own, which picks that marker.
   *
   * @param event - The key press.
   */
  const confirmOnKey = (event: KeyboardEvent<HTMLElement>) => {
    const onPlot = event.target === event.currentTarget;
    if (onPlot && (event.key === 'Enter' || pickable) && startOrPick()) {
      event.preventDefault();
    }
  };

  /**
   * Answers a key: an arrow, Home or End moves, Escape ends, Enter or Space picks
   * or starts. With nothing being read, the arrows step from the value being edited.
   *
   * @param event - The key press.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (hasModifier(event)) {
      return;
    }
    const from = activeIndex < 0 ? startIndex : activeIndex;
    const stepped = steppedIndex(event.key, from, marks.length);
    if (stepped !== undefined) {
      event.preventDefault();
      setHeldKey(marks[stepped]?.key);
    } else if (event.key === 'Escape') {
      endOnEscape(event);
    } else if (CONFIRM_KEYS.includes(event.key)) {
      confirmOnKey(event);
    }
  };

  /**
   * Ends a mouse's readout as it leaves: a finger or a pen has no hover to end.
   *
   * @param event - The pointer event.
   */
  const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') {
      setHeldKey(undefined);
    }
  };

  /**
   * Picks what the chip shows, not what the click's own position says: browsers
   * round a click's position, which near a midpoint lands on the neighbouring value.
   *
   * @param event - The click.
   */
  const onClick = (event: MouseEvent<HTMLElement>) => {
    const key = activeKey ?? keyAtPointer(event);
    if (key !== undefined) {
      pickValue(key);
    }
  };

  /**
   * Ends the readout when focus leaves the plot and its markers.
   *
   * @param event - The focus event.
   */
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setHeldKey(undefined);
    }
  };

  /** Ends the readout when the browser takes a touch over to scroll. */
  const onPointerCancel = () => setHeldKey(undefined);

  return {
    activeKey,
    plotRef,
    pick: pickValue,
    handlers: {
      onPointerMove: readAtPointer,
      onPointerDown: readAtPointer,
      onPointerLeave,
      onPointerCancel,
      onClick,
      onKeyDown,
      onBlur,
    },
  };
}
