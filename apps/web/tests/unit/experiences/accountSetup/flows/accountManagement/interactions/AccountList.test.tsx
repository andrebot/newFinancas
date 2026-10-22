import { fireEvent, screen } from '@testing-library/react';
import type { Account } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import { formatMoney } from '../../../../../../../src/utilities/formatting';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import {
  AccountList, outstandingOf, type AccountListProps,
} from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/AccountList';

// The accounts panel (BDT: unit, display state in, events out): the real kit
// and translator; only the Flow's handlers are stand-ins.

/**
 * Builds an account with sensible defaults for its id and name.
 *
 * @param id - Its id.
 * @param over - What to set besides the defaults.
 * @returns The account.
 */
const account = (id: string, over: Partial<Account> = {}): Account => ({
  id,
  householdId: 'doe',
  ownerUserId: null,
  name: `Account ${id}`,
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-10-01',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  currentBalance: 0,
  cards: [],
  ...over,
});

const CHECKING = account('chk', { name: 'Main Checking', currentBalance: 150_75 });
const CREDIT = account(
  'ccr',
  {
    type: 'credit_card_only',
    name: 'Cards',
    cards: [
      {
        id: 'c-1',
        accountId: 'ccr',
        network: 'visa',
        last4: '1234',
        closingDay: 10,
        dueDay: 20,
        expirationMonth: 8,
        expirationYear: 2030,
        createdAt: '2026-10-01T00:00:00Z',
        outstandingBalance: 15_00,
      },
      {
        id: 'c-2',
        accountId: 'ccr',
        network: 'elo',
        last4: '9876',
        closingDay: 5,
        dueDay: 15,
        expirationMonth: 3,
        expirationYear: 2028,
        createdAt: '2026-10-01T00:00:00Z',
        outstandingBalance: 3_50,
      },
    ],
  },
);
const OLD = account('old', { name: 'Old Savings', archivedAt: '2026-09-01T00:00:00Z' });

/**
 * Renders the panel with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderPanel = (props: Partial<AccountListProps> = {}) => {
  const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onRetry: vi.fn() };
  renderInLocale(
    <AccountList
      view={{ status: 'loaded', accounts: [CHECKING, CREDIT, OLD] }}
      canCreate
      isEditable={(acc) => acc.id === 'chk'}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('the panel’s states', () => {
  it('shows nothing but its pulse while the list loads', () => {
    renderPanel({ view: { status: 'loading' } });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the failure and retries on a click', () => {
    const handlers = renderPanel({
      view: { status: 'failed', error: { code: 'internal.unexpected' } },
    });
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty list and its add button when there are no accounts', () => {
    renderPanel({ view: { status: 'loaded', accounts: [] }, canCreate: true });
    expect(screen.getByText(/No accounts yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add account/ })).toBeTruthy();
  });

  it('hides the add button when the actor may not create', () => {
    renderPanel({ canCreate: false });
    expect(screen.queryByRole('button', { name: /Add account/ })).toBeNull();
  });
});

describe('the accounts’ cards', () => {
  it('shows a checking account’s balance and tags', () => {
    renderPanel();
    const button = screen.getByRole('button', { name: 'Main Checking' });
    const card = button.closest('.rounded-xl, [class*="Card"]') ?? document.body;
    expect(card.textContent).toContain(formatMoney(150_75, 'BRL'));
    expect(screen.getAllByText('Checking').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shared').length).toBeGreaterThan(0);
  });

  it('shows a credit-card account’s outstanding as its cards’ sum', () => {
    renderPanel();
    expect(outstandingOf(CREDIT)).toBe(18_50);
    const button = screen.getByRole('button', { name: 'Cards' });
    const card = button.closest('[class*="Card"]') ?? document.body;
    expect(card.textContent).toContain(formatMoney(18_50, 'BRL'));
  });

  it('lists the attached cards as strips: last four, billing days and expiry', () => {
    renderPanel();
    expect(screen.getByText('1234')).toBeTruthy();
    expect(screen.getByText('Closes 10 · Due 20 · Exp 08/30')).toBeTruthy();
    expect(screen.getByText('9876')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Elo' })).toBeTruthy();
  });

  it('shows a checking account’s balance and its cards together', () => {
    const WITH_CARD = account('wc', {
      name: 'Checking with card',
      currentBalance: 99_00,
      cards: CREDIT.cards.slice(0, 1),
    });
    renderPanel({ view: { status: 'loaded', accounts: [WITH_CARD] } });
    const card = screen.getByRole('button', { name: 'Checking with card' }).closest('section');
    expect(card?.textContent).toContain('Balance');
    expect(card?.textContent).toContain(formatMoney(99_00, 'BRL'));
    expect(screen.getByText('1234')).toBeTruthy();
  });

  it('labels a personal account and tones its tag down', () => {
    const PERSONAL = account('per', { name: 'Personal Checking', visibility: 'personal' });
    renderPanel({ view: { status: 'loaded', accounts: [PERSONAL] } });
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('stretches an editable card\'s name button over the whole card', () => {
    renderPanel();
    const editable = screen.getByRole('button', { name: 'Main Checking' });
    const locked = screen.getByRole('button', { name: 'Cards' });
    expect(editable.className).toContain('after:inset-0');
    expect(editable.closest('section')?.className).toContain('relative');
    expect(locked.className).not.toContain('after:inset-0');
  });

  it('opens the edit drawer only for an editable account', () => {
    const handlers = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Main Checking' }));
    expect(handlers.onEdit).toHaveBeenCalledWith('chk');
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
  });

  it('keeps the archived accounts in their own section, not editable', () => {
    const handlers = renderPanel();
    expect(screen.getByText(/1 archived account/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Old Savings' }));
    expect(handlers.onEdit).toHaveBeenCalledTimes(0);
  });
});
