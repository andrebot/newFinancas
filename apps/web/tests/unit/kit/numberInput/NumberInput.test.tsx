import type { Locale } from '@financas/i18n';
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  compactClasses, NumberInput, type NumberInputProps,
} from '../../../../src/kit/numberInput/NumberInput';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real text field, mask hook, translator and
// `Intl` run.

/**
 * Finds the number input by its accessible name.
 *
 * @returns The input.
 */
const numberBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Taxa' });

/**
 * Replaces the input's text as the browser does when typing at the end,
 * then fires the input event React reads.
 *
 * @param text - Its text after the edit.
 */
const typeTo = (text: string) => {
  const input = numberBox();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

/**
 * A caller holding the number, as a form will.
 *
 * @param props - The number input's props, the starting number as `value`.
 * @returns The number input.
 */
function Holder({ value: initial, onChange, ...rest }: NumberInputProps) {
  const [number, setNumber] = useState(initial);
  return (
    <NumberInput
      {...rest}
      value={number}
      onChange={(next) => {
        setNumber(next);
        onChange(next);
      }}
    />
  );
}

/**
 * Renders a held rate input.
 *
 * @param props - Props over the defaults: label `Taxa`, a rate, empty.
 * @param locale - The interface locale; pt-BR by default.
 * @returns The change spy.
 */
const renderHolder = (props: Partial<NumberInputProps> = {}, locale: Locale = 'pt-BR') => {
  const onChange = vi.fn();
  renderInLocale(
    <Holder label="Taxa" kind="rate" value={null} onChange={onChange} {...props} />,
    locale,
  );
  return onChange;
};

describe('compactClasses', () => {
  it('draws the line border, mint on focus, or coral while invalid', () => {
    expect(compactClasses(false)).toContain('border-line focus:border-mint');
    expect(compactClasses(true)).toContain('border-coral focus:ring-coral/15');
  });
});

describe('NumberInput', () => {
  it('shows a rate in the interface language, with its % suffix', () => {
    renderInLocale(
      <NumberInput label="Taxa" kind="rate" value={102500} onChange={vi.fn()} />,
      'pt-BR',
    );

    expect(numberBox().value).toBe('10,25');
    expect(screen.getByText('%')).toBeDefined();
  });

  it('types the point with either key, keeping it until the next digit', () => {
    const onChange = renderHolder();

    typeTo('1');
    typeTo('10');
    typeTo('10.');
    expect(numberBox().value).toBe('10,');
    typeTo('10,5');

    expect(onChange.mock.calls).toEqual([[10000], [100000], [105000]]);
    expect(numberBox().value).toBe('10,5');
  });

  it('writes the point in en-US as `.`, even when `,` is typed', () => {
    const onChange = renderHolder({}, 'en-US');

    typeTo('0,5');

    expect(onChange).toHaveBeenCalledExactlyOnceWith(5000);
    expect(numberBox().value).toBe('0.5');
  });

  it('refuses a decimal past the kind’s scale', () => {
    const onChange = renderHolder({ value: 12345 });

    typeTo('1,23456');

    expect(onChange).not.toHaveBeenCalled();
    expect(numberBox().value).toBe('1,2345');
  });

  it('refuses a whole digit past the kind’s cap', () => {
    const onChange = renderHolder({ kind: 'percent', value: 100 });

    typeTo('1000');

    expect(onChange).not.toHaveBeenCalled();
    expect(numberBox().value).toBe('100');
  });

  it('reports null once the last digit is deleted', () => {
    const onChange = renderHolder({ value: 50000 });

    typeTo('');

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(numberBox().value).toBe('');
  });

  it('reports nothing when an edit leaves the number as it was', () => {
    const onChange = renderHolder({ value: 50000 });

    typeTo('5a');
    typeTo('05');

    expect(onChange).not.toHaveBeenCalled();
    expect(numberBox().value).toBe('5');
  });

  it('flips the sign on `-` only when negatives are allowed', () => {
    const onChange = renderHolder({ value: 31000, allowNegative: true });

    typeTo('3,1-');
    expect(numberBox().value).toBe('−3,1');
    typeTo('−3,1-');

    expect(onChange.mock.calls).toEqual([[-31000], [31000]]);
  });

  it('keeps a lone minus sign typed before the digits', () => {
    const onChange = renderHolder({ allowNegative: true });

    typeTo('-');
    expect(numberBox().value).toBe('−');
    typeTo('−2');

    expect(onChange).toHaveBeenCalledExactlyOnceWith(-20000);
  });

  it('shows the caller’s number once it changes from outside', () => {
    const view = renderInLocale(
      <NumberInput label="Taxa" kind="rate" value={100000} onChange={vi.fn()} />,
      'pt-BR',
    );

    view.rerenderInLocale(
      <NumberInput label="Taxa" kind="rate" value={null} onChange={vi.fn()} />,
    );

    expect(numberBox().value).toBe('');
  });

  it('takes a quantity in units × 10⁸, with no suffix and a decimal keypad', () => {
    const onChange = renderHolder({ kind: 'quantity' });

    typeTo('0,01');

    expect(onChange).toHaveBeenLastCalledWith(1000000);
    expect(numberBox().inputMode).toBe('decimal');
    expect(numberBox().autocomplete).toBe('off');
    expect(screen.queryByText('%')).toBeNull();
  });

  it('takes an exchange rate × 10,000, with no suffix (OQ-195)', () => {
    const onChange = renderHolder({ kind: 'exchange' });

    typeTo('5,2');

    expect(onChange).toHaveBeenLastCalledWith(52000);
    expect(numberBox().inputMode).toBe('decimal');
    expect(screen.queryByText('%')).toBeNull();
  });

  it('stops an exchange rate at four whole digits', () => {
    const onChange = renderHolder({ kind: 'exchange', value: 12340000 });

    typeTo('12345');

    expect(onChange).not.toHaveBeenCalled();
    expect(numberBox().value).toBe('1234');
  });

  it('takes a whole percent on a numeric keypad, ignoring separators', () => {
    const onChange = renderHolder({ kind: 'percent' });

    typeTo('6,');
    typeTo('60');

    expect(onChange.mock.calls).toEqual([[6], [60]]);
    expect(numberBox().inputMode).toBe('numeric');
  });

  describe('compact', () => {
    it('hides its label for screen readers and draws the small box', () => {
      renderInLocale(
        <NumberInput
          label="Taxa"
          kind="percent"
          size="compact"
          value={60}
          onChange={vi.fn()}
          className="ml-auto"
        />,
        'pt-BR',
      );

      const input = numberBox();
      expect(input.value).toBe('60');
      expect(input.className).toContain('w-14');
      expect(screen.getByText('Taxa').className).toBe('sr-only');
      expect(screen.getByText('%').className).toContain('type-body-sm');
      expect(input.closest('div')?.className).toContain('ml-auto');
    });

    it('describes the number by its message and turns invalid with an error', () => {
      renderInLocale(
        <NumberInput
          label="Taxa"
          kind="percent"
          size="compact"
          value={null}
          onChange={vi.fn()}
          id="taxa"
          aria-describedby="ajuda"
          error="Até 100%."
        />,
        'pt-BR',
      );

      const input = numberBox();
      expect(input.id).toBe('taxa');
      expect(input.getAttribute('aria-describedby')).toBe('ajuda taxa-message');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.className).toContain('border-coral');
    });

    it('takes typing like the field, with no suffix for a quantity', () => {
      const onChange = renderHolder({ kind: 'quantity', size: 'compact' });

      typeTo('2');

      expect(onChange).toHaveBeenCalledExactlyOnceWith(200000000);
      expect(screen.queryByText('%')).toBeNull();
    });
  });
});
