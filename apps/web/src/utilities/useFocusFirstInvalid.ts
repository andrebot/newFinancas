import { useEffect } from 'react';

// Moves the user to what stopped a submit (OQ-192): after a refused submit,
// the first field marked invalid takes the focus — scrolled into view by the
// browser — so a message below the fold isn't missed. Every kit field marks
// itself with `aria-invalid` while it shows an error.

/**
 * Focuses the first invalid field once a submit was refused.
 *
 * @param refusals - How many submits were refused; each new one moves the focus.
 * @param scope - Where to look: the open dialog first, else the page.
 */
const useFocusFirstInvalid = (refusals: number, scope: ParentNode = document) => {
  useEffect(() => {
    if (refusals === 0) return;
    scope.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [refusals, scope]);
};

export default useFocusFirstInvalid;
