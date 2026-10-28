import { describe, expect, it } from 'vitest';
import type { BusMessage } from '../../../../src/utilities/serviceBus';
import type { CorrelationId } from '../../../../src/utilities/correlationId';
import { createEventHandlers } from '../../../../src/managers/transaction/events';
import {
  ACCOUNT, HOUSEHOLD_ID, MARKET_HOLDING, NOW, fakeDeps,
} from './fakes';

// What TransactionManager does when the daily job announces a due schedule
// entry (VBD §3.2a): it posts through the exact Record pipeline as the system,
// with `markEntryPosted` first in the same transaction — a second delivery of
// the event finds it posted and does nothing more (OQ-171).

const handlersOf = (fake: ReturnType<typeof fakeDeps>) => createEventHandlers(fake.deps);

/** A due-entry event, as the daily job publishes it. */
const message = (
  over: Partial<BusMessage<'transaction.import.requested'>['payload']> = {},
): BusMessage<'transaction.import.requested'> => ({
  topic: 'transaction.import.requested',
  payload: {
    scheduleEntryId: 'e1',
    householdId: HOUSEHOLD_ID,
    accountId: ACCOUNT.id,
    holdingId: MARKET_HOLDING.id,
    kind: 'investment_interest',
    amount: 500,
    date: '2026-10-13',
    ...over,
  },
  correlationId: 'corr-1' as CorrelationId,
  publishedAt: NOW,
});

describe('postScheduledEntry (VBD §3.2a)', () => {
  it('posts a due entry through the Record pipeline as the system (OQ-171)', async () => {
    const fake = fakeDeps();
    await handlersOf(fake).postScheduledEntry(message());
    expect(fake.holdings.markEntryPosted).toHaveBeenCalledWith('e1');
    // The row carries no user and its schedule provenance.
    expect(fake.accountTransactions.insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'investment_interest',
      source: 'schedule',
      createdByUserId: null,
      holdingId: MARKET_HOLDING.id,
      amount: 500,
    }));
    // Interest is money in — the Account rises; no position moves.
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(ACCOUNT.id, {
      amount: 500,
      currency: 'BRL',

      date: '2026-10-13',
    });
    expect(fake.holdings.applyTrade).not.toHaveBeenCalled();
  });

  it('posts nothing on a second delivery of the same event (OQ-171)', async () => {
    const fake = fakeDeps();
    // The first delivery already marked the entry posted.
    fake.holdings.markEntryPosted.mockResolvedValue(false);
    await handlersOf(fake).postScheduledEntry(message());
    expect(fake.accounts.applyMovement).not.toHaveBeenCalled();
    expect(fake.accountTransactions.insert).not.toHaveBeenCalled();
  });

  it('closes out an entry whose position is already zero — no retry loop', async () => {
    const fake = fakeDeps();
    fake.holdings.findById.mockResolvedValue({ ...MARKET_HOLDING, quantity: 0 });
    await handlersOf(fake).postScheduledEntry(message());
    expect(fake.holdings.markEntryPosted).toHaveBeenCalledWith('e1');
    expect(fake.accounts.applyMovement).not.toHaveBeenCalled();
    expect(fake.accountTransactions.insert).not.toHaveBeenCalled();
  });

  it('closes out a late entry on a Holding its user archived (FR-5.8)', async () => {
    const fake = fakeDeps();
    fake.holdings.findById.mockResolvedValue({
      ...MARKET_HOLDING,
      archivedAt: NOW,
      archivedBy: 'user' as const,
    });
    await handlersOf(fake).postScheduledEntry(message());
    expect(fake.holdings.markEntryPosted).toHaveBeenCalledWith('e1');
    expect(fake.accounts.applyMovement).not.toHaveBeenCalled();
    expect(fake.accountTransactions.insert).not.toHaveBeenCalled();
  });

  it('posts a redemption for the whole position, archiving at zero (FR-3.8)', async () => {
    const fake = fakeDeps();
    fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 0, costBasis: 0 });
    await handlersOf(fake).postScheduledEntry(message({
      kind: 'investment_redemption',
      amount: 10_000,
    }));
    // The whole position leaves at its full basis.
    expect(fake.holdings.applyTrade).toHaveBeenCalledWith(MARKET_HOLDING.id, {
      quantityDelta: -10,
      costBasisDelta: -10_000,
    });
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(ACCOUNT.id, {
      amount: 10_000,
      currency: 'BRL',

      date: '2026-10-13',
    });
    expect(fake.holdings.archive).toHaveBeenCalledWith(MARKET_HOLDING.id, 'system');
    // The automatic snapshot follows the redemption price.
    expect(fake.valuations.insertAutomatic).toHaveBeenCalledWith(
      expect.objectContaining({ valuation: 1_000, asOfDate: '2026-10-13' }),
    );
  });

  it('leaves a refused entry unposted for tomorrow — the error reaches the bus sink', async () => {
    const fake = fakeDeps();
    // The Account is gone meanwhile — the pipeline refuses, nothing is marked.
    fake.accounts.findById.mockResolvedValue(undefined);
    await expect(handlersOf(fake).postScheduledEntry(message()))
      .rejects.toMatchObject({ domainError: { code: 'account.not_found' } });
    expect(fake.holdings.markEntryPosted).not.toHaveBeenCalled();
  });

  it('throws loudly on a kind the reference data does not know', async () => {
    const fake = fakeDeps();
    await expect(handlersOf(fake).postScheduledEntry(message({ kind: 'nope' })))
      .rejects.toThrow('Unknown scheduled transaction kind');
  });

  it(
    'throws loudly on an entry whose Holding vanished (the FK makes this impossible)',
    async () => {
      const fake = fakeDeps();
      fake.holdings.findById.mockResolvedValue(undefined);
      await expect(handlersOf(fake).postScheduledEntry(message()))
        .rejects.toThrow('missing Holding');
    },
  );
});
