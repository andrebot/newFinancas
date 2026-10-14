import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  OPTION_CARD_STYLES,
  OptionCardGroup,
  type OptionCard,
} from '../../../../src/kit/optionCard/OptionCardGroup';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real Icon draws the glyphs.

type AccountType = 'checking' | 'savings';

const TYPES: readonly OptionCard<AccountType>[] = [
  {
    value: 'checking',
    label: 'Conta corrente',
    description: 'Conta do dia a dia',
    icon: 'account-balance-outline',
  },
  { value: 'savings', label: 'Poupança' },
];

/**
 * Finds a radio by its accessible name.
 *
 * @param name - The radio's accessible name.
 * @returns The radio input.
 */
const radioNamed = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name });

describe('OptionCardGroup', () => {
  it('is a radio group named by its label, one radio per option', () => {
    render(<OptionCardGroup label="Tipo" options={TYPES} value="savings" onChange={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(screen.getByRole('radiogroup', { name: 'Tipo' })).toBeDefined();
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['checking', 'savings']);
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1);
  });

  it('names each radio by its title and describes it by its description', () => {
    render(<OptionCardGroup label="Tipo" options={TYPES} value="savings" onChange={vi.fn()} />);

    const checking = radioNamed('Conta corrente');
    expect(screen.getByRole('radio', { description: 'Conta do dia a dia' })).toBe(checking);
    expect(radioNamed('Poupança').hasAttribute('aria-describedby')).toBe(false);
  });

  it('checks only the selected value', () => {
    render(<OptionCardGroup label="Tipo" options={TYPES} value="savings" onChange={vi.fn()} />);

    expect(radioNamed('Poupança').checked).toBe(true);
    expect(radioNamed('Conta corrente').checked).toBe(false);
  });

  it('reports the picked value and leaves the selection to the caller', () => {
    const onChange = vi.fn();
    render(<OptionCardGroup label="Tipo" options={TYPES} value="savings" onChange={onChange} />);

    fireEvent.click(screen.getByText('Conta do dia a dia'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('checking');
    expect(radioNamed('Poupança').checked).toBe(true);
  });

  it('gives separate groups separate radio names', () => {
    render(
      <>
        <OptionCardGroup label="A" options={TYPES} value="savings" onChange={vi.fn()} />
        <OptionCardGroup label="B" options={TYPES} value="savings" onChange={vi.fn()} />
      </>,
    );
    const [first, second] = screen.getAllByRole('radiogroup');

    expect(first!.querySelector('input')!.name).not.toBe(second!.querySelector('input')!.name);
  });

  it('draws list rows by default: icon chip, texts and a decorative radio dot', () => {
    render(<OptionCardGroup label="Tipo" options={TYPES} value="savings" onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup');
    const [checking, savings] = screen.getAllByRole('radio')
      .map((input) => input.closest('label')!);

    expect(group.className).toBe(OPTION_CARD_STYLES.list.group);
    expect(checking!.className).toBe(OPTION_CARD_STYLES.list.card);
    expect(checking!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(checking!.lastElementChild!.getAttribute('aria-hidden')).toBe('true');
    expect(savings!.querySelector('svg')).toBeNull();
    expect(savings!.textContent).toBe('Poupança');
  });

  it('draws tiles with the icon on top when there is no preview', () => {
    render(
      <OptionCardGroup
        label="Tipo"
        options={TYPES}
        value="savings"
        onChange={vi.fn()}
        layout="tiles"
      />,
    );
    const checking = radioNamed('Conta corrente').closest('label')!;

    expect(screen.getByRole('radiogroup').className).toBe(OPTION_CARD_STYLES.tiles.group);
    expect(checking.className).toBe(OPTION_CARD_STYLES.tiles.card);
    expect(checking.children[1]!.tagName.toLowerCase()).toBe('svg');
    expect(checking.textContent).toBe('Conta correnteConta do dia a dia');
  });

  it('draws a tile’s preview on top, hidden, with the icon before the title', () => {
    const themes: readonly OptionCard<'dark' | 'light'>[] = [
      {
        value: 'dark',
        label: 'Escuro',
        icon: 'dark-mode-outline',
        preview: <span data-testid="thumb" />,
      },
      { value: 'light', label: 'Claro', preview: <span /> },
    ];
    render(
      <OptionCardGroup
        label="Tema"
        options={themes}
        value="dark"
        onChange={vi.fn()}
        layout="tiles"
      />,
    );
    const dark = radioNamed('Escuro').closest('label')!;
    const light = radioNamed('Claro').closest('label')!;

    expect(screen.getByTestId('thumb').parentElement!.getAttribute('aria-hidden')).toBe('true');
    expect(dark.children[1]!.contains(screen.getByTestId('thumb'))).toBe(true);
    expect(dark.children[2]!.querySelector('svg')).not.toBeNull();
    expect(light.querySelector('svg')).toBeNull();
  });
});
