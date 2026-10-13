// Accessible role for an inline SVG graphic (K3, OQ-126): decorative unless the
// caller names it.

interface LabelledGraphic { readonly role: 'img'; readonly 'aria-label': string }
interface HiddenGraphic { readonly 'aria-hidden': true }

/** The ARIA attributes for an inline SVG graphic. */
export type GraphicRoleProps = LabelledGraphic | HiddenGraphic;

/**
 * Decides how assistive technology sees a graphic.
 *
 * @param label - The graphic's accessible name, already translated; omitted
 *   when text next to it says the same, or it is pure decoration.
 * @returns `role="img"` with the label, or `aria-hidden` without one.
 */
export const graphicRole = (label?: string): GraphicRoleProps => (
  label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
);
