import { fireEvent, screen } from '@testing-library/react';
import type { Budget, Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  BudgetList, coverChipsOf, type BudgetListProps,
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
  const handlers = {
    onEdit: vi.fn(), onDeleteRequest: vi.fn(), onConfirmDelete: vi.fn(), onCancelDelete: vi.fn(),
  };
  renderInLocale(
    <BudgetList
      budgets={[FUN, HOME]}
      categories={[DINING, SHOPPING]}
      isManageable={(budget) => budget.id === 'fun'}
      busy={false}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
};

describe('coverChipsOf', () => {
  it('names each target, a subcategory under its category, with its category\'s look', () => {
    expect(coverChipsOf(FUN.targets, [DINING, SHOPPING])).toEqual([
      { key: 'shopping', name: 'Shopping', category: SHOPPING },
      { key: 'streaming', name: 'Dining › Streaming', category: DINING },
    ]);
  });

  it('leaves out a target it can\'t find', () => {
    expect(coverChipsOf([{ categoryId: 'gone' }, { subcategoryId: 'gone' }], [DINING])).toEqual([]);
  });
});

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

  it('offers Edit and Delete only on what the actor may manage', () => {
    const { onEdit, onDeleteRequest } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Fun Money' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Fun Money' }));
    expect(onEdit).toHaveBeenCalledWith('fun');
    expect(onDeleteRequest).toHaveBeenCalledWith('fun');
    expect(screen.queryByRole('button', { name: 'Edit Home' })).toBeNull();
  });

  it('waits while a request is out', () => {
    renderList({ busy: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Edit Fun Money' }).disabled)
      .toBe(true);
  });

  it('shows the open delete confirm in place of its card', () => {
    const { onConfirmDelete, onCancelDelete } = renderList({ deleting: 'fun' });
    expect(screen.getByText(/Delete Fun Money\? Its categories become free/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirmDelete).toHaveBeenCalled();
    expect(onCancelDelete).toHaveBeenCalled();
  });

  it('spins only the confirm whose delete is out', () => {
    renderList({ deleting: 'fun', busy: true, deletingOut: 'fun' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm.getAttribute('aria-busy')).toBe('true');
  });

  it('holds an open confirm while another request is out', () => {
    renderList({ deleting: 'fun', busy: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Delete' }).disabled).toBe(true);
  });
});
