import {
  act, fireEvent, screen, within,
} from '@testing-library/react';
import type { Account, CreditCard } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import {
  EditAccountDrawer, type EditAccountDrawerProps,
} from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/EditAccountDrawer';

// The edit drawer (BDT: unit): the real kit and translator; only the Flow's
// handlers are stand-ins. Attached cards are edited field by field; new ones
// come through their number.

const CARD: CreditCard = {
  id: 'card-1',
  accountId: 'ccr',
  network: 'visa',
  last4: '1234',
  closingDay: 10,
  dueDay: 20,
  expirationMonth: 8,
  expirationYear: 2030,
  createdAt: '2026-10-01T00:00:00Z',
  outstandingBalance: 0,
};

/**
 * Builds an account with sensible defaults for its id and name.
 *
 * @param over - What to set besides the defaults.
 * @returns The account.
 */
const account = (over: Partial<Account> = {}): Account => ({
  id: 'ccr',
  householdId: 'doe',
  ownerUserId: 'ana',
  name: 'Cards',
  type: 'credit_card_only',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-10-01',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  currentBalance: 0,
  cards: [CARD],
  ...over,
});

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
const renderDrawer = (props: Partial<EditAccountDrawerProps> = {}) => {
  const handlers = {
    onSubmit: vi.fn(),
    onArchive: vi.fn(),
    onOpenArchive: vi.fn(),
    onCloseArchive: vi.fn(),
    onCancel: vi.fn(),
  };
  renderInLocale(
    <EditAccountDrawer
      account={account()}
      selfUserId="ana"
      busy={false}
      disabled={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('the locked and the movable fields', () => {
  it('names the dialog after the account and labels every field', () => {
    renderDrawer();
    expect(screen.getByRole('dialog', { name: 'Cards' })).toBeTruthy();
    expect(screen.getByText('Edit account')).toBeTruthy();
    expect(screen.getByText('Type')).toBeTruthy();
    expect(screen.getByText('Currency')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Visibility' })).toBeTruthy();
    expect(screen.getByText('Cards on this account · optional')).toBeTruthy();
    expect(screen.getByText(/takes the account out of use/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the type and currency locked, with their note', () => {
    renderDrawer();
    expect(screen.getByText('Credit card only')).toBeTruthy();
    expect(screen.getByText('BRL')).toBeTruthy();
    expect(screen.getByText(/set when the account is created/)).toBeTruthy();
  });

  it('lets its creator move the visibility, and no one else', () => {
    renderDrawer({ selfUserId: 'ana' });
    expect(screen.getByRole('radio', { name: 'Shared' })).toBeTruthy();
    const other = renderInLocale(
      <EditAccountDrawer
        account={account()}
        selfUserId="ben"
        busy={false}
        disabled={false}
        archiveConfirmOpen={false}
        onSubmit={() => undefined}
        onArchive={() => undefined}
        onOpenArchive={() => undefined}
        onCloseArchive={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(other.container.querySelector('input[type="radio"]')).toBeNull();
  });

  it('locks a personal account’s visibility for anyone but its creator', () => {
    renderDrawer({ account: account({ ownerUserId: 'ben', visibility: 'personal' }) });
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('Visibility')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('shows a shared account as shared to someone else', () => {
    renderDrawer({ account: account({ ownerUserId: 'ben' }) });
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.queryByText('Personal')).toBeNull();
  });

  it('offers cards on a checking account (FR-2.7)', () => {
    renderDrawer({ account: account({ type: 'checking', cards: [] }) });
    expect(screen.getByRole('button', { name: /Add credit card/ })).toBeTruthy();
  });

  it('offers no cards on an investment account', () => {
    renderDrawer({ account: account({ type: 'investment', cards: [] }) });
    expect(screen.queryByRole('button', { name: /Add credit card/ })).toBeNull();
  });

  it('shows the server’s objection in its banner', () => {
    renderDrawer({ alert: 'Something went wrong. Please try again.' });
    const errors = screen.getAllByText('Something went wrong. Please try again.');
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('its submit', () => {
  it('emits the name and nothing else when nothing moved', () => {
    const handlers = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      accountId: 'ccr', name: 'Cards', visibility: undefined, cards: undefined,
    });
  });

  it('emits a renamed account with its moved visibility', () => {
    const handlers = renderDrawer();
    const input = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(input, { target: { value: '  Renamed ' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Personal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      accountId: 'ccr', name: 'Renamed', visibility: 'personal', cards: undefined,
    });
  });

  it('emits an edit only for the attached card that moved', async () => {
    const handlers = renderDrawer();
    await pick('Due day', '25');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      accountId: 'ccr',
      name: 'Cards',
      visibility: undefined,
      cards: {
        edit: [{
          id: 'card-1', closingDay: 10, dueDay: 25, expirationMonth: 8, expirationYear: 2030,
        }],
      },
    });
  });

  it('emits a removal for an attached card marked to go', () => {
    const handlers = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Remove card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      accountId: 'ccr', name: 'Cards', visibility: undefined, cards: { remove: ['card-1'] },
    });
  });

  it('emits a new card added through its number', async () => {
    const handlers = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const input = screen.getByRole('textbox', { name: 'Card number' });
    fireEvent.change(input, { target: { value: '5105105105101000' } });

    // The new card's selects come after the attached card's.
    const pickNew = async (name: string, option: string) => {
      const box = screen.getAllByRole('combobox', { name })[1];
      if (!box) throw new Error(`the new card's ${name} select is missing`);
      await act(async () => {
        fireEvent.click(box);
      });
      fireEvent.click(screen.getByRole('option', { name: option }));
    };

    await pickNew('Closing day', '1');
    await pickNew('Due day', '10');
    await pickNew('Expires month', '2');
    const year = String(new Date().getFullYear() + 3);
    await pickNew('Expires year', year);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      accountId: 'ccr',
      name: 'Cards',
      visibility: undefined,
      cards: {
        add: [{
          network: 'mastercard',
          last4: '1000',
          closingDay: 1,
          dueDay: 10,
          expirationMonth: 2,
          expirationYear: Number(year),
        }],
      },
    });
  });

  it('refuses an incomplete new card and shows why', async () => {
    const handlers = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const input = screen.getByRole('textbox', { name: 'Card number' });
    fireEvent.change(input, { target: { value: '5105105105101000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText('Pick a day.').length).toBe(2);
    expect(screen.getByText('Pick the month.')).toBeTruthy();
    expect(screen.getByText('Pick the year.')).toBeTruthy();
  });

  it('waits while a request is out', () => {
    const handlers = renderDrawer({ busy: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).not.toHaveBeenCalled();
  });

  it('refuses an empty name and shows the field’s error', () => {
    const handlers = renderDrawer();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();
  });

  it('edits only the attached card that moved, among several', async () => {
    const second = { ...CARD, id: 'card-2', last4: '9876' };
    const handlers = renderDrawer({ account: account({ cards: [CARD, second] }) });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('combobox', { name: 'Due day' })[1]!);
    });
    fireEvent.click(screen.getByRole('option', { name: '25' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      cards: {
        edit: [{
          id: 'card-2', closingDay: 10, dueDay: 25, expirationMonth: 8, expirationYear: 2030,
        }],
      },
    }));
  });

  it('removes only the attached card asked for, among several', () => {
    const second = { ...CARD, id: 'card-2', last4: '9876' };
    const handlers = renderDrawer({ account: account({ cards: [CARD, second] }) });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove card' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      cards: { remove: ['card-2'] },
    }));
  });

  it('edits one of several attached cards and removes another', async () => {
    const second = { ...CARD, id: 'card-2', last4: '9876' };
    const handlers = renderDrawer({ account: account({ cards: [CARD, second] }) });
    const due = screen.getAllByRole('combobox', { name: 'Due day' })[0];
    if (!due) throw new Error('the first card’s due-day select is missing');
    await act(async () => {
      fireEvent.click(due);
    });
    fireEvent.click(screen.getByRole('option', { name: '25' }));
    const removes = screen.getAllByRole('button', { name: 'Remove card' });
    const secondRemove = removes[1];
    if (!secondRemove) throw new Error('both cards’ remove buttons are missing');
    fireEvent.click(secondRemove);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      accountId: 'ccr',
      name: 'Cards',
      visibility: undefined,
      cards: {
        edit: [{
          id: 'card-1', closingDay: 10, dueDay: 25, expirationMonth: 8, expirationYear: 2030,
        }],
        remove: ['card-2'],
      },
    });
  });

  it('changes one of several new cards without touching the others', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const numbers = screen.getAllByRole('textbox', { name: 'Card number' });
    const firstNumber = numbers[0];
    if (!firstNumber) throw new Error('both new cards’ number fields are missing');
    fireEvent.change(firstNumber, { target: { value: '5105105105101000' } });
    const values = screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Card number' })
      .map(({ value }) => value.replace(/\D/g, ''));
    expect(values).toEqual(['5105105105101000', '']);
  });

  it('clears an objection on the new card whose field changed, not on another', async () => {
    renderDrawer({ account: account({ cards: [] }) });
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const closing = () => screen.getAllByRole('combobox', { name: 'Closing day' });
    await act(async () => {
      fireEvent.click(closing()[1]!);
    });
    fireEvent.click(screen.getByRole('option', { name: '10' }));
    expect(closing().map((box) => box.getAttribute('aria-invalid'))).toEqual(['true', null]);
  });

  it('clears the name’s error as it is typed, and refocuses it on every refusal', () => {
    renderDrawer();
    const name = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(name);
    screen.getByRole('button', { name: 'Cancel' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(document.activeElement).toBe(name);
    fireEvent.change(name, { target: { value: 'C' } });
    expect(name.hasAttribute('aria-invalid')).toBe(false);
  });

  it('clears one new card’s objection when its fields pass, keeping the other’s', async () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const numbers = screen.getAllByRole('textbox', { name: 'Card number' });
    const firstNumber = numbers[0];
    if (!firstNumber) throw new Error('both new cards’ number fields are missing');
    fireEvent.change(firstNumber, { target: { value: '5105105105101000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getAllByText('Pick a day.').length).toBe(4);

    // The attached card’s selects come first, then the two new cards’.
    const closings = screen.getAllByRole('combobox', { name: 'Closing day' });
    const secondNew = closings[2];
    if (!secondNew) throw new Error('the new cards’ closing-day selects are missing');
    await act(async () => {
      fireEvent.click(secondNew);
    });
    fireEvent.click(screen.getByRole('option', { name: '10' }));
    expect(screen.getAllByText('Pick a day.').length).toBe(3);
  });

  it('drops a new card again before submitting', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    expect(screen.getByRole('textbox', { name: 'Card number' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Drop this card/ }));
    expect(screen.queryByRole('textbox', { name: 'Card number' })).toBeNull();
  });

  it('waits while another request is out — Cancel and Archive too', () => {
    renderDrawer({ disabled: true });
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Save changes' });
    expect(button.disabled).toBe(true);
    const cancel = screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' });
    expect(cancel.disabled).toBe(true);
    const archive = screen.getByRole<HTMLButtonElement>('button', { name: 'Archive' });
    expect(archive.disabled).toBe(true);
  });

  it('drops one new card, keeping the other card and its own objection', () => {
    renderDrawer({ account: account({ cards: [] }) });
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    const [first] = screen.getAllByRole('textbox', { name: 'Card number' });
    fireEvent.change(first!, { target: { value: '4111111111111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getAllByText('Enter the card number.')).toHaveLength(1);

    fireEvent.click(screen.getAllByRole('button', { name: /Drop this card/ })[0]!);
    const numbers = screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Card number' });
    expect(numbers.map(({ value }) => value)).toEqual(['']);
    expect(screen.getAllByText('Enter the card number.')).toHaveLength(1);
  });
});

describe('the archive behind its confirm', () => {
  it('opens the confirm from its danger zone, and archives on a yes', () => {
    const handlers = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(handlers.onOpenArchive).toHaveBeenCalledTimes(1);

    const open = renderInLocale(
      <EditAccountDrawer
        account={account()}
        selfUserId="ana"
        busy={false}
        disabled={false}
        archiveConfirmOpen
        {...handlers}
      />,
    );
    expect(open.getByText('Archive Cards? Its balance and cards stop being tracked.')).toBeTruthy();
    const confirm = open.getByRole('button', { name: 'Archive' });
    expect(confirm.hasAttribute('aria-busy')).toBe(false);
    fireEvent.click(confirm);
    expect(handlers.onArchive).toHaveBeenCalledTimes(1);
  });

  it('closes the confirm on a no, and keeps the drawer open', () => {
    const handlers = renderDrawer();
    const open = renderInLocale(
      <EditAccountDrawer
        account={account()}
        selfUserId="ana"
        busy={false}
        disabled={false}
        archiveConfirmOpen
        {...handlers}
      />,
    );
    // The confirm's Cancel, not the drawer footer's.
    const zone = open.getByRole('region', { name: /Archive this account/ });
    fireEvent.click(within(zone).getByRole('button', { name: 'Cancel' }));
    expect(handlers.onCloseArchive).toHaveBeenCalledTimes(1);
  });

  it('holds its confirm while an edit is out', () => {
    const handlers = renderDrawer({ busy: true, disabled: true, archiveConfirmOpen: true });
    const zone = screen.getByRole('region', { name: /Archive this account/ });
    const confirm = within(zone).getByRole<HTMLButtonElement>('button', { name: 'Archive' });
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(handlers.onArchive).not.toHaveBeenCalled();
  });

  it('spins its confirm while an archive is out, not Save', () => {
    const handlers = renderDrawer({ archiveBusy: true, disabled: true, archiveConfirmOpen: true });
    const zone = screen.getByRole('region', { name: /Archive this account/ });
    const confirm = within(zone).getByRole('button', { name: 'Archive' });
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(confirm);
    expect(handlers.onArchive).not.toHaveBeenCalled();
    const save = screen.getByRole<HTMLButtonElement>('button', { name: 'Save changes' });
    expect(save.disabled).toBe(true);
  });
});
