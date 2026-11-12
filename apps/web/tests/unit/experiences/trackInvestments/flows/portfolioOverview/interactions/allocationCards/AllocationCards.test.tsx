import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AccountAllocation, FamilyAllocation, GoalFunding, TypeAllocation,
} from '../../../../../../../../src/experiences/trackInvestments/flows/portfolioOverview/interactions/allocationCards/AllocationCards';
import { renderInLocale } from '../../../../../../../support/renderInLocale';
import { goalOf } from '../../../../../monthFixtures';
import {
  holdingOf, HOLDINGS, INVESTMENT_ACCOUNTS, OVERVIEW, GOALS,
} from '../../../../../portfolioFixtures';

// Allocation Cards (BDT: Interaction, unit; nothing mocked — the kit, the
// donut and the translator run for real).

const SLICES = OVERVIEW.allocations;

describe('FamilyAllocation', () => {
  it('draws a donut and legend per currency, the total in the middle', () => {
    renderInLocale(<FamilyAllocation slices={SLICES} holdings={HOLDINGS} family="stock" />);
    expect(screen.getByRole('heading', { name: 'Stocks allocation' })).toBeTruthy();
    expect(screen.getByText('$8.8K')).toBeTruthy();
    expect(screen.getByText('55% · $4,820.00')).toBeTruthy();
    expect(screen.getByText('100% · R$ 3.600,00')).toBeTruthy();
  });

  it('reads each donut\'s total out, the drawing itself hidden', () => {
    renderInLocale(<FamilyAllocation slices={SLICES} holdings={HOLDINGS} family="stock" />);
    expect(screen.getByText('Total in USD: $8,780.00')).toBeTruthy();
    expect(screen.getByText('$8.8K').closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('names the FIIs panel', () => {
    renderInLocale(<FamilyAllocation slices={SLICES} holdings={HOLDINGS} family="fii" />);
    expect(screen.getByRole('heading', { name: 'FIIs allocation' })).toBeTruthy();
    expect(screen.getByText('71% · R$ 110.000,00')).toBeTruthy();
  });

  it('leaves the panel out when the household holds none of the family', () => {
    const { container } = renderInLocale(
      <FamilyAllocation slices={SLICES} holdings={[holdingOf('xpml11')]} family="stock" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows a placeholder while the report loads', () => {
    renderInLocale(<FamilyAllocation slices={undefined} holdings={HOLDINGS} family="stock" />);
    expect(screen.getByRole('status', { name: 'Loading Stocks allocation' })).toBeTruthy();
  });
});

describe('TypeAllocation', () => {
  it('draws a bar per currency, with its total and each type\'s amount', () => {
    renderInLocale(<TypeAllocation slices={SLICES} />);
    expect(screen.getByRole('heading', { name: 'By type' })).toBeTruthy();
    expect(screen.getByText('$13,780.00')).toBeTruthy();
    expect(screen.getByText('CD')).toBeTruthy();
    expect(screen.getByText('$5,000.00')).toBeTruthy();
  });

  it('says so when there is nothing to show', () => {
    renderInLocale(<TypeAllocation slices={[]} />);
    expect(screen.getByText('Nothing to show yet.')).toBeTruthy();
  });
});

describe('GoalFunding', () => {
  it('shows each Goal\'s progress, and one nothing funds', () => {
    renderInLocale(<GoalFunding goals={GOALS} />);
    expect(screen.getByRole('heading', { name: 'Goalsfunded by holdings' })).toBeTruthy();
    const [funded, unfunded] = screen.getAllByRole('listitem');
    expect(within(funded!).getByText('32%')).toBeTruthy();
    expect(within(funded!).getByRole('progressbar', { name: 'Emergency Fund: funded so far' }))
      .toBeTruthy();
    expect(within(funded!).getAllByText('$3,200.00 / $10,000.00').length).toBeGreaterThan(0);
    expect(within(unfunded!).getByText('Not funded yet')).toBeTruthy();
    expect(within(unfunded!).queryByRole('progressbar')).toBeNull();
  });

  it('fills a Goal reached in mint', () => {
    const reached = goalOf('Done', [{
      holdingId: 'cd',
      name: 'CD',
      percentage: 100,
      contribution: { currency: 'USD', amount: 1000000 },
    }]);
    renderInLocale(<GoalFunding goals={[reached]} />);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(document.querySelector('.bg-mint')).toBeTruthy();
  });

  it('shows a placeholder while the Goals load, and says when there are none', () => {
    const { rerenderInLocale } = renderInLocale(<GoalFunding goals={undefined} />);
    expect(screen.getByRole('status', { name: 'Loading Goals' })).toBeTruthy();
    rerenderInLocale(<GoalFunding goals={[]} />);
    expect(screen.getByText('Nothing to show yet.')).toBeTruthy();
  });
});

describe('AccountAllocation', () => {
  it('lists each account\'s value and how many Holdings it has open', () => {
    renderInLocale(
      <AccountAllocation slices={SLICES} holdings={HOLDINGS} accounts={INVESTMENT_ACCOUNTS} />,
    );
    expect(screen.getByRole('heading', { name: 'By account' })).toBeTruthy();
    const [xp, checking] = screen.getAllByRole('listitem');
    expect(within(xp!).getByText('XP Investimentos')).toBeTruthy();
    expect(within(xp!).getByText('4 holdings')).toBeTruthy();
    expect(within(xp!).getByText('R$ 158.600,00')).toBeTruthy();
    expect(within(checking!).getByText('Main Checking')).toBeTruthy();
  });

  it('shows one state at a time: the placeholder, the empty line or the rows (R4 V9)', () => {
    const { rerenderInLocale } = renderInLocale(
      <AccountAllocation slices={SLICES} holdings={HOLDINGS} accounts={INVESTMENT_ACCOUNTS} />,
    );
    expect(screen.queryByText('Nothing to show yet.')).toBeNull();

    rerenderInLocale(
      <AccountAllocation slices={undefined} holdings={HOLDINGS} accounts={INVESTMENT_ACCOUNTS} />,
    );
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('counts in the interface language', () => {
    renderInLocale(
      <AccountAllocation slices={SLICES} holdings={HOLDINGS} accounts={INVESTMENT_ACCOUNTS} />,
      'pt-BR',
    );
    expect(screen.getByText('1 ativo')).toBeTruthy();
  });
});
