import { describe, expect, it } from 'vitest';
import type { Account } from '../../../../src/accessors/accountAccessor';
import type { AccountTransaction } from '../../../../src/accessors/accountTransactionAccessor';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import createBrowse from '../../../../src/managers/transaction/browse';
import createDelete from '../../../../src/managers/transaction/delete';
import createEdit from '../../../../src/managers/transaction/edit';
import createRecord, { type TransactionCreate } from '../../../../src/managers/transaction/record';
import {
  ACCOUNT, ANA_ID, CHECKING, HOUSEHOLD_ID, ROW, fakeDeps,
} from './fakes';

// Transfers between the household's own accounts (OQ-222): recorded as a
// linked pair kept out of In/Out, edited and deleted as one, the other side
// hidden from a member who can't see its Account; a transfer recorded alone
// is to or from someone else and counts. The tier below is mocked (BDT).

const context: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};

const SAVINGS: Account = {
  ...CHECKING, id: '0199c5a0-0000-7000-8000-0000000000a3', name: 'Poupança', type: 'savings',
};
const DOLLARS: Account = {
  ...CHECKING, id: '0199c5a0-0000-7000-8000-0000000000a4', name: 'Wise', currency: 'USD',
};
const CARD_ONLY: Account = {
  ...CHECKING, id: '0199c5a0-0000-7000-8000-0000000000a5', type: 'credit_card_only',
};

/** The sent side of a 5,000 transfer from checking to savings. */
const SENT: AccountTransaction = {
  ...ROW,
  id: '0199c5a0-0000-7000-8000-0000000000s1',
  accountId: CHECKING.id,
  kind: 'transfer_sent',
  effect: 'transfer',
  transferId: '0199c5a0-0000-7000-8000-0000000000s1',
  pair: {
    id: '0199c5a0-0000-7000-8000-0000000000s2',
    accountId: SAVINGS.id,
    amount: 5_000,
    currency: 'BRL',
  },
};

/** Its received side. */
const RECEIVED: AccountTransaction = {
  ...SENT,
  id: '0199c5a0-0000-7000-8000-0000000000s2',
  accountId: SAVINGS.id,
  kind: 'transfer_received',
  pair: {
    id: SENT.id, accountId: CHECKING.id, amount: 5_000, currency: 'BRL',
  },
};

/**
 * A fake whose Accounts and rows are found by id.
 *
 * @param accounts - The Accounts it knows.
 * @param rows - The rows it knows.
 * @returns The programmed fake.
 */
const fakeWith = (
  accounts: readonly Account[] = [CHECKING, SAVINGS, DOLLARS, CARD_ONLY],
  rows: readonly AccountTransaction[] = [SENT, RECEIVED],
) => {
  const fake = fakeDeps();
  fake.accounts.findById.mockImplementation(async (_householdId: string, id: string) => (
    accounts.find((account) => account.id === id)
  ));
  fake.accountTransactions.findById.mockImplementation(async (_householdId: string, id: string) => (
    rows.find((row) => row.id === id)
  ));
  fake.accountTransactions.update.mockImplementation(async (
    id: string,
    _expected: unknown,
    changes: Record<string, unknown>,
  ) => ({ status: 'updated' as const, transaction: { ...ROW, id, ...changes } }));
  return fake;
};

/**
 * A transfer from checking to savings, plus overrides.
 *
 * @param over - What to change.
 * @returns The create request.
 */
const ownTransfer = (over: Partial<TransactionCreate> = {}): TransactionCreate => ({
  kind: 'transfer_sent',
  date: '2026-10-13',
  amount: 5_000,
  currency: 'BRL',
  accountId: CHECKING.id,
  toAccountId: SAVINGS.id,
  ...over,
});

