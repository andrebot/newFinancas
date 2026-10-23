import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  heroClasses, MoneyInput, prefixOf, type MoneyInputProps,
} from '../../../../src/kit/moneyInput/MoneyInput';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real text field, mask hook and `Intl` run.

/**
 * Finds the money input by its accessible name.
 *
 * @returns The input.
 */
const amountInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Valor' });

/**
 * Replaces the input's text and caret as the browser does mid-edit, then
 * fires the input event React reads.
 *
 * @param text - Its text after the edit.
 * @param caret - Where the caret ends up; the end by default.
 */
const typeTo = (text: string, caret = text.length) => {
  const input = amountInput();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(caret, caret);
  fireEvent.input(input);
};

/**
 * A caller holding the amount, as a form will.
 *
 * @param props - The money input's props, the starting amount as `value`.
 * @returns The money input.
 */
function Holder({ value: initial, onChange, ...rest }: MoneyInputProps) {
  const [amount, setAmount] = useState(initial);
  return (
    <MoneyInput
      {...rest}
      value={amount}
      onChange={(next) => {
        setAmount(next);
        onChange(next);
      }}
    />
  );
}

/**
 * Renders a held BRL money input.
 *
 * @param props - Props over the defaults: label `Valor`, BRL, empty.
 * @returns The change spy.
 */
const renderHolder = (props: Partial<MoneyInputProps> = {}) => {
  const onChange = vi.fn();
  render(<Holder label="Valor" currency="BRL" value={null} onChange={onChange} {...props} />);
  return onChange;
};

describe('prefixOf', () => {
  it('is the muted symbol when the amount has no direction', () => {
    expect(prefixOf('R$')).toEqual({ text: 'R$', tone: 'text-muted' });
  });

  it('signs and tones the symbol by direction', () => {
    expect(prefixOf('R$', 'out')).toEqual({ text: '−R$', tone: 'text-coral' });
    expect(prefixOf('$', 'in')).toEqual({ text: '+$', tone: 'text-mint' });
  });
});

describe('heroClasses', () => {
  it('draws the line border, mint on focus, or coral while invalid', () => {
    expect(heroClasses(false)).toContain('border-line focus-within:border-mint');
    expect(heroClasses(true)).toContain('border-coral focus-within:ring-coral/15');
  });

  it('lets its column, not its input, set its width', () => {
    expect(heroClasses(false).split(' ')).toContain('min-w-0');
  });
});

describe('MoneyInput', () => {
  it('shows minor units in the currency’s own conventions', () => {
    render(<MoneyInput label="Valor" currency="USD" value={324050} onChange={vi.fn()} />);

    expect(amountInput().value).toBe('3,240.50');
    expect(screen.getByText('$')).toBeDefined();
  });

  it('fills from the right as digits are typed, reporting minor units', () => {
    const onChange = renderHolder();

    typeTo('1');
    typeTo('0,012');
    typeTo('0,123');

    expect(onChange.mock.calls).toEqual([[1], [12], [123]]);
    expect(amountInput().value).toBe('1,23');
  });

  it('reports null once no digit but zeros is left, emptying the input', () => {
    const onChange = renderHolder({ value: 5 });

    typeTo('0,0');

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(amountInput().value).toBe('');
  });

  it('refuses a digit past the cap', () => {
    const onChange = renderHolder({ value: 1_234_567_890_123 });

    typeTo('12.345.678.901,234');

    expect(onChange).not.toHaveBeenCalled();
    expect(amountInput().value).toBe('12.345.678.901,23');
  });

  it('reports nothing when an edit leaves the amount as it was', () => {
    const onChange = renderHolder({ value: 123 });

    typeTo('1,23a');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('flips the sign on `-` only when negatives are allowed', () => {
    const onChange = renderHolder({ value: 1234, allowNegative: true });

    typeTo('12,34-');
    expect(amountInput().value).toBe('−12,34');
    typeTo('−12,34-');

    expect(onChange.mock.calls).toEqual([[-1234], [1234]]);
  });

  it('ignores `-` by default', () => {
    const onChange = renderHolder({ value: 1234 });

    typeTo('-12,34');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('is a numeric field with a zero placeholder the caller can override', () => {
    render(<MoneyInput label="Valor" currency="BRL" value={null} onChange={vi.fn()} hint="Dica" />);

    const input = amountInput();
    expect(input.inputMode).toBe('numeric');
    expect(input.autocomplete).toBe('off');
    expect(input.placeholder).toBe('0,00');
    expect(screen.getByText('Dica')).toBeDefined();
  });

  it('signs the field prefix by direction', () => {
    render(
      <MoneyInput label="Valor" currency="BRL" value={8690} onChange={vi.fn()} direction="out" />,
    );

    expect(screen.getByText('−R$').className).toContain('text-coral');
  });

  describe('hero', () => {
    it('labels the amount inside its panel, in display type', () => {
      render(
        <MoneyInput
          label="Valor"
          variant="hero"
          currency="BRL"
          value={8690}
          onChange={vi.fn()}
          direction="out"
          className="mt-2"
          placeholder="—"
        />,
      );

      const input = amountInput();
      expect(input.value).toBe('86,90');
      expect(input.className).toContain('type-display-lg');
      expect(input.placeholder).toBe('—');
      expect(input.closest('div.rounded-2xl')?.className).toContain('mt-2');
      expect(screen.getByText('−R$').className).toBe('type-heading-lg text-coral');
    });

    it('describes the amount by its message and turns invalid with an error', () => {
      render(
        <MoneyInput
          label="Valor"
          variant="hero"
          currency="BRL"
          value={null}
          onChange={vi.fn()}
          id="valor"
          aria-describedby="ajuda"
          error="Informe um valor."
        />,
      );

      const input = amountInput();
      expect(input.id).toBe('valor');
      expect(input.getAttribute('aria-describedby')).toBe('ajuda valor-message');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Informe um valor.')).toBeDefined();
    });

    it('takes typing like the field', () => {
      const onChange = renderHolder({ variant: 'hero' });

      typeTo('7');

      expect(onChange).toHaveBeenCalledExactlyOnceWith(7);
      expect(amountInput().value).toBe('0,07');
    });
  });
});
