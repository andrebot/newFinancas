import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { CardDraft } from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/accountManagementState';
import { EMPTY_CARD_FORM } from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/CardFields';
import {
  AccountCardsField, type AccountCardsFieldProps,
} from '../../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/AccountCardsField';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The first account's cards (BDT: Interaction, unit): the real kit, card
// fields and translator; only the entry's handlers are stand-ins. Mockup 11.

const SAVED: CardDraft = {
  network: 'visa',
  last4: '1111',
  closingDay: 15,
  dueDay: 22,
  expirationMonth: 9,
  expirationYear: 2030,
};

/**
 * Renders the field with stand-in handlers.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderField = (props: Partial<AccountCardsFieldProps> = {}) => {
  const handlers = {
    onOpen: vi.fn(),
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onRemove: vi.fn(),
  };
  renderInLocale(<AccountCardsField saved={[]} disabled={false} {...handlers} {...props} />);
  return handlers;
};

describe('the cards field', () => {
  it('offers a new card while no form is open', () => {
    const handlers = renderField();
    expect(screen.getByText('Cards on this account')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
    expect(handlers.onOpen).toHaveBeenCalledOnce();
  });

  it('lists a saved card as its strip, and drops it from its ✕', () => {
    const handlers = renderField({ saved: [SAVED] });
    expect(screen.getByText('Closes 15 · Due 22 · Exp 09/30')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove the card ending in 1111' }));
    expect(handlers.onRemove).toHaveBeenCalledWith(0);
  });

  it('shows the open form with its note, and emits its changes, Save and Cancel', () => {
    const handlers = renderField({ form: EMPTY_CARD_FORM });
    expect(screen.getByText('New credit card')).toBeTruthy();
    expect(screen.getByText(/Only the last 4 digits are stored/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add credit card' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Card number' }), {
      target: { value: '4111' },
    });
    expect(handlers.onChange).toHaveBeenCalledWith({ digits: '4111' });
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handlers.onSave).toHaveBeenCalledWith(EMPTY_CARD_FORM);
    expect(handlers.onCancel).toHaveBeenCalledOnce();
  });

  it('shows the open card’s objections under their fields', () => {
    renderField({ form: EMPTY_CARD_FORM, errors: { digits: 'number.required' } });
    expect(screen.getByText('Enter the card number.')).toBeTruthy();
  });

  it('holds its buttons while a request is out', () => {
    renderField({ saved: [SAVED], disabled: true });
    expect(screen.getByRole('button', { name: 'Add credit card' }))
      .toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Remove the card/ }))
      .toHaveProperty('disabled', true);
  });
});
