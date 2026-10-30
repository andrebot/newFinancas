import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  GoalAllocationEntry, type GoalAllocationEntryProps,
} from '../../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/GoalAllocationEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Goal Allocation Entry (BDT: Interaction → unit): the allocation editor
// under mockup 32's heading, for each read state; the real kit and catalog.

const GOALS = [{ id: 'house', name: 'House' }, { id: 'laptop', name: 'Laptop' }];
const ROWS = [{ goalId: 'house', name: 'House', percent: 60 }];

/**
 * Renders the entry with defaults.
 *
 * @param over - The props to change.
 * @returns The handlers.
 */
const renderEntry = (over: Partial<GoalAllocationEntryProps> = {}) => {
  const props: GoalAllocationEntryProps = {
    source: 'purchase',
    rows: ROWS,
    goals: GOALS,
    showErrors: false,
    onChange: vi.fn(),
    onRetry: vi.fn(),
    ...over,
  };
  const view = renderInLocale(<GoalAllocationEntry {...props} />);
  return { props, view };
};

describe('GoalAllocationEntry', () => {
  it('frames a purchase\'s split with its heading and note, and emits changes', () => {
    const { props } = renderEntry({ error: 'Each goal needs at least 1%.' });

    expect(screen.getByText('Assign to Goals')).toBeDefined();
    expect(screen.getByText(/How much of this purchase counts/)).toBeDefined();
    expect(screen.getByText(/Each goal needs at least 1%/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add goal · Laptop' }));
    expect(props.onChange)
      .toHaveBeenCalledWith([...ROWS, { goalId: 'laptop', name: 'Laptop', percent: null }]);
  });

  it('notes a Holding\'s split as it stands', () => {
    renderEntry({ source: 'holding', load: { status: 'loaded', data: null } });

    expect(screen.getByText(/This Holding's split as it stands/)).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Percentage for House' })).toBeDefined();
  });

  it('holds a placeholder while the split is read', () => {
    renderEntry({
      source: 'holding', rows: [], goals: [], load: { status: 'loading' },
    });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Assign to Goals')).toBeDefined();
  });

  it('offers Try again after a failed read', () => {
    const { props } = renderEntry({
      source: 'holding', load: { status: 'failed', error: { code: 'x' } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText(/Left alone, it stays as it is/)).toBeDefined();
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('shows nothing when no Goal could take a share', () => {
    const { view } = renderEntry({ rows: [], goals: [] });

    expect(view.container.textContent).toBe('');
  });

  it('still offers Try again after a failed read when no Goal could take a share', () => {
    renderEntry({
      rows: [], goals: [], source: 'holding', load: { status: 'failed', error: { code: 'x' } },
    });

    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });
});
