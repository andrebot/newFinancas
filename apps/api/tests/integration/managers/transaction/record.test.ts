import { describe, expect, it } from 'vitest';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import createRecord, { type TransactionCreate } from '../../../../src/managers/transaction/record';
import {
  ACCOUNT, ANA_ID, CARD, CARD_ROW, CHECKING, FIXED_HOLDING, GOAL, HOUSEHOLD_ID, MARKET_HOLDING,
  NOW, ROW, fakeDeps,
} from './fakes';

// Record Transaction (CUC-1, FR-3): the Manager decides which side effect a kind
// makes and what its parameters are; each Accessor executes one validated write.
// The tier below is mocked (BDT); every response state it can emit is handled.

const context: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};

// A request builder: defaults plus overrides, with unset keys dropped — an
// explicit `undefined` is not a field (it cannot arrive over HTTP either).
const asRequest = (request: Record<string, unknown>): TransactionCreate => (
  Object.fromEntries(Object.entries(request).filter(([,
    value]) => value !== undefined)) as unknown as TransactionCreate
);

const cashRequest = (over: Partial<TransactionCreate> = {}): TransactionCreate => asRequest({
  kind: 'withdrawal',
  date: '2026-10-13',
  amount: 5_000,
  currency: 'BRL',
  accountId: ACCOUNT.id,
  ...over,
});

/** The use case over one programmed fake. */
const recordOf = (fake: ReturnType<typeof fakeDeps>) => createRecord(fake.deps);

const buyRequest = (over: Partial<TransactionCreate> = {}): TransactionCreate => asRequest({
  kind: 'investment_buy',
  date: '2026-10-13',
  amount: 2_000,
  currency: 'BRL',
  accountId: ACCOUNT.id,
  assetType: 'stock',
  ticker: 'PETR4',
  quantity: 2,
  ...over,
});

const sellRequest = (over: Partial<TransactionCreate> = {}): TransactionCreate => asRequest({
  kind: 'investment_sell',
  date: '2026-10-13',
  amount: 5_000,
  currency: 'BRL',
  accountId: ACCOUNT.id,
  holdingId: MARKET_HOLDING.id,
  quantity: 4,
  ...over,
});

