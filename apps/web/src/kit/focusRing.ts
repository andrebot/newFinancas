// The kit's keyboard focus ring (OQ-129): a mint outline on the element that
// holds a focused native input, shown only for keyboard focus. Kit controls
// hide their native input visually, so the ring goes on the element drawn in
// its place — a segment, an option card, a checkbox's box.

/** The focus ring's classes, for the element that contains the input. */
const FOCUS_RING = [
  'has-focus-visible:outline-2',
  'has-focus-visible:outline-offset-2',
  'has-focus-visible:outline-mint',
].join(' ');

export default FOCUS_RING;