describe('recording a transfer (OQ-222)', () => {
  it('records one alone as money to or from someone else — it counts', async () => {
    const fake = fakeWith();
    await createRecord(fake.deps).recordTransaction(context, HOUSEHOLD_ID, {
      kind: 'transfer_received',
      date: '2026-10-13',
      amount: 5_000,
      currency: 'BRL',
      accountId: CHECKING.id,
    });
    expect(fake.accountTransactions.insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'transfer_received', effect: 'movement',
    }));
    expect(fake.accountTransactions.insertTransfer).not.toHaveBeenCalled();
  });

  it('records both sides between own accounts, linked, each moving its account', async () => {
    const fake = fakeWith();
    const recorded = await createRecord(fake.deps)
      .recordTransaction(context, HOUSEHOLD_ID, ownTransfer({ description: 'Reserve' }));

    expect(fake.accountTransactions.insertTransfer).toHaveBeenCalledWith({
      sent: {
        accountId: CHECKING.id,
        kind: 'transfer_sent',
        effect: 'transfer',
        date: '2026-10-13',
        amount: 5_000,
        currency: 'BRL',
        description: 'Reserve',
        createdByUserId: ANA_ID,
      },
      received: {
        accountId: SAVINGS.id,
        kind: 'transfer_received',
        effect: 'transfer',
        date: '2026-10-13',
        amount: 5_000,
        currency: 'BRL',
        description: 'Reserve',
        createdByUserId: ANA_ID,
      },
    });
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(CHECKING.id, {
      amount: -5_000, currency: 'BRL', date: '2026-10-13',
    });
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(SAVINGS.id, {
      amount: 5_000, currency: 'BRL', date: '2026-10-13',
    });
    expect(fake.budgets.accrueIfClaimed).not.toHaveBeenCalled();
    expect(recorded).toMatchObject({ accountId: CHECKING.id, kind: 'transfer_sent' });
  });

  it('takes what reached an account in another currency — no conversion', async () => {
    const fake = fakeWith();
    await createRecord(fake.deps).recordTransaction(
      context,
      HOUSEHOLD_ID,
      ownTransfer({ toAccountId: DOLLARS.id, receivedAmount: 950 }),
    );
    expect(fake.accountTransactions.insertTransfer).toHaveBeenCalledWith(expect.objectContaining({
      received: expect.objectContaining({ accountId: DOLLARS.id, amount: 950, currency: 'USD' }),
    }));
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(DOLLARS.id, {
      amount: 950, currency: 'USD', date: '2026-10-13',
    });
  });

  it.each([
    ['the same account twice', { toAccountId: CHECKING.id }, 'toAccountId', 'field.invalid'],
    ['no amount received across currencies', { toAccountId: DOLLARS.id }, 'receivedAmount',
      'field.required'],
    ['an amount received within one currency', { receivedAmount: 5_000 }, 'receivedAmount',
      'field.invalid'],
  ])('refuses %s', async (_case, over, field, code) => {
    const fake = fakeWith();
    const recording = createRecord(fake.deps)
      .recordTransaction(context, HOUSEHOLD_ID, ownTransfer(over));
    await expect(recording).rejects.toMatchObject({
      domainError: { code: 'validation.failed', details: [{ field, code }] },
    });
    expect(fake.inTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['a category', { categoryId: 'food' }, 'categoryId'],
    ['an amount received without an account it reached',
      { toAccountId: undefined, receivedAmount: 10 }, 'receivedAmount'],
  ])('refuses %s', async (_case, over, field) => {
    const fake = fakeWith();
    const request = Object.fromEntries(Object.entries(ownTransfer(over))
      .filter(([, value]) => value !== undefined)) as unknown as TransactionCreate;
    await expect(createRecord(fake.deps).recordTransaction(context, HOUSEHOLD_ID, request))
      .rejects.toMatchObject({
        domainError: { code: 'validation.failed', details: [expect.objectContaining({ field })] },
      });
  });

  it('refuses an account that takes no transfer', async () => {
    const fake = fakeWith();
    await expect(createRecord(fake.deps).recordTransaction(
      context,
      HOUSEHOLD_ID,
      ownTransfer({ toAccountId: CARD_ONLY.id }),
    )).rejects.toMatchObject({ domainError: { code: 'transaction.kind_not_allowed_for_target' } });
  });

  it('answers transaction.changed when the pair loses a race (OQ-203)', async () => {
    const fake = fakeWith();
    fake.accountTransactions.insertTransfer.mockResolvedValueOnce({
      ok: false, reason: 'reference_not_found',
    });
    await expect(createRecord(fake.deps).recordTransaction(context, HOUSEHOLD_ID, ownTransfer()))
      .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
  });

  it('answers transaction.changed when an account movement loses a race', async () => {
    const fake = fakeWith();
    fake.accounts.applyMovement.mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    await expect(createRecord(fake.deps).recordTransaction(context, HOUSEHOLD_ID, ownTransfer()))
      .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
  });
});

