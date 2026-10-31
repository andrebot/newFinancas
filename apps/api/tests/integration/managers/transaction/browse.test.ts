import { describe, expect, it } from 'vitest';
import type { AccountTransaction } from '../../../../src/accessors/accountTransactionAccessor';
import type { CardTransaction } from '../../../../src/accessors/cardTransactionAccessor';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import createBrowse from '../../../../src/managers/transaction/browse';
import {
  ACCOUNT, ANA_ID, CARD, CARD_ROW, CHECKING, HOUSEHOLD_ID, MARKET_HOLDING, ROW, fakeDeps,
} from './fakes';

// Browse & Filter (CUC-4, FR-3.12): both ledgers as one newest-first list —
// narrowed to what the caller may see before any filter is applied (OQ-61),
// cursor-paginated on (date, id); day totals and month counts cover the page's
// days and months over the whole filtered set.

const context: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};

/** The use cases over one programmed fake. */
const browseOf = (fake: ReturnType<typeof fakeDeps>) => createBrowse(fake.deps);

const accountRow = (id: string, date: string): AccountTransaction => ({ ...ROW, id, date });
const cardRow = (id: string, date: string): CardTransaction => ({ ...CARD_ROW, id, date });

describe('listTransactions', () => {
  it('merges both ledgers newest first on (date, id)', async () => {
    const fake = fakeDeps();
    // Same-date rows order by id; newer dates come first.
    fake.accountTransactions.list.mockResolvedValue([accountRow(
      'a2',
      '2026-10-13',
    ), accountRow('a1', '2026-10-12')]);
    fake.cardTransactions.list.mockResolvedValue([cardRow('c1', '2026-10-13')]);
    const page = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 2);
    // Same-date rows order by id descending — the ledgers' own order.
    expect(page.items.map(({ transaction }) => transaction.id)).toEqual(['c1', 'a2']);
    expect(page.nextCursor).not.toBeNull();
  });

  it('resumes each ledger after its last consumed row and stops when both are done', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.list.mockResolvedValueOnce([accountRow(
      'a2',
      '2026-10-13',
    ), accountRow('a1', '2026-10-12')]);
    fake.cardTransactions.list.mockResolvedValue([]);
    const first = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 1);
    expect(first.items.map(({ transaction }) => transaction.id)).toEqual(['a2']);

    // The card ledger fetched nothing at its start — it is done, not resumable.
    fake.accountTransactions.list.mockResolvedValueOnce([accountRow('a1', '2026-10-12')]);
    const second = await browseOf(fake).listTransactions(
      context,
      HOUSEHOLD_ID,
      {},
      first.nextCursor ?? undefined,
      1,
    );
    expect(fake.cardTransactions.list).toHaveBeenCalledTimes(1); // never re-fetched
    expect(second.items.map(({ transaction }) => transaction.id)).toEqual(['a1']);
    expect(second.nextCursor).toBeNull();
  });

  it('marks a ledger done when its fresh fetch comes back empty', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.list.mockResolvedValue([]);
    fake.cardTransactions.list.mockResolvedValue([cardRow(
      'c1',
      '2026-10-13',
    ), cardRow('c2', '2026-10-12')]);
    const page = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 1);
    expect(page.items.map(({ transaction }) => transaction.id)).toEqual(['c1']);
    // The account half is DONE ('-'), the card half resumes after c1.
    expect(page.nextCursor).toBe(`tx2.-|${cardRow('c1', '2026-10-13').date}:c1`);
  });

  it('answers an empty page for a member with no Accounts', async () => {
    const fake = fakeDeps();
    fake.accounts.list.mockResolvedValue([]);
    const page = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 10);
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('resumes past a done ledger and ends when the other exhausts', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.list.mockResolvedValueOnce([accountRow('a1', '2026-10-14')]);
    fake.cardTransactions.list.mockResolvedValueOnce([cardRow('c3', '2026-10-13'), cardRow(
      'c2',
      '2026-10-12',
    )]);
    const first = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 2);
    expect(first.items.map(({ transaction }) => transaction.id)).toEqual(['a1', 'c3']);
    // The account ledger came back fully consumed — its half is DONE.
    expect(first.nextCursor).toBe('tx2.-|2026-10-13:c3');

    fake.cardTransactions.list.mockResolvedValueOnce([cardRow('c2', '2026-10-12')]);
    const second = await browseOf(fake).listTransactions(
      context,
      HOUSEHOLD_ID,
      {},
      first.nextCursor ?? undefined,
      2,
    );
    expect(second.items.map(({ transaction }) => transaction.id)).toEqual(['c2']);
    expect(second.nextCursor).toBeNull();
  });

  it('passes every shared and account filter through to the ledgers', async () => {
    const fake = fakeDeps();
    await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {
      kinds: ['withdrawal'],
      categoryIds: ['cat1'],
      from: '2026-01-01',
      to: '2026-12-31',
      holdingId: 'h1',
      creditCardIds: ['cc1'],
    }, undefined, 10);
    expect(fake.accountTransactions.list).toHaveBeenCalledWith(
      expect.objectContaining({
        kinds: ['withdrawal'],
        categoryIds: ['cat1'],
        from: '2026-01-01',
        to: '2026-12-31',
        holdingId: 'h1',
        creditCardIds: ['cc1'],
      }),
      undefined,
      11,
    );
  });

  it('passes a picked Account through to the Account ledger (review B4)', async () => {
    const fake = fakeDeps();
    await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {
      accountIds: [ACCOUNT.id],
    }, undefined, 10);
    expect(fake.accountTransactions.list).toHaveBeenCalledWith(
      expect.objectContaining({ accountIds: [ACCOUNT.id] }),
      undefined,
      11,
    );
  });

  it('keeps a ledger at its position when none of its rows made the page', async () => {
    const fake = fakeDeps();
    // The account row is older than both card rows — pushed out of a one-row page.
    fake.accountTransactions.list.mockResolvedValueOnce([accountRow('a1', '2026-10-12')]);
    fake.cardTransactions.list.mockResolvedValueOnce([cardRow('c3', '2026-10-14'), cardRow(
      'c2',
      '2026-10-13',
    )]);
    const first = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 1);
    expect(first.items.map(({ transaction }) => transaction.id)).toEqual(['c3']);
    // Nothing of the account ledger was consumed — its half resumes where it was.
    expect(first.nextCursor).not.toBeNull();

    fake.accountTransactions.list.mockResolvedValueOnce([accountRow('a1', '2026-10-12')]);
    fake.cardTransactions.list.mockResolvedValueOnce([cardRow('c2', '2026-10-13')]);
    const second = await browseOf(fake).listTransactions(
      context,
      HOUSEHOLD_ID,
      {},
      first.nextCursor ?? undefined,
      1,
    );
    expect(second.items.map(({ transaction }) => transaction.id)).toEqual(['c2']);
  });

  it.each([
    ['no-prefix', 'garbage'],
    ['bad-body', 'tx2.2026-13-99|'],
    ['missing-half', 'tx2.2026-10-13:a1'],
  ])('refuses a malformed cursor (%s)', async (_label, cursor) => {
    const fake = fakeDeps();
    await expect(browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, cursor, 10))
      .rejects.toMatchObject({
        domainError: {
          code: 'validation.failed',
          details: [{
            field: 'cursor',

            code: 'field.invalid',
          }],
        },
      });
  });

  it('narrows to the visible Accounts before filtering (OQ-61)', async () => {
    const fake = fakeDeps();
    await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 10);
    expect(fake.accountTransactions.list).toHaveBeenCalledWith(
      expect.objectContaining({ scopeAccountIds: [ACCOUNT.id] }),
      undefined,
      11,
    );
  });

  it('a picked Account also picks its cards (OQ-204)', async () => {
    const fake = fakeDeps();
    await browseOf(fake).listTransactions(
      context,
      HOUSEHOLD_ID,
      { accountIds: [ACCOUNT.id] },
      undefined,
      10,
    );
    expect(fake.cardTransactions.list).toHaveBeenCalledWith(
      expect.objectContaining({ creditCardIds: [CARD_ROW.creditCardId] }),
      undefined,
      11,
    );
  });

  it('a picked Account with no cards empties the card side (OQ-207)', async () => {
    const fake = fakeDeps();
    // The pick names nothing — every other visible card stays out of the page.
    fake.creditCards.listByAccounts.mockResolvedValue([]);
    await browseOf(fake).listTransactions(
      context,
      HOUSEHOLD_ID,
      { accountIds: [ACCOUNT.id] },
      undefined,
      10,
    );
    expect(fake.cardTransactions.list).toHaveBeenCalledWith(
      expect.objectContaining({ creditCardIds: [] }),
      undefined,
      11,
    );
  });

  it('a named Holding empties the card side — card rows carry no Holding (OQ-207)', async () => {
    const fake = fakeDeps();
    await browseOf(fake).listTransactions(
      context,
      HOUSEHOLD_ID,
      { holdingId: MARKET_HOLDING.id },
      undefined,
      10,
    );
    expect(fake.cardTransactions.list).toHaveBeenCalledWith(
      expect.objectContaining({ creditCardIds: [] }),
      undefined,
      11,
    );
  });

  it('a picked card alone narrows the card side', async () => {
    const fake = fakeDeps();
    await browseOf(fake).listTransactions(
      context,
      HOUSEHOLD_ID,
      { creditCardIds: [CARD_ROW.creditCardId] },
      undefined,
      10,
    );
    expect(fake.cardTransactions.list).toHaveBeenCalledWith(
      expect.objectContaining({ creditCardIds: [CARD_ROW.creditCardId] }),
      undefined,
      11,
    );
  });

  describe('the card picker over two visible cards (OQ-204, review B4)', () => {
    const OTHER_CARD = { ...CARD, id: 'card-2', last4: '9876' };

    /**
     * A fake whose visible Accounts carry both cards; a pick by Account names `picked`.
     *
     * @param picked - The cards the picked Accounts carry.
     * @returns The fake.
     */
    const twoCards = (picked: (typeof CARD)[]) => {
      const fake = fakeDeps();
      fake.creditCards.listByAccounts.mockResolvedValueOnce([CARD, OTHER_CARD])
        .mockResolvedValueOnce(picked);
      return fake;
    };

    it('takes every visible card when nothing is picked', async () => {
      const fake = twoCards([]);
      await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 10);
      expect(fake.cardTransactions.list).toHaveBeenCalledWith(
        expect.objectContaining({ creditCardIds: [CARD.id, OTHER_CARD.id] }),
        undefined,
        11,
      );
    });

    it('takes only the picked Account\'s card', async () => {
      const fake = twoCards([OTHER_CARD]);
      await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {
        accountIds: [CHECKING.id],
      }, undefined, 10);
      expect(fake.creditCards.listByAccounts).toHaveBeenLastCalledWith([CHECKING.id]);
      expect(fake.cardTransactions.list).toHaveBeenCalledWith(
        expect.objectContaining({ creditCardIds: [OTHER_CARD.id] }),
        undefined,
        11,
      );
    });

    it('takes only the picked card, never one the caller can\'t see', async () => {
      const fake = twoCards([]);
      await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {
        creditCardIds: [OTHER_CARD.id, 'hidden-card'],
      }, undefined, 10);
      expect(fake.creditCards.listByAccounts).toHaveBeenCalledTimes(1);
      expect(fake.cardTransactions.list).toHaveBeenCalledWith(
        expect.objectContaining({ creditCardIds: [OTHER_CARD.id] }),
        undefined,
        11,
      );
    });
  });

  describe('paging (review B5)', () => {
    it('hands each ledger its half of the token on the next page', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.list.mockResolvedValueOnce([
        accountRow('a2', '2026-10-13'), accountRow('a1', '2026-10-12'),
      ]);
      fake.cardTransactions.list.mockResolvedValueOnce([
        cardRow('c2', '2026-10-14'), cardRow('c1', '2026-10-11'),
      ]);
      const first = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 2);
      expect(first.nextCursor).toBe('tx2.2026-10-13:a2|2026-10-14:c2');
      await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, first.nextCursor!, 2);
      expect(fake.accountTransactions.list).toHaveBeenLastCalledWith(
        expect.anything(),
        { date: '2026-10-13', id: 'a2' },
        3,
      );
      expect(fake.cardTransactions.list).toHaveBeenLastCalledWith(
        expect.anything(),
        { date: '2026-10-14', id: 'c2' },
        3,
      );
    });

    it('asks a finished ledger nothing more, and it adds nothing', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.list.mockResolvedValue([accountRow('a1', '2026-10-12')]);
      const accountDone = await browseOf(fake).listTransactions(
        context,
        HOUSEHOLD_ID,
        {},
        'tx2.-|2026-10-14:c2',
        5,
      );
      expect(fake.accountTransactions.list).not.toHaveBeenCalled();
      expect(accountDone.items).toEqual([]);

      fake.cardTransactions.list.mockClear();
      const cardDone = await browseOf(fake).listTransactions(
        context,
        HOUSEHOLD_ID,
        {},
        'tx2.2026-10-13:a2|-',
        5,
      );
      expect(fake.cardTransactions.list).not.toHaveBeenCalled();
      expect(cardDone.items.map(({ transaction }) => transaction.id)).toEqual(['a1']);
    });

    it.each([
      ['a half with no separator', 'tx2.2026-10-13|'],
      ['a date with a prefix', 'tx2.x2026-10-13:a1|'],
      ['a date with a suffix', 'tx2.2026-10-13x:a1|'],
      ['an empty id', 'tx2.2026-10-13:|'],
    ])('refuses a half-token that is %s', async (_label, cursor) => {
      const fake = fakeDeps();
      await expect(browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, cursor, 10))
        .rejects.toMatchObject({
          domainError: { code: 'validation.failed', details: [{ field: 'cursor' }] },
        });
      expect(fake.accountTransactions.list).not.toHaveBeenCalled();
    });

    it('nets each day and currency apart, and counts the page\'s months', async () => {
      const fake = fakeDeps();
      fake.accountTransactions.list.mockResolvedValue([
        accountRow('a2', '2026-10-13'), accountRow('a1', '2026-09-30'),
      ]);
      fake.accountTransactions.dayTotals.mockResolvedValue([
        {
          date: '2026-10-13', currency: 'BRL', kind: 'withdrawal', total: 1_000,
        },
        {
          date: '2026-10-13', currency: 'USD', kind: 'deposit', total: 300,
        },
        {
          date: '2026-09-30', currency: 'BRL', kind: 'deposit', total: 200,
        },
      ]);
      const page = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 10);
      expect(page.dayTotals).toEqual([
        { date: '2026-10-13', currency: 'BRL', net: -1_000 },
        { date: '2026-10-13', currency: 'USD', net: 300 },
        { date: '2026-09-30', currency: 'BRL', net: 200 },
      ]);
      expect(fake.accountTransactions.monthCounts)
        .toHaveBeenCalledWith(expect.anything(), ['2026-10', '2026-09']);
    });
  });

  it('nets the page days by direction and sums months over the whole set (FR-3.12)', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.list.mockResolvedValue([accountRow('a1', '2026-10-13')]);
    fake.cardTransactions.list.mockResolvedValue([]);
    fake.accountTransactions.dayTotals.mockResolvedValue([
      {
        date: '2026-10-13', currency: 'BRL', kind: 'withdrawal', total: 1_000,
      },
      {
        date: '2026-10-13', currency: 'BRL', kind: 'deposit', total: 400,
      },
    ]);
    fake.accountTransactions.monthCounts.mockResolvedValue([{ month: '2026-10', count: 3 }]);
    fake.cardTransactions.monthCounts.mockResolvedValue([{ month: '2026-10', count: 2 }]);
    const page = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 10);
    expect(page.dayTotals).toEqual([{ date: '2026-10-13', currency: 'BRL', net: -600 }]);
    expect(page.monthCounts).toEqual([{ month: '2026-10', count: 5 }]);
    // The totals cover the days present in the page, over the whole filtered set.
    expect(fake.accountTransactions.dayTotals).toHaveBeenCalledWith(
      expect.anything(),
      ['2026-10-13'],
    );
  });

  it('answers an empty page with no cursor and no totals', async () => {
    const fake = fakeDeps();
    const page = await browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 10);
    expect(page).toEqual({
      items: [], nextCursor: null, dayTotals: [], monthCounts: [],
    });
  });

  it('refuses a household the caller is not in', async () => {
    const fake = fakeDeps();
    fake.authorization.authorize.mockResolvedValue({ outcome: 'forbidden' });
    await expect(browseOf(fake).listTransactions(context, HOUSEHOLD_ID, {}, undefined, 10))
      .rejects.toMatchObject({ domainError: { code: 'auth.forbidden' } });
  });
});

