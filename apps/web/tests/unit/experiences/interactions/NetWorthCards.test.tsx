import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetWorthCards } from '../../../../src/experiences/interactions/NetWorthCards';
import { renderInLocale } from '../../../support/renderInLocale';
import { OVERVIEW } from '../portfolioFixtures';

// Net Worth Cards (BDT: Interaction, unit; nothing mocked — K37, K38 and the
// translator run for real).

describe('NetWorthCards', () => {
  it('draws a tile per currency, USD first, never summed', () => {
    renderInLocale(<NetWorthCards entries={OVERVIEW.netWorth} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual(['Net worth · USD', 'Net worth · BRL']);
  });

  it('shows each change against the previous month', () => {
    renderInLocale(<NetWorthCards entries={OVERVIEW.netWorth} />);
    expect(screen.getByText('+$2,410.00 vs Aug')).toBeTruthy();
  });

  it('puts the tiles in a grid, which gives K37 its width, and announces nothing', () => {
    const { container } = renderInLocale(<NetWorthCards entries={OVERVIEW.netWorth} />);
    expect((container.firstElementChild as HTMLElement).className).toContain('grid');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('passes the chart\'s look on: its height and gridlines', () => {
    const { container } = renderInLocale(
      <NetWorthCards entries={OVERVIEW.netWorth} chartHeightPx={150} grid />,
    );
    expect(container.querySelectorAll('[style*="height: 150px"]')).toHaveLength(2);
    expect(container.querySelectorAll('.border-t').length).toBeGreaterThan(0);
  });

  it('draws no gridlines unless asked', () => {
    const { container } = renderInLocale(<NetWorthCards entries={OVERVIEW.netWorth} />);
    expect(container.querySelectorAll('.border-t')).toHaveLength(0);
  });

  it('keeps the page\'s shape while loading', () => {
    renderInLocale(<NetWorthCards entries={undefined} />);
    const grid = screen.getByRole('status', { name: 'Loading your net worth' });
    expect(grid.getAttribute('aria-busy')).toBe('true');
    expect(grid.children).toHaveLength(2);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('draws nothing when no Holding has a value', () => {
    const { container } = renderInLocale(<NetWorthCards entries={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
