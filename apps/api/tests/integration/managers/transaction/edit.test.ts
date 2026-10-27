import { describe, expect, it } from 'vitest';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import createEdit from '../../../../src/managers/transaction/edit';
import {
  ACCOUNT, ANA_ID, BUY_ROW, CARD_ROW, CHECKING, FIXED_HOLDING, HOUSEHOLD_ID, MARKET_HOLDING, NOW,
  ROW, SELL_ROW, fakeDeps,
} from './fakes';

// Edit Transaction (CUC-2, OQ-201 D6/D8): values only — kind and target never
// change. The stored effects are reversed, reapplied with the new values and
// the row guarded-updates in one transaction; a concurrent write is 409
// `transaction.changed` (OQ-203).

const context: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};

/** The use case over one programmed fake. */
const editOf = (fake: ReturnType<typeof fakeDeps>) => createEdit(fake.deps);

describe('editTransaction', () => {
  it('refuses a transaction on neither ledger', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    fake.cardTransactions.findById.mockResolvedValue(undefined);
    await expect(editOf(fake).editTransaction(context, HOUSEHOLD_ID, 'missing', { amount: 1 }))
      .rejects.toMatchObject({ domainError: { code: 'transaction.not_found' } });
  });

  it('refuses a row whose kind the reference data does not know', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue({ ...ROW, kind: 'nope' });
    await expect(editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { amount: 7_000 }))
      .rejects.toMatchObject({
        domainError: {
          code: 'validation.failed',
          details: [{
            field: 'kind',
            code: 'field.invalid_option',
          }],
        },
      });
  });

  it('refuses a cash row whose Account vanished', async () => {
    const fake = fakeDeps();
    fake.accounts.findById.mockResolvedValue(undefined);
    await expect(editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { amount: 7_000 }))
      .rejects.toMatchObject({ domainError: { code: 'transaction.not_found' } });
  });

  describe('cash rows (FR-3.2)', () => {
    it('reverses the stored movement, reapplies the new one and guarded-updates', async () => {
      const fake = fakeDeps();
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { amount: 7_000 });
      // A withdrawal moved -5000; undo it (+5000), then move the new value (-7000).
      expect(fake.accounts.applyMovement).toHaveBeenNthCalledWith(1, ACCOUNT.id, {
        amount: 5_000,
        currency: 'BRL',
        date: ROW.date,
      });
      expect(fake.accounts.applyMovement).toHaveBeenNthCalledWith(2, ACCOUNT.id, {
        amount: -7_000,
        currency: 'BRL',
        date: ROW.date,
      });
      expect(fake.accountTransactions.update).toHaveBeenCalledWith(
        ROW.id,
        expect.objectContaining({ amount: 5_000 }),

        expect.objectContaining({ amount: 7_000 }),
      );
    });

    it('answers transaction.changed when the row changed meanwhile (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.update.mockResolvedValue({ status: 'stale' });
      await expect(editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { amount: 7_000 }))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers transaction.changed when the Account movement loses a race (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accounts.applyMovement.mockResolvedValue({ ok: false });
      await expect(editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { amount: 7_000 }))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('refuses a field the kind does not take (OQ-201 D6)', async () => {
      const fake = fakeDeps();
      await expect(editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { quantity: 3 }))
        .rejects.toMatchObject({
          domainError: {
            code: 'validation.failed',
            details: [{
              field: 'quantity',

              code: 'object.unknown_keys',
            }],
          },
        });
    });

    it('returns the row untouched when nothing changes — no writes, no audit', async () => {
      const fake = fakeDeps();
      const edited = await editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, {});
      expect(edited.transaction).toBe(ROW);
      expect(fake.accounts.applyMovement).not.toHaveBeenCalled();
      expect(fake.accountTransactions.update).not.toHaveBeenCalled();
    });

    it('reapplies the movement on the new date when only the date changes', async () => {
      const fake = fakeDeps();
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { date: '2026-10-14' });
      expect(fake.accounts.applyMovement).toHaveBeenNthCalledWith(2, ACCOUNT.id, {
        amount: -5_000,
        currency: 'BRL',
        date: '2026-10-14',
      });
    });

    it('answers transaction.changed when the cash reapply loses a race (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accounts.applyMovement
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false });
      await expect(editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { amount: 7_000 }))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('refuses a Category that does not exist', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue(undefined);
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        ROW.id,
        { categoryId: 'gone' },
      ))
        .rejects.toMatchObject({ domainError: { code: 'category.not_found' } });
    });

    it('refuses a Subcategory the Category does not hold', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue({
        id: 'c1',
        archivedAt: null,
        subcategories: [{ id: 's1' }],
      });
      await expect(editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, {
        categoryId: 'c1',
        subcategoryId: 's9',
      }))
        .rejects.toMatchObject({ domainError: { code: 'transaction.subcategory_mismatch' } });
    });

    it('drops the Subcategory when the Category is cleared (OQ-201)', async () => {
      const fake = fakeDeps();
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, {
        categoryId: null,
        subcategoryId: 's1',
      });
      expect(fake.accountTransactions.update).toHaveBeenCalledWith(
        ROW.id,
        expect.anything(),
        expect.objectContaining({
          categoryId: null,

          subcategoryId: null,
        }),
      );
    });
  });

  describe('card rows (FR-3.9)', () => {
    it('reverses and reapplies the card movement only — no Account', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(undefined);
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, CARD_ROW.id, { amount: 6_000 });
      expect(fake.creditCards.applyMovement).toHaveBeenNthCalledWith(
        1,
        CARD_ROW.creditCardId,
        {
          amount: -5_000,

          currency: 'BRL',
          date: CARD_ROW.date,
        },
      );
      expect(fake.creditCards.applyMovement).toHaveBeenNthCalledWith(
        2,
        CARD_ROW.creditCardId,
        {
          amount: 6_000,

          currency: 'BRL',
          date: CARD_ROW.date,
        },
      );
      expect(fake.accounts.applyMovement).not.toHaveBeenCalled();
    });

    it('answers transaction.changed when the card row changed meanwhile (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(undefined);
      fake.cardTransactions.update.mockResolvedValue({ status: 'stale' });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        CARD_ROW.id,
        { amount: 6_000 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('refuses a card row whose Account vanished', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(undefined);
      fake.accounts.findById.mockResolvedValue(undefined);
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        CARD_ROW.id,
        { amount: 6_000 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.not_found' } });
    });

    it('answers transaction.changed when the card reapply loses a race (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(undefined);
      fake.creditCards.applyMovement
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        CARD_ROW.id,
        { amount: 6_000 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });
  });

  describe('bill payments (FR-3.7)', () => {
    it('moves both sides back and forth — the Account and its card', async () => {
      const fake = fakeDeps();
      const payment = {
        ...ROW,
        id: 't5',
        kind: 'credit_card_bill_payment',
        effect: 'bill_payment' as const,
        creditCardId: CARD_ROW.creditCardId,

      };
      fake.accountTransactions.findById.mockResolvedValue(payment);
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, payment.id, { amount: 8_000 });
      // The payment moved the Account -5000 and the card -5000; undo both, reapply at 8000.
      expect(fake.accounts.applyMovement).toHaveBeenNthCalledWith(1, ACCOUNT.id, {
        amount: 5_000,
        currency: 'BRL',
        date: ROW.date,
      });
      expect(fake.creditCards.applyMovement).toHaveBeenNthCalledWith(
        1,
        CARD_ROW.creditCardId,
        {
          amount: 5_000,

          currency: 'BRL',
          date: ROW.date,
        },
      );
      expect(fake.accounts.applyMovement).toHaveBeenNthCalledWith(2, ACCOUNT.id, {
        amount: -8_000,
        currency: 'BRL',
        date: ROW.date,
      });
      expect(fake.creditCards.applyMovement).toHaveBeenNthCalledWith(
        2,
        CARD_ROW.creditCardId,
        {
          amount: -8_000,

          currency: 'BRL',
          date: ROW.date,
        },
      );
    });

    it(
      'answers transaction.changed when the bill-payment reversal loses a race (OQ-203)',
      async () => {
        const fake = fakeDeps();
        const payment = {
          ...ROW,
          id: 't8',
          kind: 'credit_card_bill_payment' as const,
          effect: 'bill_payment' as const,
          creditCardId: CARD_ROW.creditCardId,
        };
        fake.accountTransactions.findById.mockResolvedValue(payment);
        fake.creditCards.applyMovement.mockResolvedValue({ ok: false });
        await expect(editOf(fake).editTransaction(
          context,
          HOUSEHOLD_ID,
          payment.id,
          { amount: 8_000 },
        ))
          .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
      },
    );

    it(
      'answers transaction.changed when the bill-payment card reapply loses a race (OQ-203)',
      async () => {
        const fake = fakeDeps();
        const payment = {
          ...ROW,
          id: 't9',
          kind: 'credit_card_bill_payment' as const,
          effect: 'bill_payment' as const,
          creditCardId: CARD_ROW.creditCardId,
        };
        fake.accountTransactions.findById.mockResolvedValue(payment);
        fake.creditCards.applyMovement
          .mockResolvedValueOnce({ ok: true })
          .mockResolvedValueOnce({ ok: false });
        await expect(editOf(fake).editTransaction(
          context,
          HOUSEHOLD_ID,
          payment.id,
          { amount: 8_000 },
        ))
          .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
      },
    );
  });

  describe('trades (OQ-171)', () => {
    it('reverses the stored deltas and reapplies at average cost — not last-in price', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      // The sell took -3 units / -1500 basis; undoing restores 10 units / 5000.
      fake.holdings.applyTrade.mockResolvedValueOnce({ ok: true, quantity: 10, costBasis: 5_000 })
        .mockResolvedValueOnce({ ok: true, quantity: 8, costBasis: 4_000 });
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, SELL_ROW.id, { quantity: 2 });
      expect(fake.holdings.applyTrade).toHaveBeenNthCalledWith(
        1,
        MARKET_HOLDING.id,
        {
          quantityDelta: 3,

          costBasisDelta: 1_500,
        },
      );
      // 2 of the restored 10 at average cost 500/unit.
      expect(fake.holdings.applyTrade).toHaveBeenNthCalledWith(
        2,
        MARKET_HOLDING.id,
        {
          quantityDelta: -2,

          costBasisDelta: -1_000,
        },
      );
      expect(fake.accountTransactions.update).toHaveBeenCalledWith(
        SELL_ROW.id,
        expect.anything(),
        expect.objectContaining({ trade: { quantityDelta: -2, costBasisDelta: -1_000 } }),
      );
    });

    it('refuses a redemption that is no longer the whole position after the reversal', async () => {
      const fake = fakeDeps();
      const redemption = { ...SELL_ROW, id: 't6', kind: 'investment_redemption' as const };
      fake.accountTransactions.findById.mockResolvedValue(redemption);
      // Undoing restores 10 units; the stored quantity was 3 — not the whole.
      fake.holdings.applyTrade.mockResolvedValueOnce({ ok: true, quantity: 10, costBasis: 5_000 });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        redemption.id,
        { description: 'still whole' },
      ))
        .rejects.toMatchObject({
          domainError: {
            code: 'validation.failed',
            details: [{
              field: 'quantity',

              code: 'field.invalid',
            }],
          },
        });
    });

    it('answers transaction.changed when the Holding moved meanwhile (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.findById.mockResolvedValue({ ...MARKET_HOLDING, accountId: CHECKING.id });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        SELL_ROW.id,
        { quantity: 2 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('refuses a trade on a Holding its user archived (OQ-171)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.findById.mockResolvedValue({
        ...MARKET_HOLDING,
        archivedAt: NOW,
        archivedBy: 'user' as const,
      });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        SELL_ROW.id,
        { quantity: 2 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'holding.archived' } });
    });

    it('refreshes the automatic snapshot when a market-priced trade changes', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.applyTrade.mockResolvedValueOnce({ ok: true, quantity: 10, costBasis: 5_000 })
        .mockResolvedValueOnce({ ok: true, quantity: 8, costBasis: 4_000 });
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, SELL_ROW.id, {
        amount: 2_000,
        quantity: 2,
      });
      expect(fake.valuations.updateAutomatic).toHaveBeenCalledWith(SELL_ROW.id, {
        valuation: 1_000,
        asOfDate: '2026-10-13',
      });
    });

    it('refuses a trade the Holding refuses — insufficient quantity (OQ-171)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.applyTrade.mockResolvedValueOnce({ ok: true, quantity: 10, costBasis: 5_000 })
        .mockResolvedValueOnce({ ok: false, reason: 'insufficient_quantity' });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        SELL_ROW.id,
        { quantity: 2 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'holding.insufficient_quantity' } });
    });

    it('maps a vanished Holding to its error when reversing', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.applyTrade.mockResolvedValue({ ok: false, reason: 'holding_not_found' });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        SELL_ROW.id,
        { quantity: 2 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    });

    it('maps a cost-basis refusal to its error when reapplying', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.applyTrade.mockResolvedValueOnce({ ok: true, quantity: 10, costBasis: 5_000 })
        .mockResolvedValueOnce({ ok: false, reason: 'cost_basis_below_zero' });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        SELL_ROW.id,
        { quantity: 2 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'holding.cost_basis_below_zero' } });
    });

    it('auto-archives the Holding when an edited sell zeroes it (OQ-171)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.applyTrade.mockResolvedValueOnce({ ok: true, quantity: 10, costBasis: 5_000 })
        .mockResolvedValueOnce({ ok: true, quantity: 0, costBasis: 0 });
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, SELL_ROW.id, { quantity: 10 });
      expect(fake.holdings.archive).toHaveBeenCalledWith(MARKET_HOLDING.id, 'system');
    });

    it('refuses a trade whose Holding vanished', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      fake.holdings.findById.mockResolvedValue(undefined);
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        SELL_ROW.id,
        { quantity: 2 },
      ))
        .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    });
  });

  describe('fixed-term buys (OQ-201 D8)', () => {
    const buyRow = {
      ...BUY_ROW,
      id: 't7',
      holdingId: FIXED_HOLDING.id,
      holding: {
        ticker: 'CDB1',
        assetType: 'cdb',
      },
    };

    it(
      'locks its terms once the schedule has posted — only category and description stay open',
      async () => {
        const fake = fakeDeps();
        fake.accountTransactions.findById.mockResolvedValue(buyRow);
        fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
        fake.holdings.listSchedule.mockResolvedValue([{ postedAt: NOW }]);
        await expect(editOf(fake).editTransaction(
          context,
          HOUSEHOLD_ID,
          buyRow.id,
          { amount: 60_000 },
        ))
          .rejects.toMatchObject({ domainError: { code: 'transaction.schedule_started' } });
      },
    );

    it('still takes a description while locked', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      fake.holdings.listSchedule.mockResolvedValue([{ postedAt: NOW }]);
      await editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        buyRow.id,
        { description: 'locked but noted' },
      );
      expect(fake.accountTransactions.update).toHaveBeenCalledWith(
        buyRow.id,
        expect.anything(),
        expect.objectContaining({ description: 'locked but noted' }),
      );
    });

    it('writes new terms and recomputes the schedule while unlocked (OQ-205)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      await editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        buyRow.id,
        { dueDate: '2027-01-15' },
      );
      expect(fake.holdings.updateTerms).toHaveBeenCalledWith(
        FIXED_HOLDING.id,
        expect.objectContaining({ rateType: 'ipca', dueDate: '2026-12-01' }),
        { dueDate: '2027-01-15' },
      );
      expect(fake.investmentProducts.schedule).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        expect.objectContaining({
          assetType: 'cdb',

          dueDate: '2027-01-15',
        }),
      );
      expect(fake.holdings.applySchedule).toHaveBeenCalled();
    });

    it('refuses terms the index cannot price (OQ-205)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      fake.investmentProducts.schedule.mockResolvedValue({
        ok: false,
        reason: 'index_missing',
        indexCode: 'ipca',
      });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        buyRow.id,
        { dueDate: '2027-01-15' },
      ))
        .rejects.toMatchObject({
          domainError: {
            code: 'index_rate.missing',
            params: { indexCode: 'ipca' },
          },
        });
    });

    it('refuses a dueDate not after the buy date (OQ-205)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        buyRow.id,
        { dueDate: '2026-10-13' },
      ))
        .rejects.toMatchObject({
          domainError: {
            code: 'validation.failed',
            details: [{
              field: 'dueDate',

              code: 'date.min',
            }],
          },
        });
    });

    it('writes a new rate, keeping the terms the row does not touch (OQ-205)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue({ ...FIXED_HOLDING, interestPayment: null });
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, buyRow.id, {
        rate: {
          type: 'ipca',
          value: 3,
        },
      });
      expect(fake.holdings.updateTerms).toHaveBeenCalledWith(
        FIXED_HOLDING.id,
        expect.anything(),
        expect.objectContaining({
          rate: expect.objectContaining({
            rateType: 'ipca',
            rateValue: 3,
          }),
        }),
      );
      // The computed terms default the missing interest payment (OQ-205).
      expect(
        fake.investmentProducts.schedule.mock.calls[0]![1],
      ).toMatchObject({ interestPayment: 'at_maturity' });
    });

    it(
      'writes a new interest payment, keeping the terms the row does not touch (OQ-205)',
      async () => {
        const fake = fakeDeps();
        fake.accountTransactions.findById.mockResolvedValue(buyRow);
        fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
        await editOf(fake).editTransaction(
          context,
          HOUSEHOLD_ID,
          buyRow.id,
          { interestPayment: 'monthly' },
        );
        expect(fake.holdings.updateTerms).toHaveBeenCalledWith(
          FIXED_HOLDING.id,
          expect.anything(),
          expect.objectContaining({ interestPayment: 'monthly' }),
        );
      },
    );

    it('writes a new incentivised flag on a debenture (OQ-79)', async () => {
      const fake = fakeDeps();
      const debRow = {
        ...buyRow,
        holdingId: 'deb1',
        holding: {
          ticker: 'DEB1',
          assetType: 'debenture',
        },
      };
      fake.accountTransactions.findById.mockResolvedValue(debRow);
      fake.holdings.findById.mockResolvedValue({
        ...FIXED_HOLDING,
        id: 'deb1',
        assetType: 'debenture',
        incentivised: false,
      });
      await editOf(fake).editTransaction(context, HOUSEHOLD_ID, debRow.id, { incentivised: true });
      expect(fake.holdings.updateTerms).toHaveBeenCalledWith(
        'deb1',
        expect.objectContaining({ incentivised: false }),
        expect.objectContaining({ incentivised: true }),
      );
      // The computed terms carry the new flag to the Engine (OQ-79).
      expect(
        fake.investmentProducts.schedule.mock.calls[0]![1],
      ).toMatchObject({ incentivised: true });
    });

    it('answers transaction.changed when the terms update loses a race (OQ-205)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      fake.holdings.updateTerms.mockResolvedValue({ status: 'stale' });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        buyRow.id,
        { dueDate: '2027-01-15' },
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers schedule.started when the schedule has already started (OQ-205)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      fake.holdings.applySchedule.mockResolvedValue({ ok: false, reason: 'schedule_started' });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        buyRow.id,
        { dueDate: '2027-01-15' },
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.schedule_started' } });
    });

    it('answers transaction.changed on another schedule refusal (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(buyRow);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      fake.holdings.applySchedule.mockResolvedValue({ ok: false, reason: 'holding_not_found' });
      await expect(editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        buyRow.id,
        { dueDate: '2027-01-15' },
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('leaves the snapshot alone on a fixed-term trade', async () => {
      const fake = fakeDeps();
      const redemption = {
        ...SELL_ROW, id: 't10', kind: 'investment_redemption' as const, holdingId: FIXED_HOLDING.id,
      };
      fake.accountTransactions.findById.mockResolvedValue(redemption);
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      // Undoing restores the whole position — a redemption stays the whole.
      fake.holdings.applyTrade.mockResolvedValueOnce({ ok: true, quantity: 3, costBasis: 1_500 });
      await editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        redemption.id,
        { description: 'no snapshot' },
      );
      expect(fake.valuations.updateAutomatic).not.toHaveBeenCalled();
    });

    it('keeps the snapshot when a market trade edit moves nothing', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.findById.mockResolvedValue(SELL_ROW);
      await editOf(fake).editTransaction(
        context,
        HOUSEHOLD_ID,
        SELL_ROW.id,
        { description: 'just words' },
      );
      expect(fake.valuations.updateAutomatic).not.toHaveBeenCalled();
    });
  });

  it('refuses a term on a kind that has none (OQ-201 D6)', async () => {
    const fake = fakeDeps();
    await expect(editOf(fake).editTransaction(
      context,
      HOUSEHOLD_ID,
      ROW.id,
      { dueDate: '2027-01-15' },
    ))
      .rejects.toMatchObject({
        domainError: {
          code: 'validation.failed',
          details: [{
            field: 'dueDate',

            code: 'object.unknown_keys',
          }],
        },
      });
  });

  it('answers transaction.changed when the card movement loses a race (OQ-203)', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    fake.creditCards.applyMovement.mockResolvedValue({ ok: false });
    await expect(editOf(fake).editTransaction(
      context,
      HOUSEHOLD_ID,
      CARD_ROW.id,
      { amount: 6_000 },
    ))
      .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
  });

  it('un-accrues and re-accrues the Budget a row names (OQ-201 D4)', async () => {
    const fake = fakeDeps();
    const categorized = { ...ROW, categoryId: 'c1', subcategoryId: null };
    fake.accountTransactions.findById.mockResolvedValue(categorized);
    await editOf(fake).editTransaction(context, HOUSEHOLD_ID, ROW.id, { amount: 7_000 });
    expect(fake.budgets.accrueIfClaimed).toHaveBeenCalledTimes(2);
    // The reversal undoes the stored accrual; the reapply books the new value.
    const [first, second] = fake.budgets.accrueIfClaimed.mock.calls.map((call) => call[0]);
    expect(first?.amount).toBe(-5_000);
    expect(second?.amount).toBe(7_000);
  });
});
