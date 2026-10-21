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
// only the caller's handlers are stand-ins. Its network and last four digits
// are fixed and the number never appears (NFR-SEC-7, OQ-192); only the
// billing days and expiration edit.

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

/**
 * Renders the fields with stand-in handlers.
 *
 * @param slot - The card slot.
 * @returns The handlers.
 */
const renderFields = (slot: CardSlot = SLOT) => {
  const handlers = { onChange: vi.fn(), onRemove: vi.fn() };
  renderInLocale(<AttachedCardFields slot={slot} {...handlers} />);
  return handlers;
};

describe('AttachedCardFields', () => {
  it('shows the card as a fixed strip and its billing as it stands, and no number field', () => {
    renderFields();
    expect(screen.getByText('1234')).toBeTruthy();
    expect(screen.getByText('Closes 10 · Due 20 · Exp 08/30')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Network' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Last four digits' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Closing day' }).textContent).toBe('10');
    expect(screen.getByRole('combobox', { name: 'Due day' }).textContent).toBe('20');
    expect(screen.getByRole('combobox', { name: 'Expires month' }).textContent).toBe('8');
    expect(screen.getByRole('combobox', { name: 'Expires year' }).textContent).toBe('2030');
    expect(screen.queryByRole('textbox', { name: 'Card number' })).toBeNull();
  });

  it('reports the days and expiration as numbers', async () => {
    const { onChange } = renderFields();
    await pick('Closing day', '3');
    expect(onChange).toHaveBeenCalledWith({ closingDay: 3 });
    await pick('Due day', '25');
    expect(onChange).toHaveBeenLastCalledWith({ dueDay: 25 });
    await pick('Expires month', '12');
    expect(onChange).toHaveBeenLastCalledWith({ expirationMonth: 12 });
    await pick('Expires year', '2031');
    expect(onChange).toHaveBeenLastCalledWith({ expirationYear: 2031 });
  });

  it('removes the card from its strip', () => {
    const { onRemove } = renderFields();
    fireEvent.click(screen.getByRole('button', { name: 'Remove card' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('keeps an expired card’s year among the options', () => {
    renderFields({ ...SLOT, expirationYear: 2001 });
    expect(screen.getByRole('combobox', { name: 'Expires year' }).textContent).toBe('2001');
  });
});
