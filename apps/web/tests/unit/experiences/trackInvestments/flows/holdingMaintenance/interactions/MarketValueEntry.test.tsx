import {
  fireEvent, screen, waitFor,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  MarketValueEntry, type MarketValueEntryProps,
} from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/MarketValueEntry';
import type { HistoryEntry } from '../../../../../../../src/kit/historyEditor/historyModel';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Market Value Entry (BDT: Interaction, unit; nothing mocked but the
// caller's handlers — K38, the inputs and the translator run for real).

const ENTRIES: HistoryEntry[] = [
  { key: 'aug', date: '2026-08-31', value: 11000000 },
  {
    key: 'buy', date: '2026-03-20', value: 3680000, lockedReason: 'From a trade',
  },
];

/**
 * Types into a field as the browser does, then fires the input event React reads.
 *
 * @param name - The field's label.
 * @param text - Its text after the edit.
 */
const typeInto = (name: string, text: string) => {
  const input = screen.getByRole<HTMLInputElement>('textbox', { name });
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

/**
 * Renders XPML11's card.
 *
 * @param over - Props to change.
 * @returns The handlers.
 */
const renderEntry = (over: Partial<MarketValueEntryProps> = {}) => {
  const props: MarketValueEntryProps = {
    ticker: 'XPML11',
    currency: 'BRL',
    entries: ENTRIES,
    today: '2026-09-30',
    readOnly: false,
    onSave: vi.fn().mockResolvedValue('done'),
    onOpenHistory: vi.fn(),
    ...over,
  };
  renderInLocale(<MarketValueEntry {...props} />);
  return props;
};

describe('MarketValueEntry', () => {
  it('shows the latest value, its date, the chart and the form', () => {
    renderEntry();

    expect(screen.getByText('editable')).toBeTruthy();
    expect(screen.getAllByText('R$ 110.000,00').length).toBeGreaterThan(0);
    expect(screen.getByText(/as of 08\/31\/2026/)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'XPML11: market value history' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'As of' }).value)
      .toBe('09/30/2026');
  });

  it('asks for the history drawer', () => {
    const props = renderEntry();

    fireEvent.click(screen.getByRole('button', { name: 'Edit history' }));

    expect(props.onOpenHistory).toHaveBeenCalled();
  });

  it('previews the change and saves the value, emptying the form once done', async () => {
    const props = renderEntry();

    typeInto('New value (R$)', '112.480,00');
    expect(screen.getByLabelText('Change against the current value').textContent)
      .toBe('+R$\u00A02.480,00(+2.3%)');
    fireEvent.click(screen.getByRole('button', { name: 'Save value' }));

    await waitFor(() => expect(props.onSave)
      .toHaveBeenCalledWith({ date: '2026-09-30', value: 11248000 }));
    await waitFor(() => expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'New value (R$)' }).value,
    ).toBe(''));
  });

  it('keeps what was typed when the save is refused or fails', async () => {
    const onSave = vi.fn().mockResolvedValueOnce('refused').mockRejectedValueOnce(new Error('x'));
    renderEntry({ onSave });

    typeInto('New value (R$)', '100.000,00');
    fireEvent.click(screen.getByRole('button', { name: 'Save value' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Save value' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'New value (R$)' }).value)
      .toBe('100.000,00');
    expect(screen.getByLabelText('Change against the current value').textContent)
      .toBe('−R$\u00A010.000,00(−9.1%)');
  });

  it('shows the problems instead of saving an empty or future value', () => {
    const props = renderEntry();

    typeInto('As of', '10/01/2026');
    fireEvent.click(screen.getByRole('button', { name: 'Save value' }));

    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Date is later than allowed.')).toBeTruthy();
    expect(screen.getAllByRole('textbox')
      .filter((input) => input.getAttribute('aria-invalid') === 'true')).toHaveLength(2);
  });

  it('gives the first value no percent, and an unchanged one no arrow', () => {
    const view = renderEntry({ entries: [] });

    expect(screen.getByText('No value recorded yet')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    typeInto('New value (R$)', '5,00');
    expect(screen.getByLabelText('Change against the current value').textContent)
      .toBe('+R$\u00A05,00');
    expect(view.onSave).not.toHaveBeenCalled();
  });

  it('draws an unchanged value muted', () => {
    renderEntry();

    typeInto('New value (R$)', '110.000,00');

    const change = screen.getByLabelText('Change against the current value');
    expect(change.className).toContain('text-muted');
    expect(change.querySelector('svg')).toBeNull();
  });

  it('reads only, with the caller\'s note', () => {
    renderEntry({ readOnly: true, readOnlyNote: 'Archived — the value history is read-only.' });

    expect(screen.getByText('read-only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save value' })).toBeNull();
    expect(screen.queryByText("Dashed ring = the value you're about to save")).toBeNull();
    expect(screen.getByText('Archived — the value history is read-only.')).toBeTruthy();
  });
});
