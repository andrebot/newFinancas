import { graphicRole } from './graphicRole';
import { GLYPHS, type IconName } from './generated/iconData';

// The kit's icon (K3, OQ-126): a Material Symbols glyph from the generated
// registry, inlined as SVG so the app makes no third-party request. It is 1em
// square and drawn in currentColor, so it follows the text around it; a size or
// colour utility in `className` overrides both.

export type { IconName };

/** The icon's props. */
export interface IconProps {
  /** A Material Symbols name from the registry (UI or category icon). */
  readonly name: IconName;
  /** Accessible name, already translated; without one the icon is decorative. */
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * Renders one glyph.
 *
 * @param props - The glyph's name, its optional label and extra classes.
 * @returns The inline SVG.
 */
export function Icon({ name, label, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={className}
      {...graphicRole(label)}
      // The body is a build-time constant from the generated registry, never input.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: GLYPHS[name] }}
    />
  );
}
