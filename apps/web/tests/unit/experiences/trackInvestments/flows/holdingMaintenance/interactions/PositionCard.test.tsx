import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PositionCard } from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/PositionCard';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { holdingOf, holdingWithout } from '../../../../portfolioFixtures';

// Position (BDT: Interaction, unit; nothing mocked). Mockup 51's XPML11.

const XPML = holdingOf('xpml11', { quantity: 120_000_000_000, costBasis: 11000000 });

describe('PositionCard', () => {
  it('shows the units, average price, cost and this month\'s payout with its yield', () => {
    renderInLocale(<PositionCard holding={XPML} currency="BRL" value={11000000} payout={89000} />);

    expect(screen.getByRole('heading', { name: 'Position' })).toBeTruthy();
    expect([...document.querySelectorAll('dt')].map((term) => term.textContent))
      .toEqual(['Quantity', 'Avg. price', 'Invested', 'Payout']);
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('R$ 91,67')).toBeTruthy();
    expect(screen.getByText('R$ 110.000,00')).toBeTruthy();
    expect(screen.getByText('R$ 890,00')).toBeTruthy();
    expect(screen.getByText('/mo')).toBeTruthy();
    expect(screen.getByText('0.81% monthly yield')).toBeTruthy();
  });

  it('counts a missing cost as nothing', () => {
    const bare = holdingWithout(XPML, 'costBasis');
    renderInLocale(<PositionCard holding={bare} currency="BRL" value={0} payout={0} />);

    expect(screen.getAllByText('R$ 0,00').length).toBeGreaterThan(0);
  });

  it('says when nothing was paid, and dashes the average with no units', () => {
    renderInLocale(
      <PositionCard holding={{ ...XPML, quantity: 0 }} currency="BRL" value={0} payout={0} />,
    );

    expect(screen.getByText('No payout this month yet')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });
});
