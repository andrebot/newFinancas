const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Serializes SVG markup the way the DOM does (self-closing tags expanded), so
 * a rendered graphic's `innerHTML` can be compared with registry content.
 *
 * @param body - SVG child markup.
 * @returns The markup after a DOM round trip.
 */
const svgMarkup = (body: string): string => {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.innerHTML = body;
  return svg.innerHTML;
};

export default svgMarkup;
