import { fireEvent, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ComingDueProps } from '../../../../../../src/experiences/interactions/ComingDue';
import type { NetWorthCardsProps } from '../../../../../../src/experiences/interactions/NetWorthCards';
import type { PayoutPanelProps } from '../../../../../../src/experiences/interactions/PayoutPanel';
import {
  PortfolioOverviewFlow, type PortfolioOverviewFlowProps,
} from '../../../../../../src/experiences/trackInvestments/flows/portfolioOverview/PortfolioOverviewFlow';
import type { PayoutThisMonthProps } from '../../../../../../src/experiences/trackInvestments/flows/portfolioOverview/interactions/PayoutThisMonth';
import type { PreferenceStorage } from '../../../../../../src/utilities/safeStorage';
import { renderInLocale } from '../../../../../support/renderInLocale';
import {
  GOALS, HOLDINGS, INVESTMENT_ACCOUNTS, OVERVIEW, PAYOUTS,
} from '../../../portfolioFixtures';

// The Portfolio Overview Flow (BDT: Flow, unit). Its Interactions are stubbed
// — they have their own suites — so the Flow is tested on what it hands each
// one in the overview's three states, the empty household, and the payout
// chart's choice passed through; the Experience's reads and handlers are the
// props it is handed. The translator and the kit's banner stay real; the
// clock is fixed on 20 September 2026.

