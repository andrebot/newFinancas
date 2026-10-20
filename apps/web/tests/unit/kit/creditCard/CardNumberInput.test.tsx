import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { CardNumberInput } from '../../../../src/kit/creditCard/CardNumberInput';
import { inputClasses } from '../../../../src/kit/textField/TextField';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real text field and mask hook run.

/**
 * Finds the card number input by its accessible name.
 *
 * @returns The input.
 */
const numberInput = () => (
  screen.getByRole<HTMLInputElement>('textbox', { name: 'Número do cartão' })
);

/**
 * A caller holding the digits, as the add-card form will.
 *
 * @param props - The starting digits and a spy for the reported ones.
 * @returns The card number input.
 */
function Holder({ initial, onChange }: { initial: string; onChange: (digits: string) => void }) {
  const [digits, setDigits] = useState(initial);
  return (
    <CardNumberInput
      label="Número do cartão"
      value={digits}
      onChange={(next) => {
        setDigits(next);
        onChange(next);
      }}
    />
  );
}

describe('CardNumberInput', () => {
  it('shows the digits it is given grouped as their network writes them', () => {
    render(<CardNumberInput label="Número do cartão" value="378282246310005" onChange={vi.fn()} />);

    expect(numberInput().value).toBe('3782 822463 10005');
  });

  it('reports a pasted number as digits, and shows it grouped', () => {
    const onChange = vi.fn();
    render(<Holder initial="" onChange={onChange} />);

    fireEvent.change(numberInput(), { target: { value: '5502-0942-4242-4242' } });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('5502094242424242');
    expect(numberInput().value).toBe('5502 0942 4242 4242');
  });

  it('is a monospaced numeric field the browser can fill with a card number', () => {
    render(<CardNumberInput label="Número do cartão" value="" onChange={vi.fn()} hint="Dica" />);

    const input = numberInput();
    expect(input.className).toBe(inputClasses('font-mono tracking-wider tabular-nums'));
    expect(input.inputMode).toBe('numeric');
    expect(input.autocomplete).toBe('cc-number');
    expect(input.getAttribute('autocorrect')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(screen.getByText('Dica')).toBeDefined();
  });

  it('lets the caller override the native defaults', () => {
    render(
      <CardNumberInput label="Número do cartão" value="" onChange={vi.fn()} autoComplete="off" />,
    );

    expect(numberInput().autocomplete).toBe('off');
  });
});
