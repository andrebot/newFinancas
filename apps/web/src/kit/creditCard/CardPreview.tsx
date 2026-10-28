import type { CardNetwork } from '@financas/reference';
import { CardNetworkLogo } from '../icons/CardNetworkLogo';
import {
  cardNumberParts, cardSurfaceStyle, chipStyle, LOGO_BADGE,
} from './cardNumber';

// The live credit-card preview (K48, OQ-187): mockup 11's add-card form draws
// the card as it is typed — the network's colour and logo, the chip, the
// number grouped with dots for the digits still to come, the closing and due
// days and the expiry. The card is a picture (`aria-hidden`): the fields
// carry the values, and the caption, read out as it changes, names the
// detected network. It is drawn in the dark theme in both, like a real card.
// It holds no state, and the caller translates and formats every text.

/** The preview's props. */
export interface CardPreviewProps {
  /** The network detected from the number, or a saved card's. */
  readonly network: CardNetwork;
  /** The digits typed so far, without separators. */
  readonly digits: string;
  /** A saved card's last four digits, shown when no number is typed (editing). */
  readonly last4?: string | undefined;
  /** The billing line, already translated, e.g. "Closes 05 · Due 12". */
  readonly billing?: string | undefined;
  /** The expiry, already formatted, e.g. "03/28". */
  readonly expiry?: string | undefined;
  /** Under the card, already translated, e.g. "Mastercard detected from the number". */
  readonly caption?: string | undefined;
}

/**
 * The card's shape: a bank card's proportions, the rows spread top to bottom.
 * It is a size container, so the number scales with the card's width.
 */
const CARD = [
  '@container flex aspect-[1.586] flex-col justify-between',
  'rounded-2xl border border-line p-4 shadow-overlay',
].join(' ');

/** The number's type: 5.4% of the card's width fits a 19-digit number on one line. */
const NUMBER = 'font-mono text-[5.4cqw] tracking-[.1em] whitespace-nowrap tabular-nums text-ink';

/**
 * Renders the card preview and its caption.
 *
 * @param props - The network, the digits or last four, the texts on the card and the caption.
 * @returns The preview.
 */
export function CardPreview({
  network, digits, last4, billing, expiry, caption,
}: CardPreviewProps) {
  return (
    <figure className="flex flex-col gap-2">
      <div
        data-theme="dark"
        aria-hidden="true"
        className={CARD}
        style={cardSurfaceStyle(network)}
      >
        <div className="flex items-center justify-between">
          <div className="h-7 w-9 rounded-md opacity-90" style={chipStyle()} />
          <span className={`h-7 w-11 ${LOGO_BADGE}`}>
            <CardNetworkLogo network={network} className="max-w-full text-[20px]" />
          </span>
        </div>
        <div className={NUMBER}>
          {cardNumberParts(network, digits, last4).map(({ text, placeholder }) => (
            <span key={text} className={placeholder ? 'text-muted' : undefined}>{text}</span>
          ))}
        </div>
        <div className="flex justify-between gap-2 type-micro font-medium text-muted">
          <span>{billing}</span>
          <span className="tabular-nums">{expiry}</span>
        </div>
      </div>
      {caption && (
        <figcaption aria-live="polite" className="text-center type-caption text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
