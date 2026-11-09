import type { PayoutsReport } from '@financas/api-types';
import {
  act, fireEvent, screen, within,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { PayoutPanel, type PayoutPanelProps } from '../../../../src/experiences/interactions/PayoutPanel';
import type { PreferenceStorage } from '../../../../src/utilities/safeStorage';
import { renderInLocale } from '../../../support/renderInLocale';
import { HOLDINGS, OVERVIEW, PAYOUTS } from '../portfolioFixtures';

// The payout panel (BDT: Interaction, unit; nothing mocked — K12, K39 and the
// translator run for real; the Experience's choice and handlers are props, the
// switch's storage a stand-in, and the clock fixed on 20 September 2026).

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

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

/** Every Holding's id, as "all" resolves. */
const ALL = HOLDINGS.map((holding) => holding.id ?? '');

/**
 * Renders the panel with every Holding chosen and the payouts loaded.
 *
 * @param over - Props to change.
 * @param locale - The interface language.
 * @returns The props it was given.
 */
const renderPanel = (over: Partial<PayoutPanelProps> = {}, locale: 'en-US' | 'pt-BR' = 'en-US') => {
  const props: PayoutPanelProps = {
    holdings: HOLDINGS,
    chosen: ALL,
    onChosenChange: vi.fn(),
    payouts: { status: 'loaded', report: PAYOUTS },
    onRetry: vi.fn(),
    thisMonth: OVERVIEW.payoutThisMonth,
    currencyMemory: memoryOf(null),
    ...over,
  };
  renderInLocale(<PayoutPanel {...props} />, locale);
  return props;
};

/**
 * Finds the month's total beside the switch: the chart's hidden table repeats it.
 *
 * @param text - The total, as written.
 * @returns The heading's figure.
 */
const headerTotal = (text: string) => screen.getAllByText(text)
  .find((element) => element.className.includes('text-mint'));

/** Opens the selector and lets Floating UI settle. */
const openSelector = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Holdings' }));
  });
};

describe('PayoutPanel', () => {
  it('titles the panel with what it shows and over how long', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Payout over time' })).toBeTruthy();
    expect(screen.getByText(/last 12 months/)).toBeTruthy();
  });

  it('opens on R$, with this month\'s total in it', () => {
    renderPanel();
    expect(screen.getByText('September/2026')).toBeTruthy();
    expect(headerTotal('R$ 1.100,00')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Payouts by month' })).toBeTruthy();
  });

  it('switches to $ and remembers the pick', () => {
    const { currencyMemory } = renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: '$' }));
    expect(headerTotal('$4.00')).toBeTruthy();
    expect(currencyMemory.write).toHaveBeenCalledWith('USD');
  });

  it('opens on the remembered currency', () => {
    renderPanel({ currencyMemory: memoryOf('USD') });
    expect(headerTotal('$4.00')).toBeTruthy();
  });

  it('sums the choice up in the selector', () => {
    renderPanel({ chosen: ['xpml11', 'knri11'] });
    const selector = screen.getByRole('button', { name: 'Holdings' });
    expect(selector.textContent).toContain('2 of 8 holdings');
  });

  it('lists the Holdings by family, each with its colour and this month\'s payout', async () => {
    renderPanel();
    await openSelector();
    const panel = screen.getByRole('dialog', { name: 'Holdings' });
    ['FIIs', 'Stocks', 'Fixed income'].forEach((name) => {
      expect(within(panel).getByRole('group', { name })).toBeTruthy();
    });
    expect(within(panel).queryByRole('group', { name: 'Other' })).toBeNull();
    // A row: the swatch, the ticker and this month's payout, side by side.
    const xpml = within(panel).getByText('XPML11').parentElement!;
    expect(xpml.querySelector('[style*="background"]')).toBeTruthy();
    expect(within(xpml).getByText('R$ 890,00')).toBeTruthy();
    const vale = within(panel).getByText('VALE3').parentElement!;
    expect(vale.querySelector('.bg-track')).toBeTruthy();
    expect(within(vale).getByText('—')).toBeTruthy();
  });

  it('marks an archived Holding', async () => {
    renderPanel();
    await openSelector();
    const panel = screen.getByRole('dialog', { name: 'Holdings' });
    expect(within(panel).getByText('Archived')).toBeTruthy();
    expect(within(panel).getAllByText('Archived')).toHaveLength(1);
  });

  it('offers a preset per family and emits what is chosen', async () => {
    const { onChosenChange } = renderPanel({ chosen: [] });
    await openSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Stocks' }));
    expect(onChosenChange).toHaveBeenLastCalledWith(['aapl', 'msft', 'vale3']);
    fireEvent.click(screen.getByRole('checkbox', { name: /KNRI11/ }));
    expect(onChosenChange).toHaveBeenCalledTimes(2);
  });

  it('asks for a choice when nothing is chosen, and shows no total', () => {
    renderPanel({ chosen: [] });
    expect(screen.getByText('Choose holdings to see what they paid.')).toBeTruthy();
    expect(screen.queryByText('September/2026')).toBeNull();
  });

  it('shows a placeholder while the payouts load', () => {
    renderPanel({ payouts: { status: 'loading' } });
    expect(screen.getByRole('status', { name: 'Loading payouts' })).toBeTruthy();
    expect(screen.queryByText('September/2026')).toBeNull();
  });

  it('offers Try again when the payouts failed', () => {
    const { onRetry } = renderPanel({ payouts: { status: 'failed' } });
    expect(screen.getByText("Couldn't load the payouts.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says so when nothing was paid in the switch\'s currency', () => {
    const brlOnly: PayoutsReport = {
      ...PAYOUTS, series: PAYOUTS.series.filter((series) => series.currency === 'BRL'),
    };
    renderPanel({
      payouts: { status: 'loaded', report: brlOnly },
      currencyMemory: memoryOf('USD'),
    });
    expect(screen.getByText('No payouts in $ over these months.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Payouts by month' })).toBeNull();
  });

  it('leaves the payouts out of the selector when none are handed in', async () => {
    renderPanel({ thisMonth: undefined });
    await openSelector();
    const panel = screen.getByRole('dialog', { name: 'Holdings' });
    expect(within(panel).queryByText('R$ 890,00')).toBeNull();
  });

  it('speaks the interface language', () => {
    renderPanel({}, 'pt-BR');
    expect(screen.getByRole('heading', { name: 'Proventos ao longo do tempo' })).toBeTruthy();
    expect(screen.getByText('setembro/2026')).toBeTruthy();
  });
});
