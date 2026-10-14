import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { badge } from '../../../../src/config/constants';
import { CountBadge, countBadgeText } from '../../../../src/kit/countBadge/CountBadge';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('countBadgeText', () => {
  it('shows the count as is up to the cap', () => {
    expect(countBadgeText(1, 9)).toBe('1');
    expect(countBadgeText(9, 9)).toBe('9');
  });

  it('shows the cap with a plus past it', () => {
    expect(countBadgeText(10, 9)).toBe('9+');
    expect(countBadgeText(250, 99)).toBe('99+');
  });
});

describe('CountBadge', () => {
  it('renders nothing at zero', () => {
    const { container } = render(<CountBadge count={0} label="Nenhuma" />);

    expect(container.firstChild).toBeNull();
  });

  it('shows the number to the eye and the label to screen readers', () => {
    render(<CountBadge count={2} label="2 notificações não vistas" />);

    expect(screen.getByText('2').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('2 notificações não vistas').className).toBe('sr-only');
  });

  it('caps the number at the configured maximum', () => {
    render(<CountBadge count={badge.maxCount + 1} label="Muitas" />);

    expect(screen.getByText(`${badge.maxCount}+`)).toBeDefined();
  });

  it('is a coral circle placed by the caller', () => {
    const { container } = render(
      <CountBadge count={3} label="3" className="absolute top-1.5 right-1.5" />,
    );

    const bubble = container.firstElementChild!;
    expect(bubble.className).toContain('bg-coral');
    expect(bubble.className).toContain('text-oncoral');
    expect(bubble.className.endsWith(' absolute top-1.5 right-1.5')).toBe(true);
  });

  it('adds no stray classes when the caller passes none', () => {
    const { container } = render(<CountBadge count={3} label="3" />);

    expect(container.firstElementChild!.className.endsWith('tabular-nums')).toBe(true);
  });
});
