import type { CardNetwork } from '@financas/reference';
import { graphicRole } from './graphicRole';
import { Icon } from './Icon';
import { CARD_NETWORK_LOGOS } from './generated/iconData';

// A card network's logo (K3, OQ-126), from the generated registry (SVG Logos,
// CC0). Logos keep their own colours and proportions: the logo is 1em tall and
// as wide as its shape needs, so a height utility in `className` resizes it.
// `other` has no logo and shows the generic card icon instead.

/** The logo's props. */
export interface CardNetworkLogoProps {
  readonly network: CardNetwork;
  /** Accessible name, already translated; without one the logo is decorative. */
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * Renders a card network's logo.
 *
 * @param props - The network, its optional label and extra classes.
 * @returns The logo as inline SVG, or the card icon for `other`.
 */
export function CardNetworkLogo({ network, label, className }: CardNetworkLogoProps) {
  if (network === 'other') {
    return <Icon name="credit-card-outline" label={label} className={className} />;
  }

  const { width, height, body } = CARD_NETWORK_LOGOS[network];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      height="1em"
      style={{ width: 'auto', aspectRatio: `${width} / ${height}` }}
      className={className}
      {...graphicRole(label)}
      // The body is a build-time constant from the generated registry, never input.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
