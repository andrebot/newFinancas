import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { CardDraft, NewAccount } from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/accountManagementState';
import { EMPTY_CARD_FORM } from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/CardFields';
import {
  cardsSent, FirstAccountEntry, isBlankCard, pendingCardOf, type FirstAccountEntryProps,
} from '../../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/FirstAccountEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// First Account Entry (BDT: Interaction, unit): the real kit, card fields and
// translator; only the Flow's handlers are stand-ins. Mockup 11 (OQ-196): the
// type as tiles, Shared to start, the starting balance explained, cards saved
// one at a time — and one left open goes with the account once it passes.

const VISA = '4111111111111111';
const YEAR = new Date().getFullYear() + 3;

const CARD: CardDraft = {
  network: 'visa',
  last4: '1111',
  closingDay: 10,
  dueDay: 20,
  expirationMonth: 8,
  expirationYear: YEAR,
};

const FILLED = {
  digits: VISA, closingDay: 10, dueDay: 20, expirationMonth: 8, expirationYear: YEAR,
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
 * Types into a text field by its name.
 *
 * @param name - The field's label.
 * @param value - The text.
 */
const type = (name: string, value: string) => {
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
};

/** Opens the new card's form and fills every field with a valid Visa. */
const fillCard = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
  type('Card number', VISA);
  await pick('Closing day', '10');
  await pick('Due day', '20');
  await pick('Expires month', '8');
  await pick('Expires year', String(YEAR));
};

/**
 * Renders the entry with stand-in handlers.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderEntry = (props: Partial<FirstAccountEntryProps> = {}) => {
  const handlers = { onSubmit: vi.fn() };
  renderInLocale(<FirstAccountEntry busy={false} personalOnly={false} {...handlers} {...props} />);
  return handlers;
};

/** Types the name and submits. */
const submitNamed = (name: string) => {
  type('Account name', name);
  fireEvent.click(screen.getByRole('button', { name: 'Add account & continue' }));
};

describe('reading a card left open', () => {
  it('tells a blank card from one with anything in it', () => {
    expect(isBlankCard(EMPTY_CARD_FORM)).toBe(true);
    expect(isBlankCard({ ...EMPTY_CARD_FORM, digits: '4' })).toBe(false);
    expect(isBlankCard({ ...EMPTY_CARD_FORM, dueDay: 3 })).toBe(false);
  });

  it('adds nothing for a missing or blank form, the card once it passes, objections else', () => {
    expect(pendingCardOf(undefined)).toEqual({});
    expect(pendingCardOf(EMPTY_CARD_FORM)).toEqual({});
    expect(pendingCardOf(FILLED)).toEqual({ draft: CARD });
    expect(pendingCardOf({ ...FILLED, dueDay: null })).toEqual({ errors: { dueDay: 'pick.day' } });
  });

  it('sends the saved cards and the open one, and none on a type without cards', () => {
    expect(cardsSent(true, [CARD], { draft: CARD })).toEqual([CARD, CARD]);
    expect(cardsSent(true, [CARD], {})).toEqual([CARD]);
    expect(cardsSent(false, [CARD], { draft: CARD })).toEqual([]);
  });
});

