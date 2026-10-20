import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { NewAccount } from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/accountManagementState';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import {
  CreateAccountDrawer, type CreateAccountDrawerProps,
} from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/CreateAccountDrawer';

// The create drawer (BDT: unit): the real kit and translator; only the Flow's
// handlers are stand-ins. A card is added through its fields, picked one by
// one.

const VISA = '4111111111111111';

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
 * Renders the drawer with stand-in handlers.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderDrawer = (props: Partial<CreateAccountDrawerProps> = {}) => {
  const handlers = { onSubmit: vi.fn(), onCancel: vi.fn() };
  renderInLocale(
    <CreateAccountDrawer busy={false} disabled={false} {...handlers} {...props} />,
  );
  return handlers;
};

/** Types the name and submits. */
const submitNamed = (name: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
};

describe('the form’s fields', () => {
  it('opens with a checking, BRL, personal account and no cards section', () => {
    renderDrawer();
    expect(screen.getByRole('combobox', { name: 'Type' }).textContent).toBe('Checking');
    expect(screen.queryByText(/Cards on this account/)).toBeNull();
  });

  it('shows the cards section only for a credit-card account', async () => {
    renderDrawer();
    await pick('Type', 'Credit card only');
    expect(screen.getByText('Cards on this account · optional')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add credit card/ })).toBeTruthy();
  });

  it('shows the server’s objection in its banner', () => {
    renderDrawer({ alert: 'Something went wrong. Please try again.' });
    const errors = screen.getAllByText('Something went wrong. Please try again.');
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('its submit', () => {
  it('refuses an empty name and shows the field’s error', () => {
    const handlers = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();
  });

  it('emits the typed account, trimmed, with no cards and no balance', () => {
    const handlers = renderDrawer();
    submitNamed('  Main Checking ');
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      name: 'Main Checking',
      type: 'checking',
      currency: 'BRL',
      visibility: 'personal',
      openingBalance: null,
      cards: [],
    } satisfies NewAccount);
  });

  it('emits the picked currency and visibility', async () => {
    const handlers = renderDrawer();
    fireEvent.click(screen.getByRole('radio', { name: 'USD' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Shared' }));
    submitNamed('Savings');
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      currency: 'USD', visibility: 'shared',
    }));
  });

  it('adds a card through its fields and emits it with the account', async () => {
    const handlers = renderDrawer();
    await pick('Type', 'Credit card only');
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const input = screen.getByRole('textbox', { name: 'Card number' });
    fireEvent.change(input, { target: { value: VISA } });
    await pick('Closing day', '10');
    await pick('Due day', '20');
    await pick('Expires month', '8');
    const year = String(new Date().getFullYear() + 3);
    await pick('Expires year', year);
    submitNamed('Cards');

    expect(handlers.onSubmit).toHaveBeenCalledWith({
      name: 'Cards',
      type: 'credit_card_only',
      currency: 'BRL',
      visibility: 'personal',
      openingBalance: null,
      cards: [{
        network: 'visa',
        last4: '1111',
        closingDay: 10,
        dueDay: 20,
        expirationMonth: 8,
        expirationYear: Number(year),
      }],
    });
  });

  it('refuses a card whose fields are incomplete and shows why', async () => {
    const handlers = renderDrawer();
    await pick('Type', 'Credit card only');
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const input = screen.getByRole('textbox', { name: 'Card number' });
    fireEvent.change(input, { target: { value: VISA } });
    submitNamed('Cards');

    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Complete the card's fields.")).toBeTruthy();
  });

  it('drops a new card again before submitting', async () => {
    const handlers = renderDrawer();
    await pick('Type', 'Credit card only');
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const input = screen.getByRole('textbox', { name: 'Card number' });
    fireEvent.change(input, { target: { value: VISA } });
    await pick('Closing day', '10');
    await pick('Due day', '20');
    await pick('Expires month', '8');
    const year = String(new Date().getFullYear() + 3);
    await pick('Expires year', year);
    fireEvent.click(screen.getByRole('button', { name: /Drop this card/ }));
    submitNamed('Cards');

    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cards: [] }));
  });

  it('waits while a request is out', () => {
    const handlers = renderDrawer({ busy: true });
    submitNamed('Main Checking');
    expect(handlers.onSubmit).not.toHaveBeenCalled();
  });

  it('waits while another request is out', () => {
    renderDrawer({ disabled: true });
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Create account' });
    expect(button.disabled).toBe(true);
  });

  it('clears one card’s objection when its fields pass, keeping the other’s', async () => {
    renderDrawer();
    await pick('Type', 'Credit card only');
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const numbers = screen.getAllByRole('textbox', { name: 'Card number' });
    const firstNumber = numbers[0];
    if (!firstNumber) throw new Error('both cards’ number fields are missing');
    fireEvent.change(firstNumber, { target: { value: VISA } });
    submitNamed('Cards');
    expect(screen.getAllByText("Complete the card's fields.").length).toBe(2);

    const closings = screen.getAllByRole('combobox', { name: 'Closing day' });
    const firstClosing = closings[0];
    if (!firstClosing) throw new Error('the first card’s closing-day select is missing');
    await act(async () => {
      fireEvent.click(firstClosing);
    });
    fireEvent.click(screen.getByRole('option', { name: '10' }));
    expect(screen.getAllByText("Complete the card's fields.").length).toBe(1);
  });
});
