import type { HoldingAllocation } from '@financas/api-types';
import {
  fireEvent, screen, waitFor,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { HoldingGoal } from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/holdingMaintenance';
import {
  GoalAllocationCard, type GoalAllocationCardProps,
} from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/GoalAllocationCard';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Goal Allocation Editor (BDT: Interaction, unit; nothing mocked but the
// caller's save — K47 and the translator run for real).

const GOALS: HoldingGoal[] = [
  {
    id: 'house', name: 'House Down Payment', progress: 40, completed: false,
  },
  {
    id: 'trip', name: 'Trip', progress: 100, completed: true,
  },
];
const SPLIT: HoldingAllocation[] = [{ goalId: 'house', percentage: 45 }];

/**
 * Types a share's percent.
 *
 * @param goal - The Goal's name.
 * @param text - The text typed.
 */
const typePercent = (goal: string, text: string) => {
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: `Percentage for ${goal}` });
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

/**
 * Renders the card on a split.
 *
 * @param over - Props to change.
 * @returns The props and the render result.
 */
const renderCard = (over: Partial<GoalAllocationCardProps> = {}) => {
  const props: GoalAllocationCardProps = {
    read: { status: 'ready', data: SPLIT },
    goals: GOALS,
    readOnly: false,
    onSave: vi.fn().mockResolvedValue('done'),
    ...over,
  };
  const view = renderInLocale(<GoalAllocationCard {...props} />);
  return { props, view };
};

/**
 * Finds House Down Payment's percent box.
 *
 * @returns The box.
 */
const houseBox = () => screen.getByRole<HTMLInputElement>(
  'textbox',
  { name: 'Percentage for House Down Payment' },
);

/**
 * Finds a button by its name.
 *
 * @param name - Its name.
 * @returns The button.
 */
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

describe('GoalAllocationCard', () => {
  it('edits the split, Reset and Save waking only once it changed', () => {
    renderCard();

    expect(screen.getByText('editable')).toBeTruthy();
    expect(button('Save').disabled).toBe(true);
    expect(button('Reset').disabled).toBe(true);

    typePercent('House Down Payment', '50');

    expect(button('Save').disabled).toBe(false);
    fireEvent.click(button('Reset'));
    expect(houseBox().value)
      .toBe('45');
  });

  it('saves the whole split and keeps it until the new read arrives', async () => {
    const { props, view } = renderCard();

    typePercent('House Down Payment', '60');
    fireEvent.click(button('Save'));

    await waitFor(() => expect(props.onSave)
      .toHaveBeenCalledWith([{ goalId: 'house', percentage: 60 }]));
    expect(houseBox().value)
      .toBe('60');

    // Saved but not yet refetched: Save waits, so it can't be sent twice (review round 1).
    await waitFor(() => expect(button('Save').getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(button('Save'));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(button('Reset').disabled).toBe(true);

    view.rerenderInLocale(
      <GoalAllocationCard
        {...props}
        read={{ status: 'ready', data: [{ goalId: 'house', percentage: 60 }] }}
      />,
    );
    expect(button('Save').disabled).toBe(true);
    expect(button('Save').getAttribute('aria-busy')).not.toBe('true');
  });

  it('shows the problems instead of saving an empty share, and keeps a refused edit', async () => {
    const onSave = vi.fn().mockResolvedValueOnce('refused').mockRejectedValueOnce(new Error('x'));
    renderCard({ onSave });

    typePercent('House Down Payment', '');
    fireEvent.click(button('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Percentage for House Down Payment' })
      .getAttribute('aria-invalid')).toBe('true');

    typePercent('House Down Payment', '30');
    fireEvent.click(button('Save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    fireEvent.click(button('Save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(button('Save').disabled).toBe(false);
  });

  it('lists the shares when read-only, a hidden Goal\'s left out', () => {
    renderCard({
      readOnly: true,
      read: {
        status: 'ready',
        data: [...SPLIT, { goalId: 'hidden', percentage: 10 }, { goalId: 'trip', percentage: 5 }],
      },
    });

    expect(screen.getByText('read-only')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(['House Down Payment45%', 'Trip5%']);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('reads an empty share as none', () => {
    const blank = { goalId: 'house' } as HoldingAllocation;
    renderCard({ readOnly: true, read: { status: 'ready', data: [blank] } });

    expect(screen.getByRole('listitem').textContent).toBe('House Down Payment0%');
  });

  it('says a read-only Holding counts toward no goal (review round 1)', () => {
    renderCard({ readOnly: true, read: { status: 'ready', data: [] } });

    expect(screen.getByText("Doesn't count toward any goal.")).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('says there is nothing to fund without Goals or shares', () => {
    renderCard({ goals: [], read: { status: 'ready', data: [] } });

    expect(screen.getByText('No goals to fund yet — add one in Goals.')).toBeTruthy();
  });

  it('shows placeholders while loading, and a failure with Try again', () => {
    const retry = vi.fn();
    const { props, view } = renderCard({ read: { status: 'loading' } });
    expect(screen.getByRole('status', { name: 'Loading the goal split' })).toBeTruthy();

    view.rerenderInLocale(<GoalAllocationCard {...props} read={{ status: 'failed', retry }} />);
    fireEvent.click(button('Try again'));

    expect(retry).toHaveBeenCalled();
  });
});
