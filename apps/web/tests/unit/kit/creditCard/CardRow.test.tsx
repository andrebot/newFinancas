import { CARD_NETWORKS, type CardNetwork } from '@financas/reference';
import { catalogs, SUPPORTED_LOCALES } from '@financas/i18n';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { CardRow } from '../../../../src/kit/creditCard/CardRow';
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

describe('the cardNetworks catalog section', () => {
  it.each(SUPPORTED_LOCALES)('names every card network in %s', (locale) => {
    expect(Object.keys(catalogs[locale].cardNetworks).sort()).toEqual([...CARD_NETWORKS].sort());
  });
});

/**
 * Renders a saved Visa card ending in 1111, with optional slots.
 *
 * @param slots - The meta line and the trailing action, if any.
 * @param network - The card's network.
 * @returns The render result.
 */
const renderRow = (
  slots: { meta?: string; trailing?: ReactNode } = {},
  network: CardNetwork = 'visa',
) => render(<CardRow network={network} last4="1111" networkName="Visa" {...slots} />);

describe('CardRow', () => {
  it('draws the strip in its network’s colour, in the dark theme', () => {
    const { container } = renderRow({}, 'mastercard');
    const strip = container.firstElementChild as HTMLElement;

    expect(strip.dataset.theme).toBe('dark');
    expect(strip.style.backgroundImage).toBe(surfaceOf('mastercard'));
  });

  it('names the network through its logo and shows the last four digits', () => {
    renderRow();

    expect(screen.getByRole('img', { name: 'Visa' })).toBeDefined();
    expect(screen.getByText('1111')).toBeDefined();
    expect(screen.getByText('••••').getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the meta line and the action when given', () => {
    const trailing = <button type="button">Remover cartão</button>;
    renderRow({ meta: 'Fecha 15 · Vence 22', trailing });

    expect(screen.getByText('Fecha 15 · Vence 22')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remover cartão' })).toBeDefined();
  });

  it('leaves out the meta line and the action when not given', () => {
    const { container } = renderRow();

    expect(container.querySelector('.type-caption')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
