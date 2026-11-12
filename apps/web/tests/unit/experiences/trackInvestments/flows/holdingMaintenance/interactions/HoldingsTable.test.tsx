import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { holdingGroupsOf } from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/holdingMaintenance';
import { HoldingsTable } from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/HoldingsTable';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { HOLDINGS, OVERVIEW, holdingOf } from '../../../../portfolioFixtures';

// Holdings Table (BDT: Interaction, unit; nothing mocked — K43, the kit and
// the translator run for real; the panel is the caller's).

const TESOURO = holdingOf('selic29', {
  assetType: 'tesouro_direto',
  ticker: 'Tesouro Selic 2029',
  costBasis: 14000000,
  dueDate: '2029-03-15',
  rate: { type: 'selic', value: 1000000, spread: null },
});
const XP = [...HOLDINGS.filter((holding) => holding.accountId === 'xp'), TESOURO];

/**
 * Renders XP's table.
 *
 * @param wide - Whether every column fits.
 * @param holdings - The account's Holdings.
 * @param openHoldingId - The Holding whose row is open at first, if any.
 * @returns The render result.
 */
const renderTable = (wide: boolean, holdings = XP, openHoldingId?: string) => renderInLocale(
  <HoldingsTable
    accountName="XP Investimentos"
    currency="BRL"
    groups={holdingGroupsOf(holdings, OVERVIEW.allocations, 'BRL')}
    wide={wide}
    renderPanel={(row) => <p>{`Panel of ${row.holding.ticker}`}</p>}
    openHoldingId={openHoldingId}
  />,
);

describe('HoldingsTable', () => {
  it('heads the table with the account and its value by type', () => {
    renderTable(true);

    expect(screen.getByRole('heading', { name: 'XP Investimentos' })).toBeTruthy();
    expect(screen.getByRole('img', {
      name: 'Allocation by type: FII 52%, Tesouro Direto 47%, and Stock 1%',
    })).toBeTruthy();
  });

  it('draws every column on a wide screen, fixed income first', () => {
    renderTable(true);

    expect(screen.getAllByText(/^(Investment|Type|Rate|Quantity|Value|Due)$/))
      .toHaveLength(6);
    expect(screen.getByText('Fixed income')).toBeTruthy();
    expect(screen.getByText('Variable income')).toBeTruthy();
    expect(screen.getByText('100.00% of Selic')).toBeTruthy();
    expect(screen.getByText('03/15/2029')).toBeTruthy();
    expect(screen.getByText('Tesouro Selic 2029')).toBeTruthy();
    expect(screen.getAllByText('0.000001')).toHaveLength(4);
  });

  it('marks an archived Holding and ends with the count and total', () => {
    renderTable(true);

    expect(screen.getByText('Archived')).toBeTruthy();
    const footer = screen.getByText(/^6 holdings · positions come from/).parentElement!;
    expect(footer.textContent).toContain('R$\u00A0298.600,00');
  });

  it('keeps only Investment and Value on a narrow screen', () => {
    renderTable(false);

    expect(screen.queryByText('Type')).toBeNull();
    expect(screen.getByText('Investment')).toBeTruthy();
    expect(screen.getByText('Value')).toBeTruthy();
    expect(screen.queryByText('100.00% of Selic')).toBeNull();
  });

  it('opens a row onto the caller\'s panel', () => {
    renderTable(true);

    fireEvent.click(screen.getByText('XPML11'));

    expect(screen.getByText('Panel of XPML11')).toBeTruthy();
    expect(screen.queryByText('Panel of KNRI11')).toBeNull();
  });

  it('opens a linked Holding\'s row at first (OQ-243)', () => {
    renderTable(true, XP, 'xpml11');

    expect(screen.getByText('Panel of XPML11')).toBeTruthy();
    expect(screen.queryByText('Panel of KNRI11')).toBeNull();
  });

  it('draws no type bar for an account worth nothing, and dashes what a Holding lacks', () => {
    renderTable(true, [holdingOf('zero11'), holdingOf('cdb', { assetType: 'cdb', ticker: 'CDB' })]);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
