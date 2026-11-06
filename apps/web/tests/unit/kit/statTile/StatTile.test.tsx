import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { statTile } from '../../../../src/config/constants';
import { pillLookOf, StatTile, type StatTileProps } from '../../../../src/kit/statTile/StatTile';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): the translator and K38 run for real.

const POINTS = [
  {
    key: 'aug', date: '2026-08-31', value: 100, valueLabel: '$1.00', dateLabel: 'Aug',
  },
  {
    key: 'sep', date: '2026-09-30', value: 200, valueLabel: '$2.00', dateLabel: 'Sep',
  },
];

/**
 * Renders the tile.
 *
 * @param props - What to change in the defaults.
 * @param locale - The interface language.
 * @returns The render's result.
 */
const renderTile = (
  props: Partial<StatTileProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => renderInLocale(
  <StatTile
    label="Net worth · USD"
    amount={1913000}
    currency="USD"
    change={{ amount: 241000, comparedTo: 'Aug' }}
    points={POINTS}
    {...props}
  />,
  locale,
);

/**
 * Finds the pill by its text.
 *
 * @param text - What the pill says.
 * @returns The pill.
 */
const pill = (text: string) => screen.getByText(text);

describe('pillLookOf', () => {
  it('reads a rise as mint and up', () => {
    expect(pillLookOf(1)).toEqual({ tone: 'mint', icon: 'arrow-upward' });
  });

  it('reads a fall as coral and down', () => {
    expect(pillLookOf(-1)).toEqual({ tone: 'coral', icon: 'arrow-downward' });
  });

  it('reads no change as neutral, with no arrow', () => {
    expect(pillLookOf(0)).toEqual({ tone: 'neutral', icon: undefined });
  });
});

describe('StatTile', () => {
  it('shows the label and the figure in its currency', () => {
    renderTile();
    expect(screen.getByText('Net worth · USD', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('$19,130.00')).toBeTruthy();
  });

  it('shows a rise in mint, with its sign and an arrow', () => {
    renderTile();
    const rise = pill('+$2,410.00 vs Aug');
    expect(rise.className).toContain('text-mint');
    expect(rise.querySelector('svg')).not.toBeNull();
  });

  it('shows a fall in coral, with its sign and an arrow', () => {
    renderTile({ change: { amount: -241000, comparedTo: 'Aug' } });
    const fall = pill('−$2,410.00 vs Aug');
    expect(fall.className).toContain('text-coral');
    expect(fall.querySelector('svg')).not.toBeNull();
  });

  it('says no change in a neutral pill, with no arrow', () => {
    renderTile({ change: { amount: 0, comparedTo: 'Aug' } });
    const unchanged = pill('Unchanged vs Aug');
    expect(unchanged.className).toContain('text-muted');
    expect(unchanged.querySelector('svg')).toBeNull();
  });

  it('draws no pill without a change', () => {
    renderTile({ change: undefined });
    expect(screen.queryByText(/vs/)).toBeNull();
  });

  it('writes the pill in the interface language', () => {
    renderTile({ change: { amount: 0, comparedTo: 'ago' } }, 'pt-BR');
    expect(pill('Sem mudança vs ago')).toBeTruthy();
  });

  it('names the chart after the label, at the default height', () => {
    renderTile();
    expect(screen.getByRole('group', { name: 'Net worth · USD' }).style.height)
      .toBe(`${statTile.defaultChartHeightPx}px`);
  });

  it('takes the height the caller names', () => {
    renderTile({ chartHeightPx: 150 });
    expect(screen.getByRole('group', { name: 'Net worth · USD' }).style.height).toBe('150px');
  });

  it('colours the line by currency', () => {
    const { container, unmount } = renderTile({ change: undefined });
    expect(container.querySelector('.text-mint')).not.toBeNull();
    expect(container.querySelector('.text-sky')).toBeNull();
    unmount();
    const brl = renderTile({ currency: 'BRL', change: undefined });
    expect(brl.container.querySelector('.text-sky')).not.toBeNull();
    expect(brl.container.querySelector('.text-mint')).toBeNull();
  });

  it('lets a month be read on the chart', () => {
    renderTile();
    const plot = screen.getByRole('group', { name: 'Net worth · USD' });
    fireEvent.keyDown(plot, { key: 'Enter' });
    expect(screen.getByText('Sep $2.00')).toBeTruthy();
  });

  it('keeps the figure when there is no series', () => {
    renderTile({ points: [], change: undefined });
    expect(screen.getByText('$19,130.00')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
  });
});
