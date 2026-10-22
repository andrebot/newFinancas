import { fireEvent, screen } from '@testing-library/react';
import type { Goal } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { ProgressSummary } from '../../../../../../../src/experiences/accountSetup/flows/goalManagement/goalProgress';
import {
  cardClassesOf, dueTextOf, GoalCard, progressTextsOf, type GoalCardProps,
} from '../../../../../../../src/experiences/accountSetup/flows/goalManagement/interactions/GoalCard';
import type { GoalFunding } from '../../../../../../../src/experiences/accountSetup/sharedLists';
import { createFormatter } from '../../../../../../../src/utilities/formatting';
import { createTranslator } from '../../../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// A goal's card — the Goal Progress Card (BDT: Interaction, unit): the real
// kit, progress logic and translator; only the Flow's handlers are stand-ins.
// It renders display state and emits its events up; the whole card opens its
// edit drawer for whoever may manage it (OQ-195).

const translator = createTranslator('en-US');
const formatter = createFormatter('en-US');
const TODAY = '2026-10-22';

/**
 * Builds a goal.
 *
 * @param over - The fields to override.
 * @returns The goal.
 */
const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'trip',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Trip to Japan',
  targetAmount: 600000,
  targetCurrency: 'USD',
  dueDate: '2028-04-01',
  visibility: 'shared',
  createdAt: '2026-10-01T00:00:00Z',
  completedAt: null,
  ...over,
});

const SAME: GoalFunding = {
  contributions: [{ holdingId: 'aapl', currency: 'USD', amount: 48200 }],
  fundedBy: [{ holdingId: 'aapl', name: 'AAPL', percentage: 10 }],
};

const MIXED: GoalFunding = {
  contributions: [...SAME.contributions, { holdingId: 'xpml', currency: 'BRL', amount: 1650000 }],
  fundedBy: [...SAME.fundedBy, { holdingId: 'xpml', name: 'XPML11', percentage: 15 }],
};

/**
 * Renders the card with stand-in handlers.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderCard = (props: Partial<GoalCardProps> = {}) => {
  const handlers = { onOpen: vi.fn(), onRate: vi.fn() };
  renderInLocale(
    <GoalCard
      entry={{ goal: goal(), funding: SAME }}
      today={TODAY}
      rates={{}}
      progress="loaded"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

/**
 * Builds a progress summary.
 *
 * @param over - The fields to override.
 * @returns The summary.
 */
const summary = (over: Partial<ProgressSummary> = {}): ProgressSummary => ({
  rows: [{ holdingId: 'aapl', name: 'AAPL', percentage: 10 }],
  funded: 320000,
  percent: 53,
  toGo: 280000,
  mixed: false,
  estimate: false,
  pairs: [],
  missingPairs: [],
  ...over,
});

describe('dueTextOf', () => {
  it('writes months under a year, years and months after, this month and overdue', () => {
    expect(dueTextOf({ kind: 'ahead', years: 0, months: 5 }, translator)).toBe('in 5 months');
    expect(dueTextOf({ kind: 'ahead', years: 0, months: 1 }, translator)).toBe('in 1 month');
    expect(dueTextOf({ kind: 'ahead', years: 2, months: 9 }, translator)).toBe('in 2 yrs 9 mo');
    expect(dueTextOf({ kind: 'ahead', years: 1, months: 0 }, translator)).toBe('in 1 yr');
    expect(dueTextOf({ kind: 'thisMonth' }, translator)).toBe('this month');
    expect(dueTextOf({ kind: 'overdue' }, translator)).toBe('overdue');
  });
});

describe('progressTextsOf', () => {
  it('writes the exact amount to go', () => {
    expect(progressTextsOf(summary(), goal(), translator, formatter)).toEqual({
      headline: '53% · $2,800.00 to go', amounts: '$3,200.00 / $6,000.00',
    });
  });

  it('marks an estimate with ≈', () => {
    expect(progressTextsOf(summary({ estimate: true }), goal(), translator, formatter)).toEqual({
      headline: '53% · ≈ $2,800.00 to go', amounts: '≈ $3,200.00 / $6,000.00',
    });
  });

  it('says when the target is reached, and when nothing funds it yet', () => {
    const reached = summary({ toGo: 0, percent: 117 });
    expect(progressTextsOf(reached, goal(), translator, formatter).headline)
      .toBe('117% · target reached');
    const unfunded = summary({ rows: [], funded: 0, percent: 0 });
    expect(progressTextsOf(unfunded, goal(), translator, formatter).headline)
      .toBe('0% · not funded yet');
  });
});

describe('cardClassesOf', () => {
  it('widens a mixed card', () => {
    expect(cardClassesOf(false)).toBe('flex flex-col gap-4');
    expect(cardClassesOf(true)).toBe('flex flex-col gap-4 lg:col-span-2');
  });
});

