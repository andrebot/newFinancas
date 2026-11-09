import { screen, within } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ComingDue } from '../../../../src/experiences/interactions/ComingDue';
import { renderInLocale } from '../../../support/renderInLocale';
import { HOLDINGS, OVERVIEW } from '../portfolioFixtures';

// Coming Due (BDT: Interaction, unit; nothing mocked — the kit and the
// translator run for real; only the clock is fixed, on 20 September 2026).

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ComingDue', () => {
  it('titles the panel and notes it is fixed income', () => {
    renderInLocale(<ComingDue entries={OVERVIEW.comingDue} holdings={HOLDINGS} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Coming dueFixed income');
  });

  it('lists the soonest first: a soon one in months, a later one by its year', () => {
    renderInLocale(<ComingDue entries={OVERVIEW.comingDue} holdings={HOLDINGS} />);
    const [cd, tesouro] = screen.getAllByRole('listitem');
    expect(within(cd!).getByText('Used Car Savings CD')).toBeTruthy();
    expect(within(cd!).getByText('in 3 months').className).toContain('text-sun');
    expect(within(cd!).getByText('$5,000.00')).toBeTruthy();
    expect(within(tesouro!).getByText(/Tesouro Direto · 2035/)).toBeTruthy();
  });

  it('marks a Holding past its date, not yet redeemed, as overdue in coral', () => {
    const overdue = { ...OVERVIEW.comingDue[1]!, dueDate: '2026-09-15' };
    renderInLocale(<ComingDue entries={[overdue]} holdings={HOLDINGS} />);
    expect(screen.getByText('Overdue').className).toContain('text-coral');
    expect(screen.getByText('Sep').parentElement?.className).toContain('bg-coral/15');
  });

  it('keeps a Holding due later plain, by its year', () => {
    renderInLocale(<ComingDue entries={[OVERVIEW.comingDue[0]!]} holdings={HOLDINGS} />);
    expect(screen.getByText('May').parentElement?.className).toContain('bg-raised');
  });

  it('reads the due date out in full, the badge being decoration', () => {
    renderInLocale(<ComingDue entries={OVERVIEW.comingDue} holdings={HOLDINGS} />);
    expect(screen.getByText('Due 12/15/2026:')).toBeTruthy();
    const [badge] = screen.getAllByText('Dec');
    expect(badge?.parentElement?.getAttribute('aria-hidden')).toBe('true');
  });

  it('speaks the interface language', () => {
    renderInLocale(<ComingDue entries={OVERVIEW.comingDue} holdings={HOLDINGS} />, 'pt-BR');
    expect(screen.getByText('em 3 meses')).toBeTruthy();
  });

  it('shows placeholders while the report loads', () => {
    renderInLocale(<ComingDue entries={undefined} holdings={HOLDINGS} />);
    expect(screen.getByRole('status', { name: 'Loading what comes due' })).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('says so when nothing comes due', () => {
    renderInLocale(<ComingDue entries={[]} holdings={HOLDINGS} />);
    expect(screen.getByText('Nothing coming due.')).toBeTruthy();
  });
});
