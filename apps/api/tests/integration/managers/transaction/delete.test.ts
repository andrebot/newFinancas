import { describe, expect, it } from 'vitest';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import createDelete from '../../../../src/managers/transaction/delete';
import {
  ACCOUNT, ANA_ID, BUY_ROW, CARD_ROW, FIXED_HOLDING, HOUSEHOLD_ID, MARKET_HOLDING, NOW, ROW,
  SELL_ROW,
  fakeDeps,
} from './fakes';

// Delete Transaction (CUC-3, FR-3.2/OQ-201 D7): every stored effect is undone
// and the row goes with a guarded write in one transaction — all or nothing
// (OQ-175). A buy that created its Holding takes it with it when nothing else
// references it; a fixed-term buy whose schedule has started stays.

const context: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};

/** The use case over one programmed fake. */
const deleteOf = (fake: ReturnType<typeof fakeDeps>) => createDelete(fake.deps);

describe('deleteTransaction', () => {
  it('refuses a transaction on neither ledger', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    fake.cardTransactions.findById.mockResolvedValue(undefined);
    await expect(deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, 'missing'))
      .rejects.toMatchObject({ domainError: { code: 'transaction.not_found' } });
  });

  it('reverses the stored movement and deletes the row (FR-3.2)', async () => {
    const fake = fakeDeps();
    await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, ROW.id);
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(ACCOUNT.id, {
      amount: 5_000,
      currency: 'BRL',

      date: ROW.date,
    });
    expect(fake.accountTransactions.delete).toHaveBeenCalledWith(
      ROW.id,
      expect.objectContaining({ amount: 5_000 }),
    );
  });

  it('reverses the card movement and deletes a charge (FR-3.9)', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, CARD_ROW.id);
    expect(fake.creditCards.applyMovement).toHaveBeenCalledWith(
      CARD_ROW.creditCardId,
      {
        amount: -5_000,

        currency: 'BRL',
        date: CARD_ROW.date,
      },
    );
    expect(fake.cardTransactions.delete).toHaveBeenCalledWith(
      CARD_ROW.id,
      expect.objectContaining({ amount: 5_000 }),
    );
    expect(fake.accounts.applyMovement).not.toHaveBeenCalled();
  });

  it('moves both sides back when a bill payment goes (FR-3.7)', async () => {
    const fake = fakeDeps();
    const payment = {
      ...ROW,
      id: 't5',
      kind: 'credit_card_bill_payment',
      effect: 'bill_payment' as const,
      creditCardId: CARD_ROW.creditCardId,

    };
    fake.accountTransactions.findById.mockResolvedValue(payment);
    await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, payment.id);
    expect(fake.accounts.applyMovement).toHaveBeenCalledWith(ACCOUNT.id, {
      amount: 5_000,
      currency: 'BRL',

      date: ROW.date,
    });
    expect(fake.creditCards.applyMovement).toHaveBeenCalledWith(
      CARD_ROW.creditCardId,
      {
        amount: 5_000,

        currency: 'BRL',
        date: ROW.date,
      },
    );
  });

  it('answers transaction.changed when the row changed meanwhile (OQ-203)', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.delete.mockResolvedValue('stale');
    await expect(deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, ROW.id))
      .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
  });

  it('answers transaction.changed when a card row changed meanwhile (OQ-203)', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    fake.cardTransactions.delete.mockResolvedValue('stale');
    await expect(deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, CARD_ROW.id))
      .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
  });

  it('answers validation.failed for a kind the reference data does not know', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue({ ...ROW, id: 't9', kind: 'bogus' });
    await expect(deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, 't9'))
      .rejects.toMatchObject({ domainError: { code: 'validation.failed' } });
  });

  describe('trades (OQ-171)', () => {
    it('deletes the Holding a buy created when nothing else references it', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(BUY_ROW);
      // Undoing the buy zeros the position; no other row names the Holding.
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 0, costBasis: 0 });
      await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, BUY_ROW.id);
      expect(fake.holdings.delete).toHaveBeenCalledWith(MARKET_HOLDING.id);
      expect(fake.holdings.archive).not.toHaveBeenCalled();
    });

    it('treats a buy row with no attached holding as market-priced — deletable', async () => {
      const fake = fakeDeps();
      // The FK makes this impossible; the guard must not treat it as fixed-term.
      fake.accountTransactions.findById.mockResolvedValue({
        ...BUY_ROW, id: 't8', holdingId: null, holding: null,
      });
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 0, costBasis: 0 });
      await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, 't8');
      expect(fake.accountTransactions.delete).toHaveBeenCalledWith('t8', expect.anything());
    });

    it('refuses a creator buy other transactions still reference (FR-5.8)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(BUY_ROW);
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 0, costBasis: 0 });
      fake.accountTransactions.countForHolding.mockResolvedValue(2);
      // The Holding was written in the same transaction as this buy.
      fake.holdings.findById.mockResolvedValue({ ...MARKET_HOLDING, createdAt: BUY_ROW.createdAt });
      await expect(deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, BUY_ROW.id))
        .rejects.toMatchObject({
          domainError: {
            code: 'transaction.holding_in_use',
            params: { count: 2 },
          },
        });
    });

    it('archives a zeroed re-buy like any other — the creator stays (FR-5.8)', async () => {
      const fake = fakeDeps();
      const rebuy = { ...BUY_ROW, id: 't9', createdAt: NOW };
      fake.accountTransactions.findById.mockResolvedValue(rebuy);
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 0, costBasis: 0 });
      fake.accountTransactions.countForHolding.mockResolvedValue(1);
      // The Holding predates this re-buy — it is not the creator.
      fake.holdings.findById.mockResolvedValue({
        ...MARKET_HOLDING,
        createdAt: new Date(NOW.getTime() - 86_400_000),
      });
      await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, rebuy.id);
      expect(fake.holdings.archive).toHaveBeenCalledWith(MARKET_HOLDING.id, 'system');
      expect(fake.holdings.delete).not.toHaveBeenCalled();
    });

    it(
      'restores the position and reopens a system archive when a zeroing sell goes (OQ-171)',
      async () => {
        const fake = fakeDeps();
        fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
        // Undoing the sell restores 10 units — the Holding comes back to life.
        fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 10, costBasis: 5_000 });
        await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, SELL_ROW.id);
        expect(fake.holdings.unarchiveIfSystemArchived).toHaveBeenCalledWith(MARKET_HOLDING.id);
      },
    );

    it('restores the old split a zeroing sell closed (OQ-171)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 10, costBasis: 5_000 });
      // The current split was written by this very sell — same transaction.
      fake.goals.listAllocations.mockResolvedValue([
        {
          id: 'a1',
          holdingId: MARKET_HOLDING.id,
          goalId: 'gA',
          percentage: 100,
          validFrom: SELL_ROW.date,
          createdAt: SELL_ROW.createdAt,
        },
      ]);
      await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, SELL_ROW.id);
      expect(fake.goals.deleteFrom).toHaveBeenCalledWith(MARKET_HOLDING.id, SELL_ROW.date);
      expect(fake.goals.reopenClosedAt).toHaveBeenCalledWith(MARKET_HOLDING.id, SELL_ROW.date);
    });

    it('leaves a later split alone — only its own write is undone (OQ-171)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 10, costBasis: 5_000 });
      // A later trade owns the present split — different transaction.
      fake.goals.listAllocations.mockResolvedValue([
        {
          id: 'a2',
          holdingId: MARKET_HOLDING.id,
          goalId: 'gA',
          percentage: 100,
          validFrom: '2026-10-20',
          createdAt: new Date(NOW.getTime() + 86_400_000),
        },
      ]);
      await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, SELL_ROW.id);
      expect(fake.goals.deleteFrom).not.toHaveBeenCalled();
      expect(fake.goals.reopenClosedAt).not.toHaveBeenCalled();
    });

    it('refuses a trade the Holding refuses — insufficient quantity (OQ-171)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.applyTrade.mockResolvedValue({ ok: false, reason: 'insufficient_quantity' });
      await expect(deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, SELL_ROW.id))
        .rejects.toMatchObject({ domainError: { code: 'holding.insufficient_quantity' } });
    });
  });

  describe('fixed-term buys (OQ-201 D7)', () => {
    const buyRow = {
      ...BUY_ROW,
      id: 't7',
      holdingId: FIXED_HOLDING.id,
      holding: {
        ticker: 'CDB1',
        assetType: 'cdb',
      },
    };

    it('refuses a delete once the schedule has posted — no writes at all', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      fake.holdings.listSchedule.mockResolvedValue([{ postedAt: NOW }]);
      await expect(deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, buyRow.id))
        .rejects.toMatchObject({ domainError: { code: 'transaction.schedule_started' } });
      expect(fake.accounts.applyMovement).not.toHaveBeenCalled();
      expect(fake.accountTransactions.delete).not.toHaveBeenCalled();
    });

    it('deletes an unlocked fixed-term buy with its effects', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 0, costBasis: 0 });
      await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, buyRow.id);
      expect(fake.accounts.applyMovement).toHaveBeenCalledWith(ACCOUNT.id, {
        amount: 2_000,
        currency: 'BRL',

        date: BUY_ROW.date,
      });
      expect(fake.holdings.delete).toHaveBeenCalledWith(FIXED_HOLDING.id);
    });
  });

  it('un-accrues the Budget a row names (OQ-201 D4)', async () => {
    const fake = fakeDeps();
    const categorized = { ...ROW, categoryId: 'c1' };
    fake.accountTransactions.findById.mockResolvedValue(categorized);
    await deleteOf(fake).deleteTransaction(context, HOUSEHOLD_ID, ROW.id);
    expect(fake.budgets.accrueIfClaimed).toHaveBeenCalledTimes(1);
    expect(fake.budgets.accrueIfClaimed.mock.calls[0]?.[0]?.amount).toBe(-5_000);
  });
});
