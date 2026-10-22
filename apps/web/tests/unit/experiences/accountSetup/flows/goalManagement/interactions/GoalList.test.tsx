import { fireEvent, screen } from '@testing-library/react';
import type { Goal } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  GoalList, type GoalListProps,
} from '../../../../../../../src/experiences/accountSetup/flows/goalManagement/interactions/GoalList';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The goal list (BDT: Interaction, unit): the real kit, cards and translator;
// only the Flow's handlers are stand-ins. It renders the status switch and the
// shown status's cards, and emits each card's opener with its goal.

/**
 * Builds a goal.
 *
 * @param id - Its id, also its name.
 * @param over - The fields to override.
 * @returns The goal.
 */
const goal = (id: string, over: Partial<Goal> = {}): Goal => ({
  id,
  householdId: 'doe',
  ownerUserId: 'jane',
  name: id,
  targetAmount: 1000,
  targetCurrency: 'BRL',
  dueDate: '2029-06-30',
  visibility: 'shared',
  createdAt: '2026-10-01T00:00:00Z',
  completedAt: null,
  ...over,
});

/**
 * Renders the list with stand-in handlers.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderList = (props: Partial<GoalListProps> = {}) => {
  const handlers = { onStatus: vi.fn(), onEdit: vi.fn(), onRate: vi.fn() };
  renderInLocale(
    <GoalList
      status="active"
      counts={{ active: 2, completed: 1 }}
      entries={[{ goal: goal('House') }, { goal: goal('Car', { ownerUserId: 'ben' }) }]}
      today="2026-10-22"
      rates={{}}
      progress="failed"
      isManageable={(item) => item.ownerUserId === 'jane'}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('the goal list', () => {
  it('shows the status switch with each count, and switches', () => {
    const { onStatus } = renderList();
    expect(screen.getByRole('radiogroup', { name: 'Goal status' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Active/ }).checked).toBe(true);
    expect(screen.getByText('2')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Completed/ }));
    expect(onStatus).toHaveBeenCalledWith('completed');
  });

  it('opens a card the actor may manage, and leaves the others plain', () => {
    const { onEdit } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'House' }));
    expect(onEdit).toHaveBeenCalledWith('House');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Car' }).disabled).toBe(true);
  });

  it.each([
    ['active', 'No active goals. Add one to start saving toward a target.'],
    ['completed', 'No completed goals yet.'],
  ] as const)('says when no %s goal is listed', (status, text) => {
    renderList({ status, entries: [] });
    expect(screen.getByText(text)).toBeTruthy();
  });
});
