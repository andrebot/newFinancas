import {
  useCallback, useEffect, useRef, useState,
} from 'react';

// A toast's timer (K25, OQ-141): it closes the toast once its time is up,
// but never while the pointer is over it or focus is inside it — the user is
// reading it or reaching for its action. Each pause starts the full time over.

/** The handlers the toast spreads on its root to pause the timer. */
export interface AutoDismissHandlers {
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
}

/**
 * Calls `onDismiss` after `duration` ms, paused while hovered or focused.
 *
 * @param duration - The time in ms, or `null` for a toast that stays.
 * @param onDismiss - Closes the toast; the latest one given is called.
 * @returns The pointer and focus handlers that pause the timer.
 */
export function useAutoDismiss(
  duration: number | null,
  onDismiss: () => void,
): AutoDismissHandlers {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (duration === null || hovered || focused) return undefined;
    const timer = setTimeout(() => dismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [duration, hovered, focused]);

  return {
    onPointerEnter: useCallback(() => setHovered(true), []),
    onPointerLeave: useCallback(() => setHovered(false), []),
    onFocus: useCallback(() => setFocused(true), []),
    onBlur: useCallback(() => setFocused(false), []),
  };
}
