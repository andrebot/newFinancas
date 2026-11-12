import type { DashboardReport } from '@financas/api-types';
import { fireEvent, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ComingDueProps } from '../../../../../../src/experiences/interactions/ComingDue';
import type { MonthRailsProps } from '../../../../../../src/experiences/interactions/MonthRails';
import type { NetWorthCardsProps } from '../../../../../../src/experiences/interactions/NetWorthCards';
import type { PayoutPanelProps } from '../../../../../../src/experiences/interactions/PayoutPanel';
import {
  DashboardFlow, type DashboardFlowProps,
} from '../../../../../../src/experiences/reviewInsights/flows/dashboard/DashboardFlow';
import type { PreferenceStorage } from '../../../../../../src/utilities/safeStorage';
import { renderInLocale } from '../../../../../support/renderInLocale';
import { ACCOUNTS, REPORT } from '../../../monthFixtures';
import { HOLDINGS, OVERVIEW, PAYOUTS } from '../../../portfolioFixtures';

// The Dashboard Flow (BDT: Flow, unit). Its Interactions are stubbed — they
// have their own suites — so the Flow is tested on what it hands each one in
// the Dashboard's three states, the household with no Holding, and the
// payout chart's choice passed through; the Experience's reads and handlers
// are the props it is handed. The translator, the kit's banner, empty state
// and button, `periodLabelOf` and `balanceCardsOf` stay real; the clock is
// fixed on 20 September 2026.

