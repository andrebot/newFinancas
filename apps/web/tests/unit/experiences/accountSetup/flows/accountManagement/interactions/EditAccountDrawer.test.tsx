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
    expect(screen.getByText('Personal')).toBeTruthy();
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
    fireEvent.change(input, { target: { value: 'Renamed' } });
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
          id: 'card-1',
          network: 'visa',
          last4: '1234',
          closingDay: 10,
          dueDay: 25,
          expirationMonth: 8,
          expirationYear: 2030,
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
    expect(screen.getByText("Complete the card's fields.")).toBeTruthy();
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
          id: 'card-1',
          network: 'visa',
          last4: '1234',
          closingDay: 10,
          dueDay: 25,
          expirationMonth: 8,
          expirationYear: 2030,
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
    expect(screen.getAllByRole('textbox', { name: 'Card number' }).length).toBe(2);
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
    expect(screen.getAllByText("Complete the card's fields.").length).toBe(2);

    // The attached card’s selects come first, then the two new cards’.
    const closings = screen.getAllByRole('combobox', { name: 'Closing day' });
    const secondNew = closings[2];
    if (!secondNew) throw new Error('the new cards’ closing-day selects are missing');
    await act(async () => {
      fireEvent.click(secondNew);
    });
    fireEvent.click(screen.getByRole('option', { name: '10' }));
    expect(screen.getAllByText("Complete the card's fields.").length).toBe(1);
  });

  it('drops a new card again before submitting', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Add credit card/ }));
    expect(screen.getByRole('textbox', { name: 'Card number' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Drop this card/ }));
    expect(screen.queryByRole('textbox', { name: 'Card number' })).toBeNull();
  });

  it('waits while another request is out', () => {
    renderDrawer({ disabled: true });
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Save changes' });
    expect(button.disabled).toBe(true);
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
    fireEvent.click(open.getByRole('button', { name: 'Archive' }));
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

  it('spins its confirm while an archive is out', () => {
    renderDrawer({ busy: true, archiveConfirmOpen: true });
    const zone = screen.getByRole('region', { name: /Archive this account/ });
    expect(within(zone).getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});
