import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  ChipCheckGroup, ChipChecks, toggleChip,
} from '../../../../src/kit/chipGroup/ChipChecks';
import { renderInLocale } from '../../../support/renderInLocale';

// The kit's multi-pick chips (BDT: kit → unit): native checkboxes, the choice
// the caller's, kept in the chips' order.

const OPTIONS = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'pix', label: 'Pix', icon: 'bolt' as const },
  { value: 'old', label: 'Old', tag: 'Archived' },
];

describe('toggleChip', () => {
  it('ticks and unticks, keeping the chips order', () => {
    expect(toggleChip(OPTIONS, ['old'], 'deposit', true)).toEqual(['deposit', 'old']);
    expect(toggleChip(OPTIONS, ['deposit', 'old'], 'deposit', false)).toEqual(['old']);
  });
});

describe('ChipChecks', () => {
  it('is no group of its own while nothing names it', () => {
    renderInLocale(<ChipChecks options={OPTIONS} value={[]} onChange={vi.fn()} />);

    expect(screen.queryByRole('group')).toBeNull();
  });

  it('draws a checkbox per chip, ticked as chosen, and reports a tick', () => {
    const onChange = vi.fn();
    renderInLocale(
      <ChipChecks label="Kinds" options={OPTIONS} value={['pix']} onChange={onChange} />,
    );

    const group = screen.getByRole('group', { name: 'Kinds' });
    expect(group).toBeDefined();
    const boxes = screen.getAllByRole<HTMLInputElement>('checkbox');
    expect(boxes.map((box) => box.checked)).toEqual([false, true, false]);
    expect(screen.getByRole('checkbox', { name: 'Old Archived' })).toBeDefined();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Deposit' }));
    expect(onChange).toHaveBeenCalledWith(['deposit', 'pix']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pix' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe('ChipCheckGroup', () => {
  it('names the group by its caption, shown or for screen readers only', () => {
    const { rerender } = renderInLocale(
      <ChipCheckGroup
        label="Category"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
        className="w-full"
      />,
    );

    expect(screen.getAllByRole('group', { name: 'Category' })).toHaveLength(1);
    expect(screen.getByText('Category').className).not.toContain('sr-only');

    rerender(
      <ChipCheckGroup
        label="Category"
        labelHidden
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Category').className).toContain('sr-only');
  });
});
