import type { ReactNode } from 'react';
import type { CardNetwork } from '@financas/reference';
import { CardNetworkLogo } from '../icons/CardNetworkLogo';
import { cardSurfaceStyle, LOGO_BADGE } from './cardNumber';

// A saved credit card (K48, OQ-187): the strip in its network's colour that
// lists an account's cards — the add-account form (mockup 11) and the
// account cards (40). The logo, "•••• 1111" over the meta line, and an
// optional action at the end, e.g. "Remove card". Like the preview it is
// drawn in the dark theme in both. The caller translates every text.

/** The saved card's props. */
export interface CardRowProps {
  readonly network: CardNetwork;
  /** The card's last four digits. */
  readonly last4: string;
  /** The network's name, already translated: the logo's accessible name. */
  readonly networkName: string;
  /** The muted line, already translated, e.g. "Closes 15 · Due 22 · Exp 09/2030". */
  readonly meta?: ReactNode;
  /** What sits at the end, e.g. the remove button. */
  readonly trailing?: ReactNode;
}

/**
 * Renders one saved card.
 *
 * @param props - The network and its name, the last four digits, the meta line and the action.
 * @returns The card strip.
 */
export function CardRow({
  network, last4, networkName, meta, trailing,
}: CardRowProps) {
  return (
    <div
      data-theme="dark"
      className="flex items-center gap-3 rounded-[14px] px-3 py-3 text-ink"
      style={cardSurfaceStyle(network)}
    >
      <span className={`h-6 w-[38px] shrink-0 ${LOGO_BADGE}`}>
        <CardNetworkLogo network={network} label={networkName} className="max-w-full text-[16px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="type-body font-medium tabular-nums">
          <span aria-hidden="true">•••• </span>
          {last4}
        </span>
        {meta && <span className="truncate type-caption text-muted">{meta}</span>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  );
}