describe('recordTransaction', () => {
  it('refuses a kind the reference data does not know', async () => {
    const fake = fakeDeps();
    await expect(recordOf(fake).recordTransaction(
      context,
      HOUSEHOLD_ID,
      cashRequest({ kind: 'nope' }),
    ))
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

  describe('card ledger (FR-3.9)', () => {
    it('moves the outstanding balance and writes the row, no Account movement', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue(CHECKING);
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest({
        kind: 'charge',
        accountId: undefined,
        creditCardId: CARD.id,
      }));
      expect(fake.cardTransactions.insert).toHaveBeenCalledWith(expect.objectContaining({
        creditCardId: CARD.id, kind: 'charge', amount: 5_000, createdByUserId: ANA_ID,
      }));
      expect(fake.creditCards.applyMovement).toHaveBeenCalledWith(CARD.id, {
        amount: 5_000,
        currency: 'BRL',

        date: '2026-10-13',
      });
      expect(fake.accounts.applyMovement).not.toHaveBeenCalled();
    });

    it('lowers the outstanding balance for a refund', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue(CHECKING);
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest({
        kind: 'refund',
        accountId: undefined,
        creditCardId: CARD.id,
      }));
      expect(fake.creditCards.applyMovement).toHaveBeenCalledWith(CARD.id, {
        amount: -5_000,
        currency: 'BRL',

        date: '2026-10-13',
      });
    });

    it('accrues the Budget a charge names (OQ-201 D4)', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue(CHECKING);
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest({
        kind: 'charge', accountId: undefined, creditCardId: CARD.id, categoryId: 'c1',
      }));
      expect(fake.budgets.accrueIfClaimed).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5_000, categoryId: 'c1' }),
      );
    });

    it('answers transaction.changed when the card insert loses a race (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue(CHECKING);
      fake.cardTransactions.insert.mockResolvedValue({ ok: false, transaction: CARD_ROW });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({
          kind: 'charge',

          accountId: undefined,
          creditCardId: CARD.id,
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });
  });

  describe('account cash (FR-3)', () => {
    it('debits the Account for a withdrawal and writes its row', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest());
      expect(fake.accountTransactions.insert).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: ACCOUNT.id, effect: 'movement' }),
      );
      expect(fake.accounts.applyMovement).toHaveBeenCalledWith(ACCOUNT.id, {
        amount: -5_000,
        currency: 'BRL',

        date: '2026-10-13',
      });
    });

    it('reduces the claiming Budget for money in (OQ-201 D4)', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest({
        kind: 'deposit',
        categoryId: 'c1',
      }));
      expect(fake.budgets.accrueIfClaimed).toHaveBeenCalledWith(
        expect.objectContaining({ amount: -5_000, categoryId: 'c1' }),
      );
    });

    it('moves both ledgers for a bill payment (FR-3.7)', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue(CHECKING);
      await recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({
          kind: 'credit_card_bill_payment',

          accountId: CHECKING.id,
          creditCardId: CARD.id,
        }),
      );
      expect(fake.accountTransactions.insert).toHaveBeenCalledWith(
        expect.objectContaining({ effect: 'bill_payment', creditCardId: CARD.id }),
      );
      expect(fake.accounts.applyMovement).toHaveBeenCalledWith(CHECKING.id, {
        amount: -5_000,
        currency: 'BRL',

        date: '2026-10-13',
      });
      expect(fake.creditCards.applyMovement).toHaveBeenCalledWith(CARD.id, {
        amount: -5_000,
        currency: 'BRL',

        date: '2026-10-13',
      });
    });

    describe('a bill payment paid from another Account (OQ-219)', () => {
      const CARD_ONLY = {
        ...ACCOUNT, id: '0199c5a0-0000-7000-8000-0000000000a3', type: 'credit_card_only' as const,
      };
      const billRequest = () => cashRequest({
        kind: 'credit_card_bill_payment', accountId: CHECKING.id, creditCardId: CARD.id,
      });

      /**
       * Programs the Account lookups in the order the Manager makes them: the
       * payer, then the Account the card sits on.
       *
       * @param cardAccount - The card's Account, as the lookup answers it.
       * @param payer - The paying Account; Checking by default.
       * @returns The fake.
       */
      const payingFrom = (
        cardAccount: typeof CARD_ONLY | undefined,
        payer: typeof CHECKING | typeof CARD_ONLY = CHECKING,
      ) => {
        const fake = fakeDeps();
        fake.creditCards.findById.mockResolvedValue({ ...CARD, accountId: CARD_ONLY.id });
        fake.accounts.findById.mockResolvedValueOnce(payer).mockResolvedValueOnce(cardAccount);
        return fake;
      };

      it('pays a card on a credit-card-only Account from Checking', async () => {
        const fake = payingFrom(CARD_ONLY);
        await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, billRequest());
        expect(fake.accounts.applyMovement).toHaveBeenCalledWith(
          CHECKING.id,
          expect.objectContaining({ amount: -5_000 }),
        );
        expect(fake.creditCards.applyMovement).toHaveBeenCalledWith(
          CARD.id,
          expect.objectContaining({ amount: -5_000 }),
        );
      });

      it('decides on the card\'s Account too: one not editable is not found', async () => {
        const fake = payingFrom(CARD_ONLY);
        fake.authorization.authorize
          .mockResolvedValueOnce({ outcome: 'allowed', role: 'Owner' })
          .mockResolvedValueOnce({ outcome: 'not_visible' });
        await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, billRequest()))
          .rejects.toMatchObject({ domainError: { code: 'credit_card.not_found' } });
        expect(fake.accountTransactions.insert).not.toHaveBeenCalled();
      });

      it('refuses a card whose Account is gone', async () => {
        const fake = payingFrom(undefined);
        await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, billRequest()))
          .rejects.toMatchObject({ domainError: { code: 'credit_card.not_found' } });
      });

      it('refuses a card whose Account is archived, naming the card\'s Account', async () => {
        const fake = payingFrom({ ...CARD_ONLY, archivedAt: NOW });
        await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, billRequest()))
          .rejects.toMatchObject({ domainError: { code: 'credit_card.account_archived' } });
      });

      it('refuses a card in another currency than the payment', async () => {
        const fake = payingFrom({ ...CARD_ONLY, currency: 'USD' });
        await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, billRequest()))
          .rejects.toMatchObject({
            domainError: {
              code: 'transaction.currency_mismatch', params: { accountCurrency: 'USD' },
            },
          });
      });

      it('refuses a credit-card-only Account as the payer', async () => {
        const fake = payingFrom(CARD_ONLY, CARD_ONLY);
        await expect(recordOf(fake).recordTransaction(
          context,
          HOUSEHOLD_ID,
          cashRequest({
            kind: 'credit_card_bill_payment', accountId: CARD_ONLY.id, creditCardId: CARD.id,
          }),
        ))
          .rejects.toMatchObject({
            domainError: { code: 'transaction.kind_not_allowed_for_target' },
          });
      });

      it('checks the payer before the card: a credit-card-only payer of a USD card', async () => {
        const fake = payingFrom({ ...CARD_ONLY, currency: 'USD' }, CARD_ONLY);
        await expect(recordOf(fake).recordTransaction(
          context,
          HOUSEHOLD_ID,
          cashRequest({
            kind: 'credit_card_bill_payment', accountId: CARD_ONLY.id, creditCardId: CARD.id,
          }),
        ))
          .rejects.toMatchObject({
            domainError: { code: 'transaction.kind_not_allowed_for_target' },
          });
        expect(fake.creditCards.findById).not.toHaveBeenCalled();
      });
    });

    it(
      'answers transaction.changed when the bill payment card leg loses a race (OQ-203)',
      async () => {
        const fake = fakeDeps();
        fake.accounts.findById.mockResolvedValue(CHECKING);
        fake.creditCards.applyMovement.mockResolvedValue({ ok: false });
        await expect(recordOf(fake).recordTransaction(
          context,
          HOUSEHOLD_ID,
          cashRequest({
            kind: 'credit_card_bill_payment',

            accountId: CHECKING.id,
            creditCardId: CARD.id,
          }),
        ))
          .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
      },
    );

    it('refuses a cash event on a user-archived Holding (FR-5.8/OQ-171)', async () => {
      const fake = fakeDeps();
      fake.holdings.findById.mockResolvedValue({
        ...MARKET_HOLDING,
        archivedAt: NOW,
        archivedBy: 'user',
      });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({
          kind: 'investment_interest',

          holdingId: MARKET_HOLDING.id,
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'holding.archived' } });
    });

    it('refuses a cash event on a Holding in another Account', async () => {
      const fake = fakeDeps();
      fake.holdings.findById.mockResolvedValue({ ...MARKET_HOLDING, accountId: CHECKING.id });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({
          kind: 'investment_interest',

          holdingId: MARKET_HOLDING.id,
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    });
  });

  describe('target gates (FR-3.1/OQ-201 D5)', () => {
    it('refuses an investment kind on a credit-card-only Account', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue({ ...ACCOUNT, type: 'credit_card_only' });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest()))
        .rejects.toMatchObject({
          domainError: { code: 'transaction.investment_not_allowed_on_account' },
        });
    });

    it('refuses a cash kind on a credit-card-only Account (OQ-201 D5)', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue({ ...ACCOUNT, type: 'credit_card_only' });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest()))
        .rejects.toMatchObject({
          domainError: { code: 'transaction.kind_not_allowed_for_target' },
        });
    });

    it('refuses an archived Account (FR-2.4)', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue({ ...ACCOUNT, archivedAt: NOW });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest()))
        .rejects.toMatchObject({ domainError: { code: 'account.archived' } });
    });

    it('refuses an amount in another currency (FR-2.2)', async () => {
      const fake = fakeDeps();
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({ currency: 'USD' }),
      ))
        .rejects.toMatchObject({
          domainError: {
            code: 'transaction.currency_mismatch',
            params: { accountCurrency: 'BRL' },
          },
        });
    });
  });

  describe('category checks (FR-3.4)', () => {
    it('refuses a Category that is not this household\'s', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue(undefined);
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({ categoryId: 'cX' }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'category.not_found' } });
    });

    it('refuses a Subcategory that is not under the Category', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue({
        id: 'c1',
        archivedAt: null,
        subcategories: [{ id: 's1' }],
      });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({
          categoryId: 'c1',

          subcategoryId: 's2',
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.subcategory_mismatch' } });
    });

    it('refuses new money on an archived Category (OQ-201)', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue({ id: 'c1', archivedAt: NOW, subcategories: [] });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({ categoryId: 'c1' }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'category.archived' } });
    });
  });

  describe('market buy (FR-3.8/OQ-54)', () => {
    it('opens a new Holding and snapshots the money it holds (PR #145)', async () => {
      const fake = fakeDeps();
      fake.holdings.findByTicker.mockResolvedValue(undefined);
      fake.valuations.latestAsOf.mockResolvedValueOnce([]);
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest());
      expect(fake.holdings.insert).toHaveBeenCalledWith({
        accountId: ACCOUNT.id,
        assetType: 'stock',
        ticker: 'PETR4',
      });
      expect(fake.accounts.applyMovement).toHaveBeenCalledWith(ACCOUNT.id, {
        amount: -2_000,
        currency: 'BRL',

        date: '2026-10-13',
      });
      expect(fake.holdings.applyTrade).toHaveBeenCalledWith(MARKET_HOLDING.id, {
        quantityDelta: 2,
        costBasisDelta: 2_000,
      });
      // Nothing before it: the Holding is worth what was paid — never a unit price.
      expect(fake.valuations.latestAsOf)
        .toHaveBeenCalledWith([MARKET_HOLDING.id], '2026-10-13', undefined);
      expect(fake.valuations.insertAutomatic).toHaveBeenCalledWith({
        holdingId: MARKET_HOLDING.id,
        accountTransactionId: expect.any(String),
        valuation: 2_000,
        asOfDate: '2026-10-13',
      });
    });

    it('adds a buy to the value before it, whatever the units (PR #145)', async () => {
      const fake = fakeDeps();
      // R$ 600,00 for 20 units, stored × 10⁸, into a Holding worth R$ 300,00.
      fake.valuations.latestAsOf.mockResolvedValueOnce([{ valuation: 30_000 }]);
      await recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({ amount: 60_000, quantity: 2_000_000_000 }),
      );
      expect(fake.valuations.insertAutomatic).toHaveBeenCalledWith(
        expect.objectContaining({ valuation: 90_000 }),
      );
    });

    it(
      're-weights the existing split by value when a buy funds another Goal (OQ-168)',
      async () => {
        const fake = fakeDeps();
        fake.goals.listAllocations.mockResolvedValue([{
          goalId: 'gA',
          percentage: 100,
          id: 'al1',
          holdingId: MARKET_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        }]);
        await recordOf(fake).recordTransaction(
          context,
          HOUSEHOLD_ID,
          buyRequest({
            allocations: [{
              goalId: GOAL.id,

              percentage: 100,
            }],
          }),
        );
        // The Holding is worth 10_000 before the buy (its latest value); the purchase adds 2_000.
        expect(fake.goals.replaceAllocations).toHaveBeenCalledWith(
          HOUSEHOLD_ID,
          MARKET_HOLDING.id,
          [{ goalId: 'gA', percentage: 83 }, { goalId: GOAL.id, percentage: 17 }],
          '2026-10-13',
        );
      },
    );

    it('dilutes the existing split when a buy carries no allocations (OQ-207)', async () => {
      const fake = fakeDeps();
      fake.goals.listAllocations.mockResolvedValue([{
        goalId: 'gA',
        percentage: 100,
        id: 'al1',
        holdingId: MARKET_HOLDING.id,
        validFrom: '2026-09-01',
        createdAt: NOW,
      }]);
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest());
      // The old shares keep their 10_000 of a now-12_000 position; the new money
      // shows as unassigned until someone allocates it.
      expect(fake.goals.replaceAllocations).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        MARKET_HOLDING.id,
        [{ goalId: 'gA', percentage: 83 }],
        '2026-10-13',
      );
    });

    it(
      'reopens a zeroed system-archived Holding and drops its worthless split (OQ-171)',
      async () => {
        const fake = fakeDeps();
        fake.holdings.findByTicker.mockResolvedValue({
          ...MARKET_HOLDING, quantity: 0, archivedAt: NOW, archivedBy: 'system',
        });
        // Its sell-out left it worth nothing.
        fake.valuations.latestAsOf.mockResolvedValue([{ valuation: 0 }]);
        fake.goals.listAllocations.mockResolvedValue([{
          goalId: 'gA',
          percentage: 100,
          id: 'al1',
          holdingId: MARKET_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        }]);
        await recordOf(fake).recordTransaction(
          context,
          HOUSEHOLD_ID,
          buyRequest({
            allocations: [{
              goalId: GOAL.id,

              percentage: 100,
            }],
          }),
        );
        expect(fake.holdings.unarchiveIfSystemArchived).toHaveBeenCalledWith(MARKET_HOLDING.id);
        // The old shares are worth nothing — only the new buy's split stands.
        expect(fake.goals.replaceAllocations).toHaveBeenCalledWith(
          HOUSEHOLD_ID,
          MARKET_HOLDING.id,
          [{ goalId: GOAL.id, percentage: 100 }],
          '2026-10-13',
        );
      },
    );

    it('refuses a buy into a user-archived Holding (FR-5.8)', async () => {
      const fake = fakeDeps();
      fake.holdings.findByTicker.mockResolvedValue({
        ...MARKET_HOLDING,
        archivedAt: NOW,
        archivedBy: 'user',
      });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest()))
        .rejects.toMatchObject({ domainError: { code: 'holding.archived' } });
    });

    it('refuses a Goal the caller cannot see', async () => {
      const fake = fakeDeps();
      fake.goals.findByIds.mockResolvedValue([{
        ...GOAL, id: 'gX', visibility: 'personal', ownerUserId: 'u2',
      }]);
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({
          allocations: [{
            goalId: 'gX',

            percentage: 100,
          }],
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'goal.not_found' } });
    });

    it('refuses new money on a completed Goal (FR-8.9)', async () => {
      const fake = fakeDeps();
      fake.goals.findByIds.mockResolvedValue([{ ...GOAL, id: GOAL.id, completedAt: NOW }]);
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({
          allocations: [{
            goalId: GOAL.id,

            percentage: 100,
          }],
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'goal.completed' } });
    });

    it('accrues the Budget a buy names (OQ-201 D4)', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({ categoryId: 'c1' }),
      );
      expect(fake.budgets.accrueIfClaimed).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2_000, categoryId: 'c1' }),
      );
    });

    it('answers transaction.changed when the Account movement loses a race (OQ-203)', async () => {
      const fake = fakeDeps();
      fake.accounts.applyMovement.mockResolvedValue({ ok: false });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest()))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });
  });

  describe('fixed-term buy (OQ-50/OQ-205)', () => {
    const terms = {
      rate: { type: 'ipca', value: 250 } as const,
      dueDate: '2026-12-01',
      interestPayment: 'semiannual' as const,
    };

    it('opens a new Holding with its terms and schedule, no snapshot', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest({
        assetType: 'cdb', ticker: 'CDB1', amount: 50_000, quantity: undefined, ...terms,
      }));
      expect(fake.holdings.insert).toHaveBeenCalledWith(expect.objectContaining({
        assetType: 'cdb',
        rate: {
          rateType: 'ipca',
          rateValue: 250,
          rateSpread: null,
        },
        dueDate: '2026-12-01',
        interestPayment: 'semiannual',
      }));
      expect(fake.investmentProducts.schedule).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        expect.objectContaining({
          assetType: 'cdb',

          amount: 50_000,
          rate: { type: 'ipca', value: 250 },
        }),
      );
      expect(fake.holdings.applySchedule).toHaveBeenCalled();
      expect(fake.valuations.insertAutomatic).not.toHaveBeenCalled();
    });

    it('refuses when the index has no recorded value (OQ-205)', async () => {
      const fake = fakeDeps();
      fake.investmentProducts.schedule.mockResolvedValue({
        ok: false,
        reason: 'index_missing',
        indexCode: 'ipca',
      });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest({
        assetType: 'cdb', ticker: 'CDB1', amount: 50_000, quantity: undefined, ...terms,
      })))
        .rejects.toMatchObject({
          domainError: {
            code: 'index_rate.missing',
            params: { indexCode: 'ipca' },
          },
        });
    });

    it('refuses an incomplete rate — type and value are required (OQ-207)', async () => {
      const fake = fakeDeps();
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest({
        assetType: 'cdb',
        ticker: 'CDB1',
        amount: 50_000,
        quantity: undefined,
        rate: {},
        dueDate: '2026-12-01',
        interestPayment: 'semiannual',
      })))
        .rejects.toMatchObject({
          domainError: {
            code: 'validation.failed',
            details: [
              { field: 'rate.type', code: 'field.required' },
              { field: 'rate.value', code: 'field.required' },
            ],
          },
        });
    });
  });

  describe('sell (FR-3.8/OQ-171)', () => {
    it('removes the average cost pro rata, not last-in price', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest());
      // 4 of 10 units carry 4_000 of the 10_000 basis.
      expect(fake.holdings.applyTrade).toHaveBeenCalledWith(MARKET_HOLDING.id, {
        quantityDelta: -4,
        costBasisDelta: -4_000,
      });
      expect(fake.accounts.applyMovement).toHaveBeenCalledWith(ACCOUNT.id, {
        amount: 5_000,
        currency: 'BRL',

        date: '2026-10-13',
      });
      // R$ 100,00 before, R$ 50,00 out: the money left is R$ 50,00 (PR #145).
      expect(fake.valuations.insertAutomatic).toHaveBeenCalledWith(
        expect.objectContaining({ valuation: 5_000 }),
      );
    });

    it('never values a sell below zero', async () => {
      const fake = fakeDeps();
      fake.valuations.latestAsOf.mockResolvedValueOnce([{ valuation: 3_000 }]);
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest());
      expect(fake.valuations.insertAutomatic).toHaveBeenCalledWith(
        expect.objectContaining({ valuation: 0 }),
      );
    });

    it('auto-archives a zeroed position as system (OQ-171)', async () => {
      const fake = fakeDeps();
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 0, costBasis: 0 });
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest({
        quantity: 10,
        amount: 10_000,
      }));
      expect(fake.holdings.archive).toHaveBeenCalledWith(MARKET_HOLDING.id, 'system');
    });

    it('refuses a sell on an already-zeroed position', async () => {
      const fake = fakeDeps();
      fake.holdings.findById.mockResolvedValue({ ...MARKET_HOLDING, quantity: 0 });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest()))
        .rejects.toMatchObject({ domainError: { code: 'holding.insufficient_quantity' } });
    });

    it('maps the Accessor\'s refusals to their errors', async () => {
      const fake = fakeDeps();
      const refused = (reason: string) => {
        fake.holdings.applyTrade.mockResolvedValue({ ok: false, reason });
        return recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest());
      };
      await expect(refused('insufficient_quantity'))
        .rejects.toMatchObject({ domainError: { code: 'holding.insufficient_quantity' } });
      await expect(refused('cost_basis_below_zero'))
        .rejects.toMatchObject({ domainError: { code: 'holding.cost_basis_below_zero' } });
      await expect(refused('holding_not_found'))
        .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    });

    it('refuses a sell on a user-archived Holding (FR-5.8)', async () => {
      const fake = fakeDeps();
      fake.holdings.findById.mockResolvedValue({
        ...MARKET_HOLDING,
        archivedAt: NOW,
        archivedBy: 'user',
      });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest()))
        .rejects.toMatchObject({ domainError: { code: 'holding.archived' } });
    });

    it('saves the carried split with the trade from today (OQ-206)', async () => {
      const fake = fakeDeps();
      fake.goals.listAllocations.mockResolvedValue([
        {
          goalId: 'gA',
          percentage: 40,
          id: 'al1',
          holdingId: MARKET_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        },
        {
          goalId: 'gB',
          percentage: 60,
          id: 'al2',
          holdingId: MARKET_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        },
      ]);
      await recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        sellRequest({
          allocations: [{
            goalId: 'gA',

            percentage: 50,
          }, { goalId: 'gB', percentage: 50 }],
        }),
      );
      expect(fake.goals.replaceAllocations).toHaveBeenCalledWith(HOUSEHOLD_ID, MARKET_HOLDING.id, [
        { goalId: 'gA', percentage: 50 }, { goalId: 'gB', percentage: 50 },
      ], '2026-10-13');
    });

    it('carries hidden shares over unchanged (OQ-178)', async () => {
      const fake = fakeDeps();
      fake.goals.listAllocations.mockResolvedValue([
        {
          goalId: 'gX',
          percentage: 30,
          id: 'al1',
          holdingId: MARKET_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        },
        {
          goalId: 'gA',
          percentage: 70,
          id: 'al2',
          holdingId: MARKET_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        },
      ]);
      fake.goals.findByIds.mockResolvedValue([
        {
          ...GOAL, id: 'gX', visibility: 'personal', ownerUserId: 'u2',
        },
        { ...GOAL, id: 'gA' },
      ]);
      await recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        sellRequest({
          allocations: [{
            goalId: 'gA',

            percentage: 100,
          }],
        }),
      );
      expect(fake.goals.replaceAllocations).toHaveBeenCalledWith(HOUSEHOLD_ID, MARKET_HOLDING.id, [
        { goalId: 'gX', percentage: 30 }, { goalId: 'gA', percentage: 100 },
      ], '2026-10-13');
    });

    it('keeps the current split when the trade carries none (OQ-206)', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest());
      expect(fake.goals.listAllocations).not.toHaveBeenCalled();
      expect(fake.goals.replaceAllocations).not.toHaveBeenCalled();
    });
  });

  describe('redemption (FR-3.8)', () => {
    it('closes the whole position at its full basis and auto-archives', async () => {
      const fake = fakeDeps();
      fake.holdings.findById.mockResolvedValue(FIXED_HOLDING);
      fake.holdings.applyTrade.mockResolvedValue({ ok: true, quantity: 0, costBasis: 0 });
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest({
        kind: 'investment_redemption', holdingId: FIXED_HOLDING.id, quantity: 1, amount: 50_000,
      }));
      expect(fake.holdings.applyTrade).toHaveBeenCalledWith(FIXED_HOLDING.id, {
        quantityDelta: -1,
        costBasisDelta: -50_000,
      });
      expect(fake.holdings.archive).toHaveBeenCalledWith(FIXED_HOLDING.id, 'system');
      expect(fake.valuations.insertAutomatic).not.toHaveBeenCalled();
    });

    it('refuses a redemption of less than the whole position', async () => {
      const fake = fakeDeps();
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        sellRequest({
          kind: 'investment_redemption',

          quantity: 5,
        }),
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
  });

  describe('missing reference data', () => {
    it('refuses a charge when the card does not exist', async () => {
      const fake = fakeDeps();
      fake.creditCards.findById.mockResolvedValue(undefined);
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({
          kind: 'charge',

          accountId: undefined,
          creditCardId: CARD.id,
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'credit_card.not_found' } });
    });

    it('refuses a withdrawal when the Account does not exist', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue(undefined);
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest()))
        .rejects.toMatchObject({ domainError: { code: 'account.not_found' } });
    });

    it('refuses a trade on a Holding in another Account', async () => {
      const fake = fakeDeps();
      fake.holdings.findById.mockResolvedValue({ ...MARKET_HOLDING, accountId: CHECKING.id });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest()))
        .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    });
  });

  describe('races (OQ-203)', () => {
    const cdbBuy = (): TransactionCreate => buyRequest({
      assetType: 'cdb',
      ticker: 'CDB1',
      amount: 50_000,
      quantity: undefined,
      rate: { type: 'ipca', value: 250 },
      dueDate: '2026-12-01',
      interestPayment: 'semiannual',
    });

    it('answers transaction.changed when the card movement loses a race', async () => {
      const fake = fakeDeps();
      fake.accounts.findById.mockResolvedValue(CHECKING);
      fake.creditCards.applyMovement.mockResolvedValue({ ok: false });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({
          kind: 'charge',

          accountId: undefined,
          creditCardId: CARD.id,
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers transaction.changed when the cash insert loses a race', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.insert.mockResolvedValue({ ok: false, transaction: ROW });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest()))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers transaction.changed when the cash movement loses a race', async () => {
      const fake = fakeDeps();
      fake.accounts.applyMovement.mockResolvedValue({ ok: false });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({ kind: 'deposit' }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers transaction.changed when a buy insert loses a race', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.insert.mockResolvedValue({ ok: false, transaction: ROW });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest()))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers transaction.changed when a sell insert loses a race', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.insert.mockResolvedValue({ ok: false, transaction: ROW });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest()))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers transaction.changed when a sell movement loses a race', async () => {
      const fake = fakeDeps();
      fake.accounts.applyMovement.mockResolvedValue({ ok: false });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest()))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('maps a refused buy trade to its error', async () => {
      const fake = fakeDeps();
      fake.holdings.applyTrade.mockResolvedValue({ ok: false, reason: 'holding_not_found' });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest()))
        .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    });

    it('answers transaction.changed when a new market Holding insert loses a race', async () => {
      const fake = fakeDeps();
      fake.holdings.findByTicker.mockResolvedValue(undefined);
      fake.holdings.insert.mockResolvedValue({ ok: false, holding: MARKET_HOLDING });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({ ticker: 'VALE3' }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers transaction.changed when a fixed-term Holding insert loses a race', async () => {
      const fake = fakeDeps();
      fake.holdings.insert.mockResolvedValue({ ok: false, holding: FIXED_HOLDING });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cdbBuy()))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });

    it('answers transaction.changed when the fixed-term schedule apply loses a race', async () => {
      const fake = fakeDeps();
      fake.holdings.applySchedule.mockResolvedValue({ ok: false, reason: 'holding_not_found' });
      await expect(recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cdbBuy()))
        .rejects.toMatchObject({ domainError: { code: 'transaction.changed' } });
    });
  });

  describe('Goal split refusals', () => {
    it('writes the purchase shares on a fresh Holding', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({
          allocations: [{
            goalId: GOAL.id,

            percentage: 100,
          }],
        }),
      );
      expect(fake.goals.replaceAllocations)
        .toHaveBeenCalledWith(
          HOUSEHOLD_ID,
          MARKET_HOLDING.id,
          [{
            goalId: GOAL.id,
            percentage: 100,
          }],
          '2026-10-13',
        );
    });

    it('refuses a re-weighting whose purchase exceeds 100%', async () => {
      const fake = fakeDeps();
      fake.goals.listAllocations.mockResolvedValue([
        {
          goalId: 'gA',
          percentage: 50,
          id: 'al1',
          holdingId: MARKET_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        },
      ]);
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({
          allocations: [{
            goalId: GOAL.id,

            percentage: 120,
          }],
        }),
      ))
        .rejects.toMatchObject({
          domainError: {
            code: 'goal.allocation_exceeds_100',
            params: {
              current: 50,

              requested: 120,
            },
          },
        });
    });

    it('maps an over-100 split refusal to its error', async () => {
      const fake = fakeDeps();
      fake.goals.replaceAllocations.mockResolvedValue({
        ok: false, reason: 'allocation_exceeds_100', current: 80, requested: 30,
      });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({
          allocations: [{
            goalId: GOAL.id,

            percentage: 100,
          }],
        }),
      ))
        .rejects.toMatchObject({
          domainError: {
            code: 'goal.allocation_exceeds_100',
            params: {
              current: 80,

              requested: 30,
            },
          },
        });
    });

    it('maps a buy split refusal to its error', async () => {
      const fake = fakeDeps();
      fake.goals.replaceAllocations.mockResolvedValue({
        ok: false,
        reason: 'goal_not_found',
        goalId: GOAL.id,
      });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        buyRequest({
          allocations: [{
            goalId: GOAL.id,

            percentage: 100,
          }],
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'goal.not_found' } });
    });

    it('maps a sell split refusal to its error', async () => {
      const fake = fakeDeps();
      fake.goals.replaceAllocations.mockResolvedValue({ ok: false, reason: 'holding_not_found' });
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        sellRequest({
          allocations: [{
            goalId: GOAL.id,

            percentage: 100,
          }],
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    });

    it('refuses a sell allocation the caller cannot see', async () => {
      const fake = fakeDeps();
      fake.goals.findByIds.mockResolvedValue([]);
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        sellRequest({
          allocations: [{
            goalId: GOAL.id,

            percentage: 100,
          }],
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'goal.not_found' } });
    });

    it('refuses growing a completed Goal on a sell', async () => {
      const fake = fakeDeps();
      fake.goals.findByIds.mockResolvedValue([{ ...GOAL, id: 'gA', completedAt: NOW }]);
      fake.goals.listAllocations.mockResolvedValue([
        {
          goalId: 'gA',
          percentage: 40,
          id: 'al1',
          holdingId: MARKET_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        },
      ]);
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        sellRequest({
          allocations: [{
            goalId: 'gA',

            percentage: 60,
          }],
        }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'goal.completed' } });
    });
  });

  describe('optional fields ride the row (OQ-207)', () => {
    it('keeps a cash row description and subcategory', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue({
        id: 'c1',
        archivedAt: null,
        subcategories: [{ id: 's1' }],
      });
      await recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({
          categoryId: 'c1',
          description: 'groceries',

          subcategoryId: 's1',
        }),
      );
      expect(
        fake.accountTransactions.insert.mock.calls[0]![0],
      ).toMatchObject({ description: 'groceries', subcategoryId: 's1' });
    });

    it('keeps a card row description and subcategory', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue({
        id: 'c1',
        archivedAt: null,
        subcategories: [{ id: 's1' }],
      });
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, cashRequest({
        kind: 'charge',
        accountId: undefined,
        creditCardId: CARD.id,
        categoryId: 'c1',
        description: 'dining',
        subcategoryId: 's1',

      }));
      expect(fake.cardTransactions.insert.mock.calls[0]![0]).toMatchObject({
        description: 'dining',
        subcategoryId: 's1',
      });
    });

    it('refuses a subcategory without its category (OQ-207)', async () => {
      const fake = fakeDeps();
      await expect(recordOf(fake).recordTransaction(
        context,
        HOUSEHOLD_ID,
        cashRequest({ subcategoryId: 's1' }),
      ))
        .rejects.toMatchObject({ domainError: { code: 'transaction.subcategory_mismatch' } });
    });

    it('keeps a buy row category, subcategory and description', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue({
        id: 'c1',
        archivedAt: null,
        subcategories: [{ id: 's1' }],
      });
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest({
        categoryId: 'c1', subcategoryId: 's1', description: 'entry',
      }));
      expect(fake.accountTransactions.insert.mock.calls[0]![0]).toMatchObject({
        categoryId: 'c1', subcategoryId: 's1', description: 'entry',
      });
    });

    it('keeps a sell row category, subcategory and description', async () => {
      const fake = fakeDeps();
      fake.categories.findById.mockResolvedValue({
        id: 'c1',
        archivedAt: null,
        subcategories: [{ id: 's1' }],
      });
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, sellRequest({
        categoryId: 'c1', subcategoryId: 's1', description: 'exit',
      }));
      expect(fake.accountTransactions.insert.mock.calls[0]![0]).toMatchObject({
        categoryId: 'c1', subcategoryId: 's1', description: 'exit',
      });
    });

    it('defaults a fixed-term buy without interest payment to at maturity (OQ-205)', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest({
        assetType: 'cdb',
        ticker: 'CDB1',
        amount: 50_000,
        quantity: undefined,
        rate: { type: 'ipca', value: 250 },
        dueDate: '2026-12-01',
        interestPayment: undefined,
      }));
      expect(
        fake.holdings.insert.mock.calls[0]![0],
      ).toMatchObject({ interestPayment: 'at_maturity' });
    });

    it('keeps a debenture buy incentivised flag (OQ-79)', async () => {
      const fake = fakeDeps();
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest({
        assetType: 'debenture',
        ticker: 'DEB1',
        amount: 50_000,
        quantity: undefined,
        rate: { type: 'ipca', value: 250 },
        dueDate: '2026-12-01',
        interestPayment: 'semiannual',
        incentivised: true,
      }));
      expect(fake.holdings.insert.mock.calls[0]![0]).toMatchObject({ incentivised: true });
    });

    it('reweights a carried split on a fixed-term buy without quantity (OQ-168)', async () => {
      const fake = fakeDeps();
      fake.goals.listAllocations.mockResolvedValue([
        {
          goalId: GOAL.id,
          percentage: 50,
          id: 'al1',
          holdingId: FIXED_HOLDING.id,
          validFrom: '2026-09-01',
          createdAt: NOW,
        },
      ]);
      await recordOf(fake).recordTransaction(context, HOUSEHOLD_ID, buyRequest({
        assetType: 'cdb',
        ticker: 'CDB1',
        amount: 50_000,
        quantity: undefined,
        rate: { type: 'ipca', value: 250 },
        dueDate: '2026-12-01',
        interestPayment: 'semiannual',
        allocations: [{ goalId: GOAL.id, percentage: 50 }],
      }));
      expect(fake.goals.replaceAllocations).toHaveBeenCalled();
    });
  });
});
