import { useEffect, useRef, type RefObject } from 'react';

// Where the keyboard goes around a confirm (K26 OQ-142, K27 OQ-143): it starts
// on the element the confirm picks — Cancel, the safe answer, for the inline
// confirm; the input for the type-to-confirm — and a cancel hands it back to
// whatever held it before the confirm opened, usually the trigger. After a
// confirm the caller decides, as the item the trigger belonged to is often gone.

/** The ref of the element focused on open and the way back to the earlier focus. */
export interface ConfirmFocus<Target extends HTMLElement> {
  readonly focusRef: RefObject<Target | null>;
  readonly restoreFocus: () => void;
}

/**
 * Focuses the referenced element when the confirm opens and remembers what was
 * focused before, to give focus back on cancel.
 *
 * @returns The ref for the element to focus and the function that gives focus back.
 */
export function useConfirmFocus<Target extends HTMLElement>(): ConfirmFocus<Target> {
  const focusRef = useRef<Target>(null);
  const previousRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousRef.current = document.activeElement as HTMLElement | null;
    focusRef.current?.focus();
  }, []);

  /** Gives focus back to what held it before the confirm opened. */
  const restoreFocus = () => previousRef.current?.focus();

  return { focusRef, restoreFocus };
}
