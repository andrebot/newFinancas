import { useEffect, useRef, type RefObject } from 'react';

// Where the keyboard goes around an inline confirm (K26, OQ-142): it starts on
// Cancel, the safe answer, and a cancel hands it back to whatever held it
// before the confirm opened — usually the trigger. After a confirm the caller
// decides, as the item the trigger belonged to is often gone.

/** The cancel button's ref and the way back to the earlier focus. */
export interface ConfirmFocus {
  readonly cancelRef: RefObject<HTMLButtonElement | null>;
  readonly restoreFocus: () => void;
}

/**
 * Focuses the cancel button when the confirm opens and remembers what was
 * focused before, to give focus back on cancel.
 *
 * @returns The ref for the cancel button and the function that gives focus back.
 */
export function useConfirmFocus(): ConfirmFocus {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
  }, []);

  /** Gives focus back to what held it before the confirm opened. */
  const restoreFocus = () => previousRef.current?.focus();

  return { cancelRef, restoreFocus };
}
