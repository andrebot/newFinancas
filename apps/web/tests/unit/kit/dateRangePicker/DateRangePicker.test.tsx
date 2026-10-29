import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  DateRangePicker, type DateRangePickerProps,
} from '../../../../src/kit/dateRangePicker/DateRangePicker';
import type { DateRangeValue } from '../../../../src/kit/dateRangePicker/dateRangePresets';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real date inputs, translator and today run, the
// clock fixed to 29 Oct 2026.

const LAST_90: DateRangeValue = { preset: 'last90Days', from: '2026-08-01', to: '2026-10-29' };

/**
 * A caller holding the range, as a filter or dialog will.
 *
 * @param props - The picker's props, the starting range as `value`.
 * @returns The picker.
 */
function Holder({ value: initial, onChange, ...rest }: DateRangePickerProps) {
  const [range, setRange] = useState(initial);
  return (
    <DateRangePicker
      {...rest}
      value={range}
      onChange={(next) => {
        setRange(next);
        onChange(next);
      }}
    />
  );
}

/**
 * Renders a held picker in en-US.
 *
 * @param props - Props over the defaults: every relative preset, Last 90 days.
 * @returns The change spy.
 */
const renderHolder = (props: Partial<DateRangePickerProps> = {}) => {
  const onChange = vi.fn();
  renderInLocale(
    <Holder
      label="Date range"
      presets={['anyTime', 'thisMonth', 'last30Days', 'last90Days', 'thisYear']}
      value={LAST_90}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
};

/**
 * Finds a date input by its label.
 *
 * @param name - `From` or `To`.
 * @returns The input.
 */
const dateBox = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name });

/**
 * Replaces a date input's text as the browser does when typing at the end.
 *
 * @param input - The input.
 * @param text - Its text after the edit.
 */
const typeTo = (input: HTMLInputElement, text: string) => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

/**
 * Finds a preset's radio by its chip's text.
 *
 * @param name - The chip's text.
 * @returns The radio.
 */
const radioNamed = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name });

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers the given presets, then Custom, named by the group', () => {
    renderHolder({ presets: ['last30Days', 'thisYear'] });

    const group = screen.getByRole('radiogroup', { name: 'Date range' });
    const chips = screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent);

    expect(group).toBeDefined();
    expect(chips).toEqual(['Last 30 days', 'This year', 'Custom']);
    expect(screen.getByRole('group', { name: 'Date range' })).toBeDefined();
  });

  it('marks the chosen preset and shows its dates', () => {
    renderHolder();

    expect(radioNamed('Last 90 days').checked).toBe(true);
    expect(dateBox('From').value).toBe('08/01/2026');
    expect(dateBox('To').value).toBe('10/29/2026');
  });

  it('fills both dates from a relative preset, ending today', () => {
    const onChange = renderHolder();

    fireEvent.click(screen.getByRole('radio', { name: 'This month' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      { preset: 'thisMonth', from: '2026-10-01', to: '2026-10-29' },
    );
    expect(dateBox('From').value).toBe('10/01/2026');
  });

  it('empties both dates on Any time', () => {
    const onChange = renderHolder();

    fireEvent.click(screen.getByRole('radio', { name: 'Any time' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ preset: 'anyTime', from: '', to: '' });
    expect(dateBox('From').value).toBe('');
    expect(dateBox('To').value).toBe('');
  });

  it('keeps the dates when Custom is chosen', () => {
    const onChange = renderHolder();

    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...LAST_90, preset: 'custom' });
    expect(radioNamed('Custom').checked).toBe(true);
  });

  it('switches to Custom when a date is typed', () => {
    const onChange = renderHolder();

    typeTo(dateBox('To'), '09/30/2026');

    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      { preset: 'custom', from: '2026-08-01', to: '2026-09-30' },
    );
    expect(radioNamed('Custom').checked).toBe(true);
  });

  it('edits From on its own', () => {
    const onChange = renderHolder();

    typeTo(dateBox('From'), '07/03/2026');

    expect(onChange).toHaveBeenLastCalledWith(
      { preset: 'custom', from: '2026-07-03', to: '2026-10-29' },
    );
  });

  it('shows the errors it is given under each date', () => {
    renderHolder({
      errors: { from: 'Enter a valid date.', to: "Can't be before the start date." },
    });

    const described = (input: HTMLInputElement) => document
      .getElementById(input.getAttribute('aria-describedby')!)?.textContent;

    expect(described(dateBox('From'))).toBe('Enter a valid date.');
    expect(described(dateBox('To'))).toBe("Can't be before the start date.");
    expect(dateBox('To').getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps the name for screen readers only when hidden', () => {
    renderHolder({ labelHidden: true, className: 'w-full' });

    expect(screen.getByText('Date range').className).toBe('sr-only');
    const group = screen.getByRole('group', { name: 'Date range' });

    expect(group.classList.contains('w-full')).toBe(true);
  });

  it('shows the visible name as a field caption', () => {
    renderHolder();

    expect(screen.getByText('Date range').classList.contains('sr-only')).toBe(false);
  });

  it('speaks pt-BR', () => {
    renderInLocale(
      <DateRangePicker
        label="Período"
        presets={['last30Days']}
        value={LAST_90}
        onChange={vi.fn()}
      />,
      'pt-BR',
    );

    expect(radioNamed('Últimos 30 dias')).toBeDefined();
    expect(radioNamed('Personalizado')).toBeDefined();
    expect(dateBox('De').value).toBe('01/08/2026');
    expect(dateBox('Até').value).toBe('29/10/2026');
  });
});
