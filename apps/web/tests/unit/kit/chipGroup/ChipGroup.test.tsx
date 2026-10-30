import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { ChipGroup, ChipRadios, type Chip } from '../../../../src/kit/chipGroup/ChipGroup';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real Icon and Tag draw the extras.

type AccountId = 'itau' | 'checking';

const ACCOUNTS: readonly Chip<AccountId>[] = [
  {
    value: 'itau', label: 'Itaú Conta', tag: 'BRL', icon: 'payments-outline',
  },
  { value: 'checking', label: 'Main Checking', tag: 'USD' },
];

describe('ChipRadios', () => {
  it('is a radio group, one radio per chip, named when asked', () => {
    render(<ChipRadios label="Conta" options={ACCOUNTS} value="itau" onChange={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(screen.getByRole('radiogroup', { name: 'Conta' })).toBeDefined();
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['itau', 'checking']);
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1);
  });

  it('draws the tag after the name', () => {
    render(<ChipRadios options={ACCOUNTS} value="itau" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Itaú Conta BRL' })).toBeDefined();
  });

  it('checks nothing while no value is chosen', () => {
    render(<ChipRadios options={ACCOUNTS} value={undefined} onChange={vi.fn()} />);

    expect(screen.getAllByRole<HTMLInputElement>('radio').some((radio) => radio.checked))
      .toBe(false);
  });

  it('reports the picked value and leaves the choice to the caller', () => {
    const onChange = vi.fn();
    render(<ChipRadios options={ACCOUNTS} value="itau" onChange={onChange} />);

    fireEvent.click(screen.getByText('Main Checking'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('checking');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Itaú Conta BRL' }).checked)
      .toBe(true);
  });
});

describe('ChipGroup', () => {
  it('names the chips by its caption, with the note after it', () => {
    render(
      <ChipGroup
        label="Categoria"
        note="· opcional"
        options={ACCOUNTS}
        value={undefined}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Categoria · opcional' })).toBeDefined();
    expect(screen.getByRole('radiogroup', { name: 'Categoria · opcional' })).toBeDefined();
    expect(screen.getByText('Categoria').className).toContain('text-muted');
  });

  it('keeps a hidden caption for screen readers only', () => {
    render(
      <ChipGroup
        label="Conta"
        labelHidden
        options={ACCOUNTS}
        value="itau"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Conta').className).toBe('sr-only');
  });

  it('describes each chip by its hint', () => {
    render(
      <ChipGroup
        label="Conta"
        hint="A moeda segue a conta"
        options={ACCOUNTS}
        value="itau"
        onChange={vi.fn()}
      />,
    );

    const hint = screen.getByText('A moeda segue a conta');
    screen.getAllByRole('radio').forEach((radio) => {
      expect(radio.getAttribute('aria-describedby')).toBe(hint.id);
      expect(radio.getAttribute('aria-invalid')).toBeNull();
    });
  });

  it('shows the error in the hint\'s place and marks the first chip invalid', () => {
    render(
      <ChipGroup
        label="Conta"
        hint="A moeda segue a conta"
        error="Escolha uma conta"
        options={ACCOUNTS}
        value={undefined}
        onChange={vi.fn()}
      />,
    );

    const [first, second] = screen.getAllByRole('radio');
    expect(screen.queryByText('A moeda segue a conta')).toBeNull();
    expect(first!.getAttribute('aria-invalid')).toBe('true');
    expect(second!.getAttribute('aria-invalid')).toBeNull();
    expect(first!.getAttribute('aria-describedby')).toBe(screen.getByText('Escolha uma conta').id);
  });

  it('describes nothing without a hint or an error', () => {
    render(
      <ChipGroup
        label="Conta"
        options={ACCOUNTS}
        value="itau"
        onChange={vi.fn()}
        className="w-full"
      />,
    );

    expect(screen.getAllByRole('radio')[0]!.getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByRole('group').className).toContain('w-full');
  });
});
