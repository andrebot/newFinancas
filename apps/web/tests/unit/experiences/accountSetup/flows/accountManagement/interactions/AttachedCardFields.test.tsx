import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { CardSlot } from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/accountManagementState';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import {
  AttachedCardFields,
} from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/AttachedCardFields';

// An attached card's edit fields (BDT: unit): the real kit and translator;
// only the caller's change handler is a stand-in. The number itself never
// appears — an attached card edits field by field (NFR-SEC-7).

const SLOT: CardSlot = {
  id: 'card-1',
  network: 'visa',
  last4: '1234',
  closingDay: 10,
  dueDay: 20,
  expirationMonth: 8,
  expirationYear: 2030,
};

/**
 * Opens a combobox and picks an option from it.
 *
 * @param name - The combobox's label.
 * @param option - The option to pick, by its text.
 */
const pick = async (name: string, option: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('combobox', { name }));
  });
  fireEvent.click(screen.getByRole('option', { name: option }));
};

describe('AttachedCardFields', () => {
  it('shows the card’s fields as they stand, and no number field', () => {
    const onChange = vi.fn();
    renderInLocale(<AttachedCardFields slot={SLOT} onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Network' }).textContent).toBe('Visa');
    const last4 = screen.getByRole<HTMLInputElement>('textbox', { name: 'Last four digits' });
    expect(last4.value).toBe('1234');
    expect(screen.getByRole('combobox', { name: 'Closing day' }).textContent).toBe('10');
    expect(screen.getByRole('combobox', { name: 'Due day' }).textContent).toBe('20');
    expect(screen.getByRole('combobox', { name: 'Expires month' }).textContent).toBe('8');
    expect(screen.getByRole('combobox', { name: 'Expires year' }).textContent).toBe('2030');
    expect(screen.queryByRole('textbox', { name: 'Card number' })).toBeNull();
  });

  it('reports a changed network and last four digits, digits only', async () => {
    const onChange = vi.fn();
    renderInLocale(<AttachedCardFields slot={SLOT} onChange={onChange} />);
    await pick('Network', 'Elo');
    expect(onChange).toHaveBeenCalledWith({ network: 'elo' });

    const input = screen.getByRole('textbox', { name: 'Last four digits' });
    fireEvent.change(input, { target: { value: '12a45678' } });
    expect(onChange).toHaveBeenLastCalledWith({ last4: '1245' });
  });

  it('reports the days and expiration as numbers', async () => {
    const onChange = vi.fn();
    renderInLocale(<AttachedCardFields slot={SLOT} onChange={onChange} />);
    await pick('Closing day', '3');
    expect(onChange).toHaveBeenCalledWith({ closingDay: 3 });
    await pick('Expires month', '12');
    expect(onChange).toHaveBeenLastCalledWith({ expirationMonth: 12 });
    await pick('Expires year', '2031');
    expect(onChange).toHaveBeenLastCalledWith({ expirationYear: 2031 });
  });
});