describe('reading a transfer (OQ-222)', () => {
  it('hides the other side of a page row from a member who can\'t see its account', async () => {
    const fake = fakeWith();
    fake.accounts.list.mockResolvedValue([CHECKING]);
    fake.accountTransactions.list.mockResolvedValue([SENT]);
    const page = await createBrowse(fake.deps)
      .listTransactions(context, HOUSEHOLD_ID, {}, undefined, 20);
    expect((page.items[0]!.transaction as AccountTransaction).pair).toEqual({
      id: RECEIVED.id, accountId: null, amount: null, currency: null,
    });
  });

  it('keeps it for one who sees both', async () => {
    const fake = fakeWith();
    fake.accounts.list.mockResolvedValue([CHECKING, SAVINGS]);
    fake.accountTransactions.list.mockResolvedValue([SENT]);
    const page = await createBrowse(fake.deps)
      .listTransactions(context, HOUSEHOLD_ID, {}, undefined, 20);
    expect((page.items[0]!.transaction as AccountTransaction).pair).toEqual(SENT.pair);
  });

  it('hides it on a row read by id too', async () => {
    const fake = fakeWith();
    fake.accounts.list.mockResolvedValue([CHECKING]);
    const row = await createBrowse(fake.deps).getTransaction(context, HOUSEHOLD_ID, SENT.id);
    expect((row.transaction as AccountTransaction).pair?.accountId).toBeNull();
  });

  it('reads no account list for a row that isn\'t a pair', async () => {
    const fake = fakeWith([ACCOUNT], [ROW]);
    await createBrowse(fake.deps).getTransaction(context, HOUSEHOLD_ID, ROW.id);
    expect(fake.accounts.list).not.toHaveBeenCalled();
  });
});

describe('deleting a transfer between own accounts (OQ-222)', () => {
  it('deletes both sides, moving both accounts back', async () => {
    const fake = fakeWith();
    await createDelete(fake.deps).deleteTransaction(context, HOUSEHOLD_ID, RECEIVED.id);
    expect(fake.accountTransactions.delete).toHaveBeenCalledWith(RECEIVED.id, expect.anything());
    expect(fake.accountTransactions.delete).toHaveBeenCalledWith(SENT.id, expect.anything());
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(SAVINGS.id, expect.objectContaining({
      amount: -5_000,
    }));
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(CHECKING.id, expect.objectContaining({
      amount: 5_000,
    }));
  });

  it('refuses a member who can\'t edit the other side\'s account', async () => {
    const fake = fakeWith();
    fake.authorization.authorize.mockResolvedValueOnce({ outcome: 'allowed', role: 'Owner' })
      .mockResolvedValueOnce({ outcome: 'not_visible' });
    await expect(createDelete(fake.deps).deleteTransaction(context, HOUSEHOLD_ID, SENT.id))
      .rejects.toMatchObject({ domainError: { code: 'auth.forbidden' } });
    expect(fake.inTransaction).not.toHaveBeenCalled();
  });

  it('answers not found when the other side went meanwhile', async () => {
    const fake = fakeWith(undefined, [SENT]);
    await expect(createDelete(fake.deps).deleteTransaction(context, HOUSEHOLD_ID, SENT.id))
      .rejects.toMatchObject({ domainError: { code: 'transaction.not_found' } });
  });
});

