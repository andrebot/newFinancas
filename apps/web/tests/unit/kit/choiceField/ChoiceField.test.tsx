import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { ChoiceField } from '../../../../src/kit/choiceField/ChoiceField';
import { renderInLocale } from '../../../support/renderInLocale';

// The kit's chips-or-select picker (BDT: kit → unit): chips while short, the
// select past the limit.

const optionsOf = (count: number) => Array.from({ length: count }, (_, index) => ({
  value: `v${index}`, label: `Option ${index}`, tag: 'BRL', icon: 'home-outline' as const,
}));

describe('ChoiceField', () => {
  it('draws up to ten choices as chips, with the note and error', () => {
    const onChange = vi.fn();
    renderInLocale(
      <ChoiceField
        label="Account"
        note="· optional"
        error="Choose one"
        options={optionsOf(10)}
        value={undefined}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(10);
    expect(screen.getByRole('group', { name: 'Account · optional' })).toBeDefined();
    expect(screen.getByText('Choose one')).toBeDefined();
    fireEvent.click(screen.getByText('Option 3'));
    expect(onChange).toHaveBeenCalledWith('v3');
  });

  it('switches to the select past ten, naming it with its note', () => {
    const onChange = vi.fn();
    renderInLocale(
      <ChoiceField
        label="Account"
        note="· optional"
        options={optionsOf(11)}
        value="v1"
        onChange={onChange}
      />,
    );

    expect(screen.queryByRole('radio')).toBeNull();
    const trigger = screen.getByRole('combobox', { name: 'Account · optional' });
    expect(trigger.textContent).toContain('Option 1');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: /Option 7/ }));
    expect(onChange).toHaveBeenCalledWith('v7');
  });

  it('names the select by its label alone without a note, nothing chosen', () => {
    renderInLocale(
      <ChoiceField
        label="Category"
        options={optionsOf(11).map(({ value, label }) => ({ value, label }))}
        value={undefined}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDefined();
  });
});

describe('ChoiceField\'s extras in the long list (review V9)', () => {
  it('draws an icon and a tag only on the option that has them', () => {
    const options = [
      {
        value: 'v0', label: 'Alpha', icon: 'home-outline' as const, tag: 'BRL',
      },
      { value: 'v1', label: 'Beta' },
      ...optionsOf(10).map(({ value, label }) => ({ value: `x${value}`, label })),
    ];
    renderInLocale(<ChoiceField label="Pick" options={options} value="xv5" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Pick' }));
    /**
     * Finds one option's row in the open list.
     *
     * @param name - The option's label.
     * @returns Its row.
     */
    const rowOf = (name: string) => screen.getByRole('option', { name: new RegExp(name) });
    expect(rowOf('Alpha').querySelectorAll('svg').length)
      .toBe(rowOf('Beta').querySelectorAll('svg').length + 1);
    expect(rowOf('Alpha').textContent).toContain('BRL');
    expect(rowOf('Beta').textContent).not.toContain('BRL');
  });
});
