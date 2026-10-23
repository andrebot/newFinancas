import { fireEvent, screen } from '@testing-library/react';
import type { Budget, Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  BudgetList, type BudgetListProps,
} from '../../../../../../../src/experiences/accountSetup/flows/budgetManagement/interactions/BudgetList';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The budget cards (BDT: Interaction, unit — the Flow's handlers mocked; the
// kit and the translator real). Definitions only: no spend (OQ-176).

const DINING: Category = {
  id: 'dining',
  householdId: 'doe',
  name: 'Dining',
  icon: 'restaurant',
  color: 'sun',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [{
    id: 'streaming',
    categoryId: 'dining',
    name: 'Streaming',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
  }],
};
const SHOPPING: Category = {
  ...DINING, id: 'shopping', name: 'Shopping', subcategories: [],
};

const FUN: Budget = {
  id: 'fun',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Fun Money',
  targetAmount: 30000,
  currency: 'USD',
  visibility: 'personal',
  targets: [{ categoryId: 'shopping' }, { subcategoryId: 'streaming' }],
  createdAt: '2026-10-01T00:00:00Z',
};
const HOME: Budget = {
  ...FUN, id: 'home', name: 'Home', visibility: 'shared', currency: 'BRL', targetAmount: 400000,
};

/**
 * Renders the list with its handlers spied.
 *
 * @param over - The props over the defaults.
 * @returns The handlers.
 */
const renderList = (over: Partial<BudgetListProps> = {}) => {
  const handlers = { onEdit: vi.fn() };
  renderInLocale(
    <BudgetList
      budgets={[FUN, HOME]}
      categories={[DINING, SHOPPING]}
      isManageable={(budget) => budget.id === 'fun'}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
};

describe('BudgetList', () => {
  it('says there are none yet', () => {
    renderList({ budgets: [] });
    expect(screen.getByText('No budgets yet. Add one to set a monthly target for some categories.'))
      .toBeTruthy();
  });

  it('shows each budget: its tags, its monthly target and what it covers', () => {
    renderList();
    expect(screen.getByText('Fun Money')).toBeTruthy();
    expect(screen.getByText('$300.00')).toBeTruthy();
    expect(screen.getAllByText('/ month')).toHaveLength(2);
    expect(screen.getByText('Personal')).toBeTruthy();
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getAllByText('Dining › Streaming')).toHaveLength(2);
  });

  it('opens what the actor may manage from its card, its one button (OQ-194)', () => {
    const { onEdit } = renderList();
    const opener = screen.getByRole('button', { name: 'Fun Money' });
    fireEvent.click(opener);
    expect(onEdit).toHaveBeenCalledWith('fun');
    expect(opener.className).toContain('after:inset-0');
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('leaves what the actor may not manage a plain card', () => {
    const { onEdit } = renderList();
    const plain = screen.getByRole<HTMLButtonElement>('button', { name: 'Home' });
    expect(plain.disabled).toBe(true);
    fireEvent.click(plain);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
