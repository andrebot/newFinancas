import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { MultiChoiceField } from '../../../../src/kit/choiceField/MultiChoiceField';
import { renderInLocale } from '../../../support/renderInLocale';

// The kit's chips-or-multi-select picker (BDT: kit → unit): chips while short,
// the multi-select past the limit.

const optionsOf = (count: number) => Array.from({ length: count }, (_, index) => ({
  value: `v${index}`, label: `Option ${index}`, tag: 'BRL', icon: 'home-outline' as const,
}));

const summary = (chosen: number, total: number) => `${chosen} of ${total}`;

describe('MultiChoiceField', () => {
  it('draws up to ten choices as checkbox chips', () => {
    const onChange = vi.fn();
    renderInLocale(
      <MultiChoiceField
        label="Account"
        options={optionsOf(10)}
        value={['v1']}
        onChange={onChange}
        summary={summary}
      />,
    );

    expect(screen.getAllByRole('checkbox')).toHaveLength(10);
    fireEvent.click(screen.getByText('Option 3'));
    expect(onChange).toHaveBeenCalledWith(['v1', 'v3']);
  });

  it('switches to the multi-select past ten, summing the choice up', () => {
    const onChange = vi.fn();
    renderInLocale(
      <MultiChoiceField
        label="Category"
        options={optionsOf(11)}
        value={['v1']}
        onChange={onChange}
        summary={summary}
        placeholder="All"
        search={{ label: 'Search', noResults: 'Nothing' }}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Category/ });
    expect(trigger.textContent).toContain('1 of 11');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('checkbox', { name: /Option 7/ }));
    expect(onChange).toHaveBeenCalledWith(['v1', 'v7']);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeDefined();
  });

  it('draws a choice without icon or tag plainly in the multi-select', () => {
    renderInLocale(
      <MultiChoiceField
        label="Category"
        options={optionsOf(11).map(({ value, label }) => ({ value, label }))}
        value={[]}
        onChange={vi.fn()}
        summary={summary}
        placeholder="All"
      />,
    );

    expect(screen.getByRole('button', { name: /Category/ }).textContent).toContain('All');
  });
});
