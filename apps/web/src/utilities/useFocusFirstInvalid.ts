import { useEffect, type RefObject } from 'react';

// Moves the user to what stopped a submit (OQ-192): after a refused submit,
// the first field marked invalid takes the focus — scrolled into view by the
// browser — so a message below the fold isn't missed. Every kit field marks
// itself with `aria-invalid` while it shows an error. Every form that can
// refuse a submit uses it (R5 A1): a form that can sit beside another — the
// history editor, a rate's or a Holding's card — passes its own element, so
// the focus never jumps into a neighbour.

/**
 * Focuses the first invalid field once a submit was refused.
 *
 * @param refusals - How many submits were refused; each new one moves the focus.
 * @param scope - Where to look, read when the focus moves; the whole page when
 *   left out or not mounted.
 */
const useFocusFirstInvalid = (
  refusals: number,
  scope?: RefObject<ParentNode | null>,
) => {
  useEffect(() => {
    if (refusals === 0) return;
    const within: ParentNode = scope?.current ?? document;
    within.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [refusals, scope]);
};

export default useFocusFirstInvalid;
