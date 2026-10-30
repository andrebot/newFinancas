import { fireEvent, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { MonthRailsProps } from '../../../../../../src/experiences/interactions/MonthRails';
import type { PeriodSummaryProps } from '../../../../../../src/experiences/manageFinances/flows/monthOverview/interactions/PeriodSummary';
import {
  MonthOverviewFlow, type MonthOverviewFlowProps,
} from '../../../../../../src/experiences/manageFinances/flows/monthOverview/MonthOverviewFlow';
import type { PreferenceStorage } from '../../../../../../src/utilities/safeStorage';
import { renderInLocale } from '../../../../../support/renderInLocale';
import { ACCOUNTS, REPORT } from '../../../monthFixtures';

// The Month Overview Flow (BDT: Flow, unit). Its Interactions — the summary
// and the rails — are stubbed, they have their own suites, so the Flow is
// tested against its currency, its period and the report's three states; the
// Experience's month, report and handlers are the props it is handed. The
// kit's period bar and the translator stay real.

vi.mock('../../../../../../src/experiences/manageFinances/flows/monthOverview/interactions/PeriodSummary', () => ({
  /**
   * The summary's stand-in: what it shows, and a button per currency.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  PeriodSummary: ({
    period, currency, figures, loading, onCurrencyChange,
  }: PeriodSummaryProps) => (
    <div
      data-testid="summary"
      data-period={period}
      data-currency={currency}
      data-figures={JSON.stringify(figures ?? null)}
      data-loading={String(loading)}
    >
      <button type="button" onClick={() => onCurrencyChange('USD')}>pick $</button>
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

/**
 * Builds a storage holding a value.
 *
 * @param stored - What it holds.
 * @returns The storage, its write a spy.
 */
const memoryOf = (stored: string | null): PreferenceStorage => ({
  read: () => stored,
  write: vi.fn(),
});

/**
 * Renders the Flow on September 2026, its report loaded.
 *
 * @param over - Props to change.
 * @returns The props it was given.
 */
const renderFlow = (over: Partial<MonthOverviewFlowProps> = {}) => {
  const props: MonthOverviewFlowProps = {
    period: { year: 2026, month: 9 },
    onPeriodChange: vi.fn(),
    overview: { status: 'loaded', report: REPORT },
    onRetry: vi.fn(),
    accounts: ACCOUNTS,
    householdCreatedAt: '2026-01-05T10:00:00Z',
    currencyMemory: memoryOf(null),
    ...over,
  };
  renderInLocale(<MonthOverviewFlow {...props} />);
  return props;
};

/**
 * Reads what a stub was handed.
 *
 * @param testId - The stub.
 * @param name - The data attribute, without `data-`.
 * @returns Its value.
 */
const handed = (testId: string, name: string) => (
  screen.getByTestId(testId).getAttribute(`data-${name}`)
);

/**
 * Takes a month of the period bar by its short name.
 *
 * @param name - E.g. "Sep".
 * @returns The button.
 */
const month = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name} `) });

describe('MonthOverviewFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 30, 12, 0, 0));
    Element.prototype.scrollTo = () => {};
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (Element.prototype as Partial<Element>).scrollTo;
  });

  it('labels the bar, the summary and the rails with the month', () => {
    renderFlow();
    expect(handed('summary', 'period')).toBe('September/2026');
    expect(handed('rails', 'period')).toBe('September/2026');
  });

  it('opens on R$ the first time: its figures and its months', () => {
    renderFlow();
    expect(handed('summary', 'currency')).toBe('BRL');
    expect(JSON.parse(handed('summary', 'figures')!)).toEqual({ in: 0, out: 11680, net: -11680 });
    expect(screen.getByRole('button', { name: /^Sep .*R\$\s116,80/ })).toBeTruthy();
  });

  it('opens on the remembered currency', () => {
    renderFlow({ currencyMemory: memoryOf('USD') });
    expect(handed('summary', 'currency')).toBe('USD');
    expect(screen.getByRole('button', { name: /^Aug .*\$3,000\.00/ })).toBeTruthy();
  });

  it('switches currency locally, remembering it, without asking for a month', () => {
    const memory = memoryOf(null);
    const props = renderFlow({ currencyMemory: memory });
    fireEvent.click(screen.getByRole('button', { name: 'pick $' }));
    expect(handed('summary', 'currency')).toBe('USD');
    expect(JSON.parse(handed('summary', 'figures')!))
      .toEqual({ in: 320000, out: 83139, net: 236861 });
    expect(memory.write).toHaveBeenCalledWith('USD');
    expect(props.onPeriodChange).not.toHaveBeenCalled();
  });

  it('asks the Experience for the month picked', () => {
    const props = renderFlow();
    fireEvent.click(month('Aug'));
    expect(props.onPeriodChange).toHaveBeenCalledWith({ year: 2026, month: 8 });
  });

  it('reaches back to the earliest account or the household, whichever is first', () => {
    renderFlow();
    const previousYear = screen.getByRole('button', { name: 'Previous year' });
    expect(previousYear.hasAttribute('disabled')).toBe(true);
  });

  it('reaches further back when an account started earlier', () => {
    const props = renderFlow({
      accounts: [...ACCOUNTS, { ...ACCOUNTS[0]!, id: 'old', startingBalanceDate: '2024-02-01' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(props.onPeriodChange).toHaveBeenCalledWith({ year: 2025, month: 9 });
  });

  it('hands the rails the named balances, the budgets and the goals', () => {
    renderFlow();
    expect(handed('rails', 'balances'))
      .toBe('Itaú Conta, Visa •••• 1111, Emergency Fund, Nubank');
    expect(handed('rails', 'budgets')).toBe('1');
    expect(handed('rails', 'goals')).toBe('1');
  });

  it('shows placeholders, empty months and no figures while the month loads', () => {
    renderFlow({ overview: { status: 'loading' } });
    expect(handed('rails', 'balances')).toBe('loading');
    expect(handed('summary', 'loading')).toBe('true');
    expect(handed('summary', 'figures')).toBe('null');
    expect(month('Sep').textContent).toBe('Sep 2026');
  });

  it('stands a banner with Try again in for the rails when the month fails', () => {
    const props = renderFlow({ overview: { status: 'failed' } });
    expect(screen.queryByTestId('rails')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load September/2026.");
    expect(handed('summary', 'figures')).toBe('null');
    expect(handed('summary', 'loading')).toBe('false');
    expect(month('Aug').textContent).toBe('Aug 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('renders its two regions for the page grid', () => {
    renderFlow();
    const bar = screen.getByRole('region', { name: 'Period' });
    expect(bar.closest('[class*="grid-area:overview-bar"]')).toBeTruthy();
    const rails = screen.getByTestId('rails').parentElement!;
    expect(rails.className).toContain('[grid-area:overview-rails]');
  });
});