describe('editing a transfer between own accounts (OQ-222)', () => {
  it('edits both sides as one — the amount is what was sent', async () => {
    const fake = fakeWith();
    const edited = await createEdit(fake.deps).editTransaction(context, HOUSEHOLD_ID, RECEIVED.id, {
      amount: 7_000, date: '2026-10-14', description: 'Reserve',
    });
    const changes = {
      date: '2026-10-14',
      amount: 7_000,
      categoryId: null,
      subcategoryId: null,
      description: 'Reserve',
    };
    expect(fake.accountTransactions.update)
      .toHaveBeenCalledWith(SENT.id, expect.anything(), changes);
    expect(fake.accountTransactions.update)
      .toHaveBeenCalledWith(RECEIVED.id, expect.anything(), changes);
    expect(fake.inTransaction).toHaveBeenCalledTimes(1);
    expect(edited.transaction.id).toBe(RECEIVED.id);
  });

  it('keeps each side\'s amount across currencies, changing the one received', async () => {
    const received = {
      ...RECEIVED, accountId: DOLLARS.id, amount: 950, currency: 'USD',
    };
    const fake = fakeWith(undefined, [SENT, received]);
    const edited = await createEdit(fake.deps)
      .editTransaction(context, HOUSEHOLD_ID, SENT.id, { receivedAmount: 980 });
    expect(fake.accountTransactions.update)
      .toHaveBeenCalledWith(SENT.id, expect.anything(), expect.objectContaining({ amount: 5_000 }));
    expect(fake.accountTransactions.update)
      .toHaveBeenCalledWith(RECEIVED.id, expect.anything(), expect.objectContaining({
        amount: 980,
      }));
    expect(edited.transaction.id).toBe(SENT.id);
  });

  it('keeps the amount received when only the date changes', async () => {
    const received = {
      ...RECEIVED, accountId: DOLLARS.id, amount: 950, currency: 'USD',
    };
    const fake = fakeWith(undefined, [SENT, received]);
    await createEdit(fake.deps)
      .editTransaction(context, HOUSEHOLD_ID, SENT.id, { date: '2026-10-20' });
    expect(fake.accountTransactions.update)
      .toHaveBeenCalledWith(RECEIVED.id, expect.anything(), expect.objectContaining({
        amount: 950,
      }));
  });

  it('refuses an amount received within one currency', async () => {
    const fake = fakeWith();
    await expect(createEdit(fake.deps)
      .editTransaction(context, HOUSEHOLD_ID, SENT.id, { receivedAmount: 10 }))
      .rejects.toMatchObject({
        domainError: {
          code: 'validation.failed',
          details: [{ field: 'receivedAmount', code: 'field.invalid' }],
        },
      });
  });

  it('refuses a category — neither spend nor income', async () => {
    const fake = fakeWith();
    await expect(createEdit(fake.deps)
      .editTransaction(context, HOUSEHOLD_ID, SENT.id, { categoryId: 'food' }))
      .rejects.toMatchObject({ domainError: { code: 'validation.failed' } });
  });

  it('writes nothing when what is sent is what is stored', async () => {
    const fake = fakeWith();
    const edited = await createEdit(fake.deps).editTransaction(context, HOUSEHOLD_ID, SENT.id, {
      date: SENT.date, amount: SENT.amount, description: SENT.description,
    });
    expect(edited.transaction).toBe(SENT);
    expect(fake.inTransaction).not.toHaveBeenCalled();
  });

  it('writes both sides in their accounts\' order, whichever is asked for', async () => {
    const fake = fakeWith();
    await createEdit(fake.deps)
      .editTransaction(context, HOUSEHOLD_ID, RECEIVED.id, { amount: 6_000 });
    await createDelete(fake.deps).deleteTransaction(context, HOUSEHOLD_ID, SENT.id);
    // CHECKING (…a2) sorts before SAVINGS (…a3): its side always goes first.
    const updated = fake.accountTransactions.update.mock.calls.map(([id]) => id);
    const deleted = fake.accountTransactions.delete.mock.calls
      .map((call) => (call as unknown[])[0]);
    expect(updated).toEqual([SENT.id, RECEIVED.id]);
    expect(deleted).toEqual([SENT.id, RECEIVED.id]);
  });

  it('reads the row back unaudited when nothing is sent', async () => {
    const fake = fakeWith();
    const edited = await createEdit(fake.deps).editTransaction(context, HOUSEHOLD_ID, SENT.id, {});
    expect(edited.transaction).toBe(SENT);
    expect(fake.inTransaction).not.toHaveBeenCalled();
  });
});
