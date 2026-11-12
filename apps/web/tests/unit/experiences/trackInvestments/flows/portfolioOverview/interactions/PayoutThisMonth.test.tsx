import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PayoutThisMonth } from '../../../../../../../src/experiences/trackInvestments/flows/portfolioOverview/interactions/PayoutThisMonth';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { HOLDINGS, OVERVIEW } from '../../../../portfolioFixtures';

// Payout This Month (BDT: Interaction, unit; nothing mocked — the kit and the
// translator run for real).

/** Renders the panel for September 2026 with the overview's payouts. */
const renderLoaded = () => renderInLocale(
  <PayoutThisMonth
    period="September/2026"
    entries={OVERVIEW.payoutThisMonth}
    holdings={HOLDINGS}
  />,
);

describe('PayoutThisMonth', () => {
  it('titles the panel with the month', () => {
    renderLoaded();
    expect(screen.getByRole('heading', { name: 'Payout this month' })).toBeTruthy();
    expect(screen.getByText('September/2026')).toBeTruthy();
  });

  it('lists each payout, R$ first and largest first, with its kind', () => {
    renderLoaded();
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.firstElementChild?.textContent))
      .toEqual(['XPML11', 'KNRI11', 'AAPL', 'Used Car Savings CD']);
    expect(within(rows[0]!).getByText('Dividend')).toBeTruthy();
    expect(within(rows[0]!).getByText('+R$ 890,00')).toBeTruthy();
    expect(within(rows[3]!).getByText('Interest')).toBeTruthy();
  });

  it('tints a ticker by its family', () => {
    renderLoaded();
    expect(screen.getByText('XPML11').getAttribute('style')).toContain('--c-cat-lilac');
    expect(screen.getByText('AAPL').getAttribute('style')).toContain('--c-cat-sun');
  });

  it('totals each currency apart, never summed', () => {
    renderLoaded();
    const total = screen.getByText('Total').parentElement!;
    expect(total.textContent).toBe('TotalR$\u00A01.100,00· $6.80');
  });

  it('shows placeholders while the report loads', () => {
    renderInLocale(
      <PayoutThisMonth period="September/2026" entries={undefined} holdings={HOLDINGS} />,
    );
    expect(screen.getByRole('status', { name: "Loading this month's payouts" })).toBeTruthy();
  });

  it('shows one state at a time: placeholders, the empty line or the list (R4 V9)', () => {
    const { rerenderInLocale } = renderInLocale(
      <PayoutThisMonth period="September/2026" entries={[]} holdings={HOLDINGS} />,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();

    rerenderInLocale(
      <PayoutThisMonth period="September/2026" entries={undefined} holdings={HOLDINGS} />,
    );
    expect(screen.queryByText('No payouts yet this month.')).toBeNull();
  });

  it('says so when nothing came in yet', () => {
    renderInLocale(<PayoutThisMonth period="September/2026" entries={[]} holdings={HOLDINGS} />);
    expect(screen.getByText('No payouts yet this month.')).toBeTruthy();
    expect(screen.queryByText('Total')).toBeNull();
  });
});
