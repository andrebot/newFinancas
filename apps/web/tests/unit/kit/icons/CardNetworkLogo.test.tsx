import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardNetworkLogo } from '../../../../src/kit/icons/CardNetworkLogo';
import { CARD_NETWORK_LOGOS, GLYPHS } from '../../../../src/kit/icons/generated/iconData';
import svgMarkup from './svgMarkup';

// Kit component (BDT: Interaction tier → unit, nothing mocked).

describe('CardNetworkLogo', () => {
  it('draws the network’s logo 1em tall, in its own proportions', () => {
    const { container } = render(<CardNetworkLogo network="elo" />);
    const svg = container.querySelector('svg')!;
    const { width, height, body } = CARD_NETWORK_LOGOS.elo;

    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${width} ${height}`);
    expect(svg.getAttribute('height')).toBe('1em');
    expect(svg.style.width).toBe('auto');
    expect(svg.style.aspectRatio).toBe(`${width} / ${height}`);
    expect(svg.innerHTML).toBe(svgMarkup(body));
  });

  it('is decorative without a label and an image with one', () => {
    const { container } = render(<CardNetworkLogo network="visa" />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');

    render(<CardNetworkLogo network="mastercard" label="Mastercard" className="h-6" />);
    const logo = screen.getByRole('img', { name: 'Mastercard' });
    expect(logo.getAttribute('class')).toBe('h-6');
  });

  it('shows the generic card icon for other, keeping label and adding the classes', () => {
    render(<CardNetworkLogo network="other" label="Outro cartão" className="h-6" />);
    const icon = screen.getByRole('img', { name: 'Outro cartão' });

    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon.innerHTML).toBe(svgMarkup(GLYPHS['credit-card-outline']));
    expect(icon.getAttribute('class')).toBe('aspect-square w-auto h-6');
  });

  it('lets the card icon for other take its width from its height', () => {
    const { container } = render(<CardNetworkLogo network="other" />);

    expect(container.querySelector('svg')?.getAttribute('class')).toBe('aspect-square w-auto');
  });
});
