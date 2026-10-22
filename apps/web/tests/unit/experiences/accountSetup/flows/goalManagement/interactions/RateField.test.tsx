import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { RateField } from '../../../../../../../src/experiences/accountSetup/flows/goalManagement/interactions/RateField';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The exchange-rate calculator (BDT: Interaction, unit): the real kit and
// translator; only the Flow's handler is a stand-in. It shows "1 USD = … BRL"
// and emits the typed rate up — nothing is sent (FR-9.1).

const PAIR = { base: 'USD', quote: 'BRL' } as const;

/**
 * Types into the rate as a user would: the whole new text, caret at the end.
 *
 * @param text - Its text after the edit.
 */
const typeRate = (text: string) => {
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'BRL per USD' });
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

describe('the rate field', () => {
  it('reads "1 USD = … BRL", only for this view, with the rate typed so far', () => {
    renderInLocale(<RateField pair={PAIR} value={52000} onChange={vi.fn()} />);
    expect(screen.getByText('1 USD =')).toBeTruthy();
    expect(screen.getByText('BRL')).toBeTruthy();
    expect(screen.getByText('only for this view')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'BRL per USD' }).value)
      .toBe('5.2');
  });

  it('emits the rate × 10,000', () => {
    const onChange = vi.fn();
    renderInLocale(<RateField pair={PAIR} value={null} onChange={onChange} />);
    typeRate('5.25');
    expect(onChange).toHaveBeenLastCalledWith(52500);
  });

  it('emits null once the rate is cleared', () => {
    const onChange = vi.fn();
    renderInLocale(<RateField pair={PAIR} value={52000} onChange={onChange} />);
    typeRate('');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