describe('the form', () => {
  it('opens on a checking, BRL, shared account, with the balance explained', () => {
    renderEntry();
    expect(screen.getByRole('radio', { name: /Checking/ })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'BRL' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Shared' })).toHaveProperty('checked', true);
    expect(screen.getByText('Spent or invested before today? Record it anyway.')).toBeTruthy();
    expect(screen.getByText(/only the uninvested cash/)).toBeTruthy();
    expect(screen.getByText('An account is required to get started.')).toBeTruthy();
  });

  it('labels every choice and explains what an earlier date does (OQ-169)', () => {
    renderEntry();
    expect(screen.getByRole('radiogroup', { name: 'Account type' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Currency' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Visibility' })).toBeTruthy();
    expect(screen.getByText('Account type')).toBeTruthy();
    expect(screen.getByText('Currency')).toBeTruthy();
    expect(screen.getByText('Visibility')).toBeTruthy();
    expect(screen.getByText(/Add earlier transactions with the date they happened/)).toBeTruthy();
    expect(screen.getByText(/They fill in your history/)).toBeTruthy();
    expect(screen.getByText(/They don't change your starting balance/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('describes each type on its tile', () => {
    renderEntry();
    expect(screen.getByRole('radio', { name: /Credit card only/ })).toBeTruthy();
    expect(screen.getByText('No bank account behind it')).toBeTruthy();
    expect(screen.getByText('Brokerage account')).toBeTruthy();
  });

  it('locks the visibility at Personal for an actor who can’t share', () => {
    const handlers = renderEntry({ personalOnly: true });
    expect(screen.queryByRole('radio', { name: 'Shared' })).toBeNull();
    expect(screen.getByText('Visibility')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
    submitNamed('Mine');
    expect(handlers.onSubmit)
      .toHaveBeenCalledWith(expect.objectContaining({ visibility: 'personal' }));
  });

  it('hides the cards on an investment account (FR-2.7)', () => {
    renderEntry();
    fireEvent.click(screen.getByRole('radio', { name: /Investment/ }));
    expect(screen.queryByText('Cards on this account')).toBeNull();
  });

  it('shows the server’s objection in its banner', () => {
    renderEntry({ alert: 'Something went wrong. Please try again.' });
    expect(screen.getAllByText('Something went wrong. Please try again.').length)
      .toBeGreaterThan(0);
  });

  it('spins its button while the create is out', () => {
    renderEntry({ busy: true });
    expect(screen.getByRole('button', { name: 'Add account & continue' }).getAttribute('aria-busy'))
      .toBe('true');
  });

  it('offers Cancel instead of the note beside accounts already added', () => {
    const onCancel = vi.fn();
    renderEntry({ onCancel });
    expect(screen.queryByText('An account is required to get started.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('its submit', () => {
  it('refuses an empty name, and typing clears the error', () => {
    const handlers = renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Add account & continue' }));
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();
    type('Account name', 'M');
    expect(screen.queryByText('Required.')).toBeNull();
  });

  it('emits the typed account, trimmed, shared, with no balance and no cards', () => {
    const handlers = renderEntry();
    submitNamed('  Main Checking ');
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      name: 'Main Checking',
      type: 'checking',
      currency: 'BRL',
      visibility: 'shared',
      openingBalance: null,
      cards: [],
    } satisfies NewAccount);
  });

  it('emits the picked type, currency and visibility', () => {
    const handlers = renderEntry();
    fireEvent.click(screen.getByRole('radio', { name: /Savings/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'USD' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Personal' }));
    submitNamed('Rainy day');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'savings', currency: 'USD', visibility: 'personal',
    }));
  });

  it('emits today’s balance as typed', () => {
    const handlers = renderEntry();
    const balance = screen.getByRole('textbox', { name: 'Starting balance' });
    fireEvent.change(balance, { target: { value: '12345' } });
    submitNamed('Main');
    expect(handlers.onSubmit)
      .toHaveBeenCalledWith(expect.objectContaining({ openingBalance: 12345 }));
  });
});

describe('its cards', () => {
  it('saves a card as its strip and sends it with the account', async () => {
    const handlers = renderEntry();
    await fillCard();
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    expect(screen.queryByText('New credit card')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove the card ending in 1111' })).toBeTruthy();
    submitNamed('Main');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cards: [CARD] }));
  });

  it('refuses to save a card with fields missing, and a change clears its own error', async () => {
    renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    expect(screen.getByText('Enter the card number.')).toBeTruthy();
    expect(screen.getAllByText('Pick a day.')).toHaveLength(2);
    type('Card number', VISA);
    expect(screen.queryByText('Enter the card number.')).toBeNull();
    expect(screen.getAllByText('Pick a day.')).toHaveLength(2);
  });

  it('drops a saved card from its ✕', async () => {
    const handlers = renderEntry();
    await fillCard();
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove the card ending in 1111' }));
    submitNamed('Main');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cards: [] }));
  });

  it('drops only the saved card asked for, among several', async () => {
    const handlers = renderEntry();
    await fillCard();
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
    type('Card number', '5555555555554444');
    await pick('Closing day', '5');
    await pick('Due day', '15');
    await pick('Expires month', '1');
    await pick('Expires year', String(YEAR));
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove the card ending in 1111' }));
    submitNamed('Main');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      cards: [expect.objectContaining({ last4: '4444' })],
    }));
  });

  it('forgets a cancelled card\'s objections', () => {
    renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
    expect(screen.queryByText('Enter the card number.')).toBeNull();
  });

  it('takes the focus to the card\'s first problem on every refused save', () => {
    renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
    const number = screen.getByRole('textbox', { name: 'Card number' });
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    expect(document.activeElement).toBe(number);
    screen.getByRole('textbox', { name: 'Account name' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    expect(document.activeElement).toBe(number);
  });

  it('takes the focus back to the name on every refused submit', () => {
    renderEntry();
    const name = screen.getByRole('textbox', { name: 'Account name' });
    submitNamed('');
    expect(document.activeElement).toBe(name);
    screen.getByRole('button', { name: 'Add credit card' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'Add account & continue' }));
    expect(document.activeElement).toBe(name);
  });

  it('drops what was typed on Cancel', async () => {
    const handlers = renderEntry();
    await fillCard();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('New credit card')).toBeNull();
    submitNamed('Main');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cards: [] }));
  });

  it('sends a card left open once it passes', async () => {
    const handlers = renderEntry();
    await fillCard();
    submitNamed('Main');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cards: [CARD] }));
  });

  it('refuses the account while a card left open fails', () => {
    const handlers = renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
    type('Card number', VISA);
    submitNamed('Main');
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText('Pick a day.')).toHaveLength(2);
  });

  it('ignores a card form left open and blank', () => {
    const handlers = renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Add credit card' }));
    submitNamed('Main');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cards: [] }));
  });

  it('leaves saved cards out once the type has none', async () => {
    const handlers = renderEntry();
    await fillCard();
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    fireEvent.click(screen.getByRole('radio', { name: /Investment/ }));
    submitNamed('Broker');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'investment', cards: [],
    }));
  });
});