vi.mock('../../../../../../src/experiences/interactions/NetWorthCards', () => ({
  /**
   * The tiles' stand-in: the currencies, or that they load.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  NetWorthCards: ({ entries }: NetWorthCardsProps) => (
    <div
      data-testid="net-worth"
      data-entries={entries?.map((entry) => entry.currency).join(',') ?? 'loading'}
    />
  ),
}));
vi.mock('../../../../../../src/experiences/interactions/ComingDue', () => ({
  /**
   * Coming Due's stand-in: how many rows, and how many Holdings name them.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  ComingDue: ({ entries, holdings }: ComingDueProps) => (
    <div
      data-testid="coming-due"
      data-entries={entries?.length ?? 'loading'}
      data-holdings={holdings.length}
    />
  ),
}));
vi.mock('../../../../../../src/experiences/interactions/PayoutPanel', () => ({
  /**
   * The payout panel's stand-in: the choice, the report's state, and a button to choose.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  PayoutPanel: ({
    chosen, payouts, thisMonth, holdings, onChosenChange, onRetry,
  }: PayoutPanelProps) => (
    <div
      data-testid="payout-panel"
      data-chosen={chosen.join(',')}
      data-status={payouts.status}
      data-this-month={thisMonth?.length ?? 'loading'}
      data-holdings={holdings.length}
    >
      <button type="button" onClick={() => onChosenChange(['xpml11'])}>choose</button>
      <button type="button" onClick={onRetry}>retry payouts</button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/portfolioOverview/interactions/PayoutThisMonth', () => ({
  /**
   * Payout This Month's stand-in: its month and how many rows.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  PayoutThisMonth: ({ period, entries }: PayoutThisMonthProps) => (
    <div
      data-testid="this-month"
      data-period={period}
      data-entries={entries?.length ?? 'loading'}
    />
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/portfolioOverview/interactions/allocationCards/AllocationCards', () => ({
  /**
   * A family panel's stand-in.
   *
   * @param props - What the Flow passes.
   * @param props.family - The family.
   * @param props.slices - The report's slices, if loaded.
   * @returns The stub.
   */
  FamilyAllocation: ({ family, slices }: { family: string; slices?: readonly unknown[] }) => (
    <div data-testid={`family-${family}`} data-slices={slices?.length ?? 'loading'} />
  ),
  /**
   * By type's stand-in.
   *
   * @param props - What the Flow passes.
   * @param props.slices - The report's slices, if loaded.
   * @returns The stub.
   */
  TypeAllocation: ({ slices }: { slices?: readonly unknown[] }) => (
    <div data-testid="by-type" data-slices={slices?.length ?? 'loading'} />
  ),
  /**
   * The Goals panel's stand-in.
   *
   * @param props - What the Flow passes.
   * @param props.goals - The Goals, if loaded.
   * @returns The stub.
   */
  GoalFunding: ({ goals }: { goals?: readonly unknown[] }) => (
    <div data-testid="goals" data-goals={goals?.length ?? 'loading'} />
  ),
  /**
   * By account's stand-in.
   *
   * @param props - What the Flow passes.
   * @param props.accounts - The accounts.
   * @returns The stub.
   */
  AccountAllocation: ({ accounts }: { accounts: readonly unknown[] }) => (
    <div data-testid="by-account" data-accounts={accounts.length} />
  ),
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

/** A storage the Flow only hands on. */
const MEMORY: PreferenceStorage = { read: () => null, write: vi.fn() };

/**
 * Renders the Flow with the overview loaded.
 *
 * @param over - Props to change.
 * @returns The props it was given.
 */
const renderFlow = (over: Partial<PortfolioOverviewFlowProps> = {}) => {
  const props: PortfolioOverviewFlowProps = {
    overview: { status: 'loaded', report: OVERVIEW, holdings: HOLDINGS },
    onRetry: vi.fn(),
    accounts: INVESTMENT_ACCOUNTS,
    goals: GOALS,
    payouts: {
      read: { status: 'loaded', report: PAYOUTS },
      chosen: ['xpml11', 'knri11'],
      onChosenChange: vi.fn(),
      onRetry: vi.fn(),
      currencyMemory: MEMORY,
    },
    ...over,
  };
  renderInLocale(<PortfolioOverviewFlow {...props} />);
  return props;
};

/**
 * Reads a stub's data attribute.
 *
 * @param testId - The stub.
 * @param name - The attribute, without `data-`.
 * @returns Its value.
 */
const dataOf = (testId: string, name: string) => (
  screen.getByTestId(testId).getAttribute(`data-${name}`)
);

describe('PortfolioOverviewFlow', () => {
  it('hands each panel its part of the report', () => {
    renderFlow();
    expect(dataOf('net-worth', 'entries')).toBe('BRL,USD');
    expect(dataOf('this-month', 'entries')).toBe('4');
    expect(dataOf('payout-panel', 'this-month')).toBe('4');
    expect(dataOf('family-stock', 'slices')).toBe(String(OVERVIEW.allocations.length));
    expect(dataOf('family-fii', 'slices')).toBe(String(OVERVIEW.allocations.length));
    expect(dataOf('by-type', 'slices')).toBe(String(OVERVIEW.allocations.length));
    expect(dataOf('by-account', 'accounts')).toBe('3');
    expect(dataOf('goals', 'goals')).toBe('2');
    expect(dataOf('coming-due', 'entries')).toBe('2');
    expect(dataOf('coming-due', 'holdings')).toBe(String(HOLDINGS.length));
  });

  it('names this month for its payouts', () => {
    renderFlow();
    expect(dataOf('this-month', 'period')).toBe('September/2026');
  });

  it('passes the payout chart\'s choice and report through, and its handlers back', () => {
    const { payouts } = renderFlow();
    expect(dataOf('payout-panel', 'chosen')).toBe('xpml11,knri11');
    expect(dataOf('payout-panel', 'status')).toBe('loaded');
    fireEvent.click(screen.getByRole('button', { name: 'choose' }));
    expect(payouts.onChosenChange).toHaveBeenCalledWith(['xpml11']);
    fireEvent.click(screen.getByRole('button', { name: 'retry payouts' }));
    expect(payouts.onRetry).toHaveBeenCalledOnce();
  });

  it('shows every panel loading while the overview loads', () => {
    renderFlow({ overview: { status: 'loading' }, goals: undefined });
    expect(dataOf('net-worth', 'entries')).toBe('loading');
    expect(dataOf('this-month', 'entries')).toBe('loading');
    expect(dataOf('by-type', 'slices')).toBe('loading');
    expect(dataOf('goals', 'goals')).toBe('loading');
    expect(dataOf('coming-due', 'entries')).toBe('loading');
    expect(dataOf('payout-panel', 'holdings')).toBe('0');
  });

  it('stands one banner with Try again in for every panel when the overview failed', () => {
    const { onRetry } = renderFlow({ overview: { status: 'failed' } });
    expect(screen.getByText("Couldn't load your investments.")).toBeTruthy();
    expect(screen.queryByTestId('payout-panel')).toBeNull();
    expect(screen.queryByTestId('net-worth')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows one empty state to a household with no Holding', () => {
    renderFlow({ overview: { status: 'loaded', report: OVERVIEW, holdings: [] } });
    expect(screen.getByText('No investments yet')).toBeTruthy();
    expect(screen.queryByTestId('payout-panel')).toBeNull();
  });
});
