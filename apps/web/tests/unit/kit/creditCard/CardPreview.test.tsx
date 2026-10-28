import type { CardNetwork } from '@financas/reference';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardPreview } from '../../../../src/kit/creditCard/CardPreview';
import { cardSurfaceStyle } from '../../../../src/kit/creditCard/cardNumber';

// Kit component (BDT: Interaction tier → unit, nothing mocked).

/**
 * Reads a network's surface as the browser stores it (colours as rgb()).
 *
 * @param network - The card network.
 * @returns The `background-image` the element ends up with.
 */
const surfaceOf = (network: CardNetwork) => {
  const probe = document.createElement('div');
  Object.assign(probe.style, cardSurfaceStyle(network));
  return probe.style.backgroundImage;
};

/**
 * Finds the drawn card: the preview's picture, hidden from assistive tech.
 *
 * @param container - The rendered preview.
 * @returns The card element.
 */
const cardOf = (container: HTMLElement) => (
  container.querySelector<HTMLElement>('[aria-hidden="true"]')!
);

describe('CardPreview', () => {
  it('draws the card in its network’s colour, in the dark theme, as a picture', () => {
    const { container } = render(<CardPreview network="visa" digits="" />);
    const card = cardOf(container);

    expect(card.dataset.theme).toBe('dark');
    expect(card.style.backgroundImage).toBe(surfaceOf('visa'));
  });

  it('shows the digits typed and dims the dots still to come', () => {
    render(<CardPreview network="mastercard" digits="550209424242" />);

    expect(screen.getByText('5502 0942 4242').className).toBe('');
    expect(screen.getByText('••••').className).toBe('text-muted');
  });

  it('shows a saved card’s last four digits when no number is typed', () => {
    render(<CardPreview network="visa" digits="" last4="1111" />);

    expect(screen.getByText('1111')).toBeDefined();
  });

  it('draws the network’s logo', () => {
    const { container } = render(<CardPreview network="elo" digits="5067" />);

    expect(cardOf(container).querySelector('svg')).not.toBeNull();
  });

  it('writes the billing line and the expiry along the bottom', () => {
    render(<CardPreview network="visa" digits="" billing="Fecha 05 · Vence 12" expiry="03/28" />);

    expect(screen.getByText('Fecha 05 · Vence 12')).toBeDefined();
    expect(screen.getByText('03/28').className).toBe('tabular-nums');
  });

  it('reads out its caption as it changes', () => {
    const caption = 'Mastercard identificado pelo número';
    render(<CardPreview network="mastercard" digits="55" caption={caption} />);

    const shown = screen.getByText(caption);
    expect(shown.tagName).toBe('FIGCAPTION');
    expect(shown.getAttribute('aria-live')).toBe('polite');
  });

  it('has no caption when none is given', () => {
    const { container } = render(<CardPreview network="other" digits="" />);

    expect(container.querySelector('figcaption')).toBeNull();
  });
});