describe('getTransaction', () => {
  it('answers an Account-ledger row tagged with its ledger (CUC-4)', async () => {
    const fake = fakeDeps();
    const row = await browseOf(fake).getTransaction(context, HOUSEHOLD_ID, ROW.id);
    expect(row.ledger).toBe('account');
  });

  it('keeps a transfer\'s other side when the caller sees its Account (review B5)', async () => {
    const fake = fakeDeps();
    const pair = {
      id: 'side-2', accountId: CHECKING.id, amount: 5_000, currency: 'BRL',
    };
    fake.accountTransactions.findById.mockResolvedValue({ ...ROW, pair });
    fake.accounts.list.mockResolvedValue([ACCOUNT, CHECKING]);
    const row = await browseOf(fake).getTransaction(context, HOUSEHOLD_ID, ROW.id);
    expect(row).toEqual({ ledger: 'account', transaction: { ...ROW, pair } });
  });

  it('answers a card row through its Account', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    const row = await browseOf(fake).getTransaction(context, HOUSEHOLD_ID, CARD_ROW.id);
    expect(row.ledger).toBe('card');
  });

  it('refuses a transaction on neither ledger', async () => {
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    fake.cardTransactions.findById.mockResolvedValue(undefined);
    await expect(browseOf(fake).getTransaction(context, HOUSEHOLD_ID, 'missing'))
      .rejects.toMatchObject({ domainError: { code: 'transaction.not_found' } });
  });

  it('refuses a row the caller may not see', async () => {
    const fake = fakeDeps();
    fake.authorization.authorize.mockResolvedValue({ outcome: 'forbidden' });
    await expect(browseOf(fake).getTransaction(context, HOUSEHOLD_ID, ROW.id))
      .rejects.toMatchObject({ domainError: { code: 'auth.forbidden' } });
  });
});
