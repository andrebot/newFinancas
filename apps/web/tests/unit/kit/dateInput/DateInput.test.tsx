import type { Locale } from '@financas/i18n';
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { DateInput, type DateInputProps } from '../../../../src/kit/dateInput/DateInput';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real text field, mask hook, translator and
// `Intl` run.

/**
 * Finds the date input by its accessible name.
 *
 * @returns The input.
 */
const dateBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Data' });

/**
 * Replaces the input's text as the browser does when typing at the end,
 * then fires the input event React reads.
 *
 * @param text - Its text after the edit.
 */
const typeTo = (text: string) => {
  const input = dateBox();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

/**
 * A caller holding the date, as a form will.
 *
 * @param props - The date input's props, the starting date as `value`.
 * @returns The date input.
 */
function Holder({ value: initial, onChange, ...rest }: DateInputProps) {
  const [date, setDate] = useState(initial);
  return (
    <DateInput
      {...rest}
      value={date}
      onChange={(next) => {
        setDate(next);
        onChange(next);
      }}
    />
  );
}

/**
 * Renders a held date input.
 *
 * @param props - Props over the defaults: label `Data`, empty.
 * @param locale - The interface locale; pt-BR by default.
 * @returns The change spy.
 */
const renderHolder = (props: Partial<DateInputProps> = {}, locale: Locale = 'pt-BR') => {
  const onChange = vi.fn();
  renderInLocale(<Holder label="Data" value="" onChange={onChange} {...props} />, locale);
  return onChange;
};

describe('DateInput', () => {
  it('shows the date in the interface language’s order, on a numeric keypad', () => {
    renderInLocale(<DateInput label="Data" value="2026-09-14" onChange={vi.fn()} />, 'pt-BR');

    expect(dateBox().value).toBe('14/09/2026');
    expect(dateBox().inputMode).toBe('numeric');
    expect(dateBox().autocomplete).toBe('off');
  });

  it('adds the separators while typing and reports the date once complete', () => {
    const onChange = renderHolder();

    typeTo('14092026');

    expect(dateBox().value).toBe('14/09/2026');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-09-14');
  });

  it('reports the pieces typed so far while incomplete', () => {
    const onChange = renderHolder();

    typeTo('1');
    typeTo('14/0');

    expect(onChange.mock.calls).toEqual([['--1'], ['-0-14']]);
    expect(dateBox().value).toBe('14/0');
  });

  it('pads a single digit when `/` is typed after it', () => {
    const onChange = renderHolder();

    typeTo('1/');
    expect(dateBox().value).toBe('01');
    typeTo('01/9/');
    expect(dateBox().value).toBe('01/09');
    typeTo('01/09/2026');

    expect(onChange).toHaveBeenLastCalledWith('2026-09-01');
  });

  it('takes the month first in en-US', () => {
    const onChange = renderHolder({}, 'en-US');

    typeTo('09142026');

    expect(dateBox().value).toBe('09/14/2026');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-09-14');
  });

  it('reports nothing when an edit leaves the date as it was', () => {
    const onChange = renderHolder({ value: '2026-09-14' });

    typeTo('14/09/2026a');
    typeTo('14/09/20261');

    expect(onChange).not.toHaveBeenCalled();
    expect(dateBox().value).toBe('14/09/2026');
  });

  it('reports an empty date once the last digit is deleted', () => {
    const onChange = renderHolder({ value: '2026-09-14' });

    typeTo('');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
  });

  it('shows the caller’s date once it changes from outside', () => {
    const view = renderInLocale(
      <DateInput label="Data" value="2026-09-14" onChange={vi.fn()} />,
      'pt-BR',
    );

    view.rerenderInLocale(<DateInput label="Data" value="2027-01-02" onChange={vi.fn()} />);

    expect(dateBox().value).toBe('02/01/2027');
  });

  it('shows the format as the placeholder, unless the caller gives one', () => {
    renderInLocale(<DateInput label="Data" value="" onChange={vi.fn()} />, 'pt-BR');
    expect(dateBox().placeholder).toBe('dd/mm/aaaa');

    renderInLocale(
      <DateInput label="Vence" value="" placeholder="Opcional" onChange={vi.fn()} />,
      'pt-BR',
    );
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Vence' }).placeholder)
      .toBe('Opcional');
  });

  it('shows the en-US format as the placeholder', () => {
    renderInLocale(<DateInput label="Data" value="" onChange={vi.fn()} />, 'en-US');

    expect(dateBox().placeholder).toBe('mm/dd/yyyy');
  });
});