describe('the card', () => {
  it('shows the definition: name, tags, target, due date and how far off', () => {
    renderCard();
    expect(screen.getByText('Trip to Japan')).toBeTruthy();
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getByText('$6,000.00')).toBeTruthy();
    expect(screen.getByText('04/01/2028')).toBeTruthy();
    expect(screen.getByText('in 1 yr 5 mo')).toBeTruthy();
  });

  it('shows a single-currency goal\'s progress and who funds it', () => {
    renderCard();
    expect(screen.getByText('8% · $5,518.00 to go')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progress toward Trip to Japan' })).toBeTruthy();
    expect(screen.getByText('AAPL · 10%')).toBeTruthy();
    expect(screen.getByText('$482.00')).toBeTruthy();
    expect(screen.queryByText('Mixed currencies')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('says a goal nothing funds yet points to Investments', () => {
    renderCard({ entry: { goal: goal(), funding: { contributions: [], fundedBy: [] } } });
    expect(screen.getByText('0% · not funded yet')).toBeTruthy();
    expect(screen.getByText(translator.text('goalManagement', 'fundedBy.none'))).toBeTruthy();
  });

  it('asks for the rate on a mixed goal, counting only its own currency meanwhile', () => {
    const { onRate } = renderCard({ entry: { goal: goal(), funding: MIXED } });
    expect(screen.getByText('Mixed currencies')).toBeTruthy();
    expect(screen.getByText('R$ 16.500,00')).toBeTruthy();
    expect(screen.getByText('Enter the USD → BRL rate to count every holding.')).toBeTruthy();
    expect(screen.queryByText(translator.text('goalManagement', 'estimate.note'))).toBeNull();
    const rate = screen.getByRole<HTMLInputElement>('textbox', { name: 'BRL per USD' });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(rate, '5.2');
    rate.setSelectionRange(3, 3);
    fireEvent.input(rate);
    expect(onRate).toHaveBeenLastCalledWith({ base: 'USD', quote: 'BRL' }, 52000);
  });

  it('blends a mixed goal into an estimate once its rate is typed (mockup 43)', () => {
    renderCard({ entry: { goal: goal(), funding: MIXED }, rates: { 'USD/BRL': 52000 } });
    expect(screen.getByText('61% · ≈ $2,344.92 to go')).toBeTruthy();
    expect(screen.getByText('≈ $3,173.08')).toBeTruthy();
    expect(screen.getByText(translator.text('goalManagement', 'estimate.note'))).toBeTruthy();
    expect(screen.queryByText(/Enter the USD → BRL rate/)).toBeNull();
  });

  it('shows the definition alone, saying so, when the progress read failed (OQ-195)', () => {
    renderCard({ entry: { goal: goal() }, progress: 'failed' });
    expect(screen.getByText('Progress unavailable')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('Funded by')).toBeNull();
  });

  it('shows nothing more while the progress read loads', () => {
    renderCard({ entry: { goal: goal() }, progress: 'loading' });
    expect(screen.queryByText('Progress unavailable')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('opening it', () => {
  it('opens its edit drawer from its one button, named by the goal', () => {
    const { onOpen } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Trip to Japan' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('is a plain card for whoever may not manage it', () => {
    renderCard({ onOpen: undefined });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Trip to Japan' }).disabled)
      .toBe(true);
  });

  it('lifts the rate field above the card, so typing in it never opens it', () => {
    const { onOpen, onRate } = renderCard({ entry: { goal: goal(), funding: MIXED } });
    const rate = screen.getByRole<HTMLInputElement>('textbox', { name: 'BRL per USD' });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(rate, '5');
    rate.setSelectionRange(1, 1);
    fireEvent.input(rate);
    fireEvent.click(rate);
    expect(onRate).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(rate.closest('.relative.z-10')).toBeTruthy();
  });

  it('shows a completed goal\'s progress in mint', () => {
    renderCard({ entry: { goal: goal({ completedAt: '2026-10-10T00:00:00Z' }), funding: SAME } });
    expect(screen.getByText('8% · $5,518.00 to go').className).toContain('text-mint');
  });
});

describe('dueTextOf in pt-BR', () => {
  it('spells the months out, never a bare "m"', () => {
    const ptBR = createTranslator('pt-BR');
    expect(dueTextOf({ kind: 'ahead', years: 1, months: 5 }, ptBR)).toBe('em 1 ano e 5 meses');
    expect(dueTextOf({ kind: 'ahead', years: 2, months: 1 }, ptBR)).toBe('em 2 anos e 1 mês');
    expect(dueTextOf({ kind: 'ahead', years: 1, months: 0 }, ptBR)).toBe('em 1 ano');
  });
});