vi.mock('../../../../../../src/experiences/interactions/NetWorthCards', () => ({
  /**
   * The tiles' stand-in: the currencies, or that they load, and the chart's look.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  NetWorthCards: ({ entries, chartHeightPx, grid }: NetWorthCardsProps) => (
    <div
      data-testid="net-worth"
      data-entries={entries?.map((entry) => entry.currency).join(',') ?? 'loading'}
      data-height={chartHeightPx}
      data-grid={String(grid)}
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
      data-this-month={thisMonth === undefined ? 'none' : thisMonth.length}
      data-holdings={holdings.length}
    >
      <button type="button" onClick={() => onChosenChange(['xpml11'])}>choose</button>
      <button type="button" onClick={onRetry}>retry payouts</button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/interactions/MonthRails', async (importOriginal) => ({
  ...await importOriginal<object>(),
  /**
   * The rails' stand-in: their month and the cards' names.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  MonthRails: ({ period, content }: MonthRailsProps) => (
    <div
      data-testid="rails"
      data-period={period}
      data-balances={content?.balances.map((card) => card.name).join(', ') ?? 'loading'}
      data-budgets={content?.budgets.length ?? 'loading'}
      data-goals={content?.goals.length ?? 'loading'}
    />
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

/** A Dashboard drawn from the overview's and the month's fixtures. */
const DASHBOARD: DashboardReport = {
  netWorth: OVERVIEW.netWorth,
  comingDue: OVERVIEW.comingDue,
  payouts: PAYOUTS,
  balances: REPORT.balances,
  budgets: REPORT.budgets,
  goals: REPORT.goals,
};

/**
 * Renders the Flow with the Dashboard loaded.
 *
 * @param over - Props to change.
 * @returns The props it was given.
 */
const renderFlow = (over: Partial<DashboardFlowProps> = {}) => {
  const props: DashboardFlowProps = {
    dashboard: {
      status: 'loaded', report: DASHBOARD, holdings: HOLDINGS, accounts: ACCOUNTS,
    },
    onRetry: vi.fn(),
    onGoToTransactions: vi.fn(),
    payouts: {
      read: { status: 'loaded', report: PAYOUTS },
      chosen: ['xpml11', 'knri11'],
      onChosenChange: vi.fn(),
      onRetry: vi.fn(),
      currencyMemory: MEMORY,
    },
    ...over,
  };
  renderInLocale(<DashboardFlow {...props} />);
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

describe('DashboardFlow', () => {
  it('hands each investment panel its part of the Dashboard', () => {
    renderFlow();
    expect(dataOf('net-worth', 'entries')).toBe('BRL,USD');
    expect(dataOf('coming-due', 'entries')).toBe(String(OVERVIEW.comingDue.length));
    expect(dataOf('coming-due', 'holdings')).toBe(String(HOLDINGS.length));
    expect(dataOf('payout-panel', 'holdings')).toBe(String(HOLDINGS.length));
  });

  it('draws the net worth charts 150px tall with their background lines (mockup 20)', () => {
    renderFlow();
    expect(dataOf('net-worth', 'height')).toBe('150');
    expect(dataOf('net-worth', 'grid')).toBe('true');
  });

  it('leaves this month\'s payouts out of the selector, which the Dashboard doesn\'t send', () => {
    renderFlow();
    expect(dataOf('payout-panel', 'this-month')).toBe('none');
  });

  it('hands the rails this month, the balances named by their accounts, budgets and Goals', () => {
    renderFlow();
    expect(dataOf('rails', 'period')).toBe('September/2026');
    expect(dataOf('rails', 'balances')).toBe('Itaú Conta, Visa •••• 1111, Emergency Fund, Nubank');
    expect(dataOf('rails', 'budgets')).toBe(String(REPORT.budgets.length));
    expect(dataOf('rails', 'goals')).toBe(String(REPORT.goals.length));
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

  it('passes a failed payouts report through to the chart alone', () => {
    renderFlow({
      payouts: {
        read: { status: 'failed' },
        chosen: ['xpml11'],
        onChosenChange: vi.fn(),
        onRetry: vi.fn(),
        currencyMemory: MEMORY,
      },
    });
    expect(dataOf('payout-panel', 'status')).toBe('failed');
    expect(dataOf('net-worth', 'entries')).toBe('BRL,USD');
  });

  it('shows every panel loading while the Dashboard loads', () => {
    renderFlow({ dashboard: { status: 'loading' } });
    expect(dataOf('net-worth', 'entries')).toBe('loading');
    expect(dataOf('coming-due', 'entries')).toBe('loading');
    expect(dataOf('payout-panel', 'holdings')).toBe('0');
    expect(dataOf('rails', 'balances')).toBe('loading');
    expect(screen.queryByText('No investments yet')).toBeNull();
  });

  it('holds the payout panel loading until the Dashboard brings the Holdings', () => {
    renderFlow({ dashboard: { status: 'loading' } });
    expect(dataOf('payout-panel', 'status')).toBe('loading');
  });

  it('stands one banner with Try again in for every panel when the Dashboard failed', () => {
    const { onRetry } = renderFlow({ dashboard: { status: 'failed' } });
    expect(screen.getByText("Couldn't load your dashboard.")).toBeTruthy();
    expect(screen.queryByTestId('net-worth')).toBeNull();
    expect(screen.queryByTestId('payout-panel')).toBeNull();
    expect(screen.queryByTestId('rails')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows one card for the investment panels to a household with no Holding', () => {
    renderFlow({
      dashboard: {
        status: 'loaded', report: DASHBOARD, holdings: [], accounts: ACCOUNTS,
      },
    });
    expect(screen.getByText('No investments yet')).toBeTruthy();
    expect(screen.queryByTestId('net-worth')).toBeNull();
    expect(screen.queryByTestId('coming-due')).toBeNull();
    expect(screen.queryByTestId('payout-panel')).toBeNull();
    expect(dataOf('rails', 'budgets')).toBe(String(REPORT.budgets.length));
  });

  it('asks for Transactions from the no-Holding card', () => {
    const { onGoToTransactions } = renderFlow({
      dashboard: {
        status: 'loaded', report: DASHBOARD, holdings: [], accounts: ACCOUNTS,
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go to Transactions' }));
    expect(onGoToTransactions).toHaveBeenCalledOnce();
  });

  it('writes the Dashboard\'s texts in pt-BR', () => {
    renderInLocale(
      <DashboardFlow
        dashboard={{ status: 'failed' }}
        onRetry={vi.fn()}
        onGoToTransactions={vi.fn()}
        payouts={{
          read: { status: 'loading' },
          chosen: [],
          onChosenChange: vi.fn(),
          onRetry: vi.fn(),
          currencyMemory: MEMORY,
        }}
      />,
      'pt-BR',
    );
    expect(screen.getByText('Não foi possível carregar seu painel.')).toBeTruthy();
  });
});
