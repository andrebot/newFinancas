import { findKind } from '@financas/reference';
import type {
  AccountTransaction, AccountTransactionFilter, DayKindTotal, LedgerCursor, MonthCount,
} from '../../accessors/accountTransactionAccessor';
import type {
  CardTransaction, CardTransactionFilter,
} from '../../accessors/cardTransactionAccessor';
import { accessToOwned, memberOnly, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import { validationFailed } from '../../utilities/domainError';
import { transactionNotFound } from './errors';
import type { TransactionDeps } from './context';

// Browse & Filter (CUC-4, FR-3.12): the household's transactions on both
// ledgers as one newest-first list — cursor-paginated on (date, id), narrowed
// to what the caller may see before any filter is applied (OQ-61). The page's
// day totals and month counts cover the days and months present in it, over
// the whole filtered set.

/** A row of either ledger, tagged with its ledger for the contract's `LedgerItem`. */
export type LedgerRow = | { readonly ledger: 'account'; readonly transaction: AccountTransaction }
  | { readonly ledger: 'card'; readonly transaction: CardTransaction };

/** Browse & Filter's criteria (FR-3.12, OQ-201/OQ-204), as the route validated it. */
export interface TransactionListFilter {
  /** The Account/Card picker; both empty means all of what is visible. */
  readonly accountIds?: readonly string[];
  readonly creditCardIds?: readonly string[];
  readonly kinds?: readonly string[];
  /** A Category includes its Subcategories. */
  readonly categoryIds?: readonly string[];
  readonly holdingId?: string;
  /** Inclusive `YYYY-MM-DD` bounds. */
  readonly from?: string;
  readonly to?: string;
}

/** The page the list answers with (the contract's TransactionPage). */
export interface TransactionPage {
  readonly items: LedgerRow[];
  readonly nextCursor: string | null;
  /** One net per day and currency present in the page, signed by direction. */
  readonly dayTotals: { readonly date: string; readonly currency: string; readonly net: number }[];
  /** The months present in the page, with their counts over the whole set. */
  readonly monthCounts: MonthCount[];
}

const CURSOR_PREFIX = 'tx2.';
/** A ledger's half of a token: resume from its start… */
const START = '';
/** …is done (no more rows), or `YYYY-MM-DD:<id>` to resume after that row. */
const DONE = '-';

/** Where each ledger sits in the merged stream. */
interface Positions {
  readonly account: string;
  readonly card: string;
}

/** A half-token's shape: a date and an id, nothing else. */
const isCursorPart = (part: string): boolean => {
  const separator = part.indexOf(':');
  if (separator < 0) return false;
  const date = part.slice(0, separator);
  const id = part.slice(separator + 1);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && id.length > 0;
};

/** Whether a half-token is one of the three allowed forms. */
const validPart = (part: string): boolean => part === START || part === DONE || isCursorPart(part);

/** Whether a token body holds two well-formed halves. */
const isTokenBody = (body: string): boolean => {
  const [accountPart, cardPart] = body.split('|');
  return accountPart !== undefined && cardPart !== undefined
    && validPart(accountPart) && validPart(cardPart);
};

/** A token that is not this list's — the client sent something else. */
const malformedCursor = (): ReturnType<typeof validationFailed> => (
  validationFailed([{ field: 'cursor', code: 'field.invalid' }])
);

/**
 * Decodes a page token into where each ledger resumes; both at their start for
 * the first page.
 *
 * @param cursor - The previous page's `nextCursor`.
 * @returns Each ledger's half-token.
 * @throws {DomainError} `validation.failed` on a malformed token.
 */
const decodePositions = (cursor: string | undefined): Positions => {
  if (!cursor) return { account: START, card: START };
  const body = cursor.startsWith(CURSOR_PREFIX) ? cursor.slice(CURSOR_PREFIX.length) : null;
  if (body === null || !isTokenBody(body)) throw malformedCursor();
  const [accountPart, cardPart] = body.split('|');
  return { account: accountPart!, card: cardPart! };
};

/** The cursor a half-token carries; none at the start. */
const tokenToCursor = (token: string): LedgerCursor | undefined => (
  token === START ? undefined : { date: token.slice(0, 10), id: token.slice(11) }
);

/**
 * Joins the two ledgers' positions into one opaque token.
 *
 * @param account - The Account ledger's half-token.
 * @param card - The Card ledger's half-token.
 * @returns The token, or `null` when both ledgers are done.
 */
const encodePositions = (account: string, card: string): string | null => (
  account === DONE && card === DONE ? null : `${CURSOR_PREFIX}${account}|${card}`
);

/**
 * Where one ledger resumes after a merged page: past its last row that made
 * the cut — its consumed rows are always a prefix of its own page, and an
 * empty fetch at the start means it has no matching rows at all.
 *
 * @param page - The ledger's fetched rows, newest first.
 * @param items - The merged page.
 * @param ledger - Which ledger this is.
 * @param previous - Its half-token before this page.
 * @returns Its half-token after it.
 */
const resumeOf = (
  page: AccountTransaction[] | CardTransaction[],
  items: LedgerRow[],
  ledger: 'account' | 'card',
  previous: string,
): string => {
  const consumed = items.filter((row) => row.ledger === ledger).length;
  if (page.length <= consumed) return DONE;
  // Nothing fetched means nothing left — a fresh start with no rows is done
  // by the guard above, so an empty merge here just resumes where we were.
  if (consumed === 0) return previous;
  // The consumed rows are a prefix, so the last one is at `consumed - 1`.
  const last = page[consumed - 1]!;
  return `${last.date}:${last.id}`;
};

/** Newest first on (date, id), the ledgers' own order. */
const compareRows = (
  left: AccountTransaction | CardTransaction,
  right: AccountTransaction | CardTransaction,
): number => {
  if (left.date !== right.date) return left.date > right.date ? -1 : 1;
  return right.id.localeCompare(left.id);
};

/** Merges the two ledgers' pages into one newest-first page on (date, id). */
const mergePages = (
  accountPage: AccountTransaction[],
  cardPage: CardTransaction[],
  limit: number,
): LedgerRow[] => (
  [...accountPage.map((transaction) => ({ ledger: 'account' as const, transaction })),
    ...cardPage.map((transaction) => ({ ledger: 'card' as const, transaction }))].sort(
    (left, right) => compareRows(left.transaction, right.transaction),
  ).slice(0, limit)
);

/** The days and months present in a page's rows. */
const spansOf = (items: LedgerRow[]) => {
  const dates = [...new Set(items.map(({ transaction }) => transaction.date))];
  return { dates, months: [...new Set(dates.map((date) => date.slice(0, 7)))] };
};

/** Signs a day's kind totals by direction and nets them per currency. */
const netTotalsOf = (totals: readonly DayKindTotal[]): TransactionPage['dayTotals'] => {
  const nets = new Map<string, { date: string; currency: string; net: number }>();
  totals.forEach(({
    date, currency, kind, total,
  }) => {
    const key = `${date}|${currency}`;
    const sign = findKind(kind)?.direction === 'in' ? 1 : -1;
    const current = nets.get(key) ?? { date, currency, net: 0 };
    nets.set(key, { ...current, net: current.net + sign * total });
  });
  return [...nets.values()];
};

/** Sums the two ledgers' month counts per month. */
const mergedMonthCounts = (
  accountMonths: readonly MonthCount[],
  cardMonths: readonly MonthCount[],
): MonthCount[] => {
  const counts = new Map<string, number>();
  [...accountMonths, ...cardMonths].forEach(({ month, count }) => {
    counts.set(month, (counts.get(month) ?? 0) + count);
  });
  return [...counts.entries()].map(([month, count]) => ({ month, count }));
};

/** The criteria both ledgers share: kinds, categories and the date bounds. */
const sharedFiltersOf = (filter: TransactionListFilter) => ({
  ...(filter.kinds && { kinds: filter.kinds }),
  ...(filter.categoryIds && { categoryIds: filter.categoryIds }),
  ...(filter.from !== undefined && { from: filter.from }),
  ...(filter.to !== undefined && { to: filter.to }),
});

/** The Account ledger's criteria: the visible scope plus the picker as-is. */
const accountFilterOf = (filter: TransactionListFilter, scopeAccountIds: readonly string[]) => ({
  scopeAccountIds,
  ...(filter.accountIds && { accountIds: filter.accountIds }),
  ...(filter.creditCardIds && { creditCardIds: filter.creditCardIds }),
  ...(filter.holdingId !== undefined && { holdingId: filter.holdingId }),
  ...sharedFiltersOf(filter),
});

/** The cards a picker names, narrowed to the visible ones (OQ-204): with no
 *  pick at all every visible card; with one — an Account's or a card's own —
 *  exactly those, and none when the picked Account has no cards. */
const pickedCards = async (
  deps: TransactionDeps,
  filter: TransactionListFilter,
  visibleCardIds: readonly string[],
): Promise<string[]> => {
  if (filter.accountIds === undefined && filter.creditCardIds === undefined) {
    return [...visibleCardIds];
  }
  const byAccount = filter.accountIds === undefined
    ? []
    : await deps.creditCards.listByAccounts(filter.accountIds);
  const picked = new Set([...(filter.creditCardIds ?? []), ...byAccount.map((card) => card.id)]);
  return visibleCardIds.filter((id) => picked.has(id));
};

/** The Card ledger's criteria: its picker, a picked Account included (OQ-204). A
 *  named Holding empties the side — card rows carry no Holding. */
const cardFilterOf = async (
  deps: TransactionDeps,
  filter: TransactionListFilter,
  visibleCards: readonly string[],
) => ({
  creditCardIds: filter.holdingId !== undefined
    ? []
    : await pickedCards(deps, filter, visibleCards),
  ...sharedFiltersOf(filter),
});

/** The page's day totals and month counts, over the whole filtered set. */
const pageTotals = async (
  deps: TransactionDeps,
  accountFilter: AccountTransactionFilter,
  cardFilter: CardTransactionFilter,
  items: LedgerRow[],
) => {
  const { dates, months } = spansOf(items);
  const [accountDays, cardDays, accountMonths, cardMonths] = await Promise.all([
    deps.accountTransactions.dayTotals(accountFilter, dates),
    deps.cardTransactions.dayTotals(cardFilter, dates),
    deps.accountTransactions.monthCounts(accountFilter, months),
    deps.cardTransactions.monthCounts(cardFilter, months),
  ]);
  return {
    dayTotals: netTotalsOf([...accountDays, ...cardDays]),
    monthCounts: mergedMonthCounts(accountMonths, cardMonths),
  };
};

/** Checks the view on an Account-ledger row's Account and tags it. */
const checkAccountView = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  accountId: string,
): Promise<void> => {
  const account = await deps.accounts.findById(householdId, accountId);
  await requireAccess(
    deps.authorization,
    context.actor.userId,
    householdId,
    accessToOwned(account, 'data.view'),
    transactionNotFound,
  );
};

/** Checks the view on a card row through its Account and tags it. */
const checkCardView = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  card: CardTransaction,
): Promise<void> => {
  const creditCard = await deps.creditCards.findById(householdId, card.creditCardId);
  const account = creditCard && await deps.accounts.findById(householdId, creditCard.accountId);
  await requireAccess(
    deps.authorization,
    context.actor.userId,
    householdId,
    accessToOwned(account, 'data.view'),
    transactionNotFound,
  );
};

/**
 * A transfer's other side as the caller may see it (OQ-222): kept when its
 * Account is one they see, otherwise reduced to its id — where the money came
 * from or went stays private.
 *
 * @param transaction - The row.
 * @param visibleAccountIds - The Accounts the caller sees.
 * @returns The row, its other side hidden when need be.
 */
export const withVisiblePair = (
  transaction: AccountTransaction,
  visibleAccountIds: ReadonlySet<string>,
): AccountTransaction => {
  const { pair } = transaction;
  if (pair === null || visibleAccountIds.has(pair.accountId!)) return transaction;
  return {
    ...transaction,
    pair: {
      id: pair.id, accountId: null, amount: null, currency: null,
    },
  };
};

/** Builds the Browse & Filter use cases. */
const createBrowse = (deps: TransactionDeps) => ({
  /**
   * One page of the household's transactions on both ledgers, newest first
   * (CUC-4, FR-3.12): only what the caller may see — others' personal
   * Accounts are left out before filtering; a picked Account also picks its
   * cards (OQ-204). The day totals and month counts cover the page's days
   * and months over the whole filtered set.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param filter - The criteria, as the route validated it.
   * @param cursor - The previous page's token; none for the first page.
   * @param limit - At most this many rows (the route bounds it).
   * @returns The page with its `nextCursor` and totals.
   * @throws {DomainError} `household.not_found`; `auth.forbidden`;
   *   `validation.failed` on a malformed cursor.
   */
  listTransactions: async (
    context: SignedInContext,
    householdId: string,
    filter: TransactionListFilter,
    cursor: string | undefined,
    limit: number,
  ): Promise<TransactionPage> => {
    await requireAccess(deps.authorization, context.actor.userId, householdId, memberOnly);
    const positions = decodePositions(cursor);
    const accounts = await deps.accounts.list(householdId, context.actor.userId);
    const scopeAccountIds = accounts.map((account) => account.id);
    const visibleCards = scopeAccountIds.length === 0
      ? []
      : (await deps.creditCards.listByAccounts(scopeAccountIds)).map((card) => card.id);
    const accountFilter = accountFilterOf(filter, scopeAccountIds);
    const cardFilter = await cardFilterOf(deps, filter, visibleCards);
    const [accountPage, cardPage] = await Promise.all([
      positions.account === DONE ? [] : deps.accountTransactions.list(
        accountFilter,
        tokenToCursor(positions.account),
        limit + 1,
      ),
      positions.card === DONE ? [] : deps.cardTransactions.list(
        cardFilter,
        tokenToCursor(positions.card),
        limit + 1,
      ),
    ]);
    const visible = new Set(scopeAccountIds);
    const items = mergePages(
      accountPage.map((transaction) => withVisiblePair(transaction, visible)),
      cardPage,
      limit,
    );
    const nextCursor = encodePositions(
      resumeOf(accountPage, items, 'account', positions.account),
      resumeOf(cardPage, items, 'card', positions.card),
    );
    if (items.length === 0) {
      return {
        items, nextCursor, dayTotals: [], monthCounts: [],
      };
    }
    return { items, nextCursor, ...(await pageTotals(deps, accountFilter, cardFilter, items)) };
  },

  /**
   * One transaction on either ledger by id (CUC-4): the row's own ledger says
   * which it is; access rides its Account — a card's charges are seen through
   * their Account.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param transactionId - The row, on either ledger.
   * @returns The transaction, tagged with its ledger.
   * @throws {DomainError} `household.not_found` / `transaction.not_found`;
   *   `auth.forbidden`.
   */
  getTransaction: async (
    context: SignedInContext,
    householdId: string,
    transactionId: string,
  ): Promise<LedgerRow> => {
    const account = await deps.accountTransactions.findById(householdId, transactionId);
    if (account) {
      await checkAccountView(deps, context, householdId, account.accountId);
      if (account.pair === null) return { ledger: 'account', transaction: account };
      const visible = await deps.accounts.list(householdId, context.actor.userId);
      const seen = new Set(visible.map((each) => each.id));
      return { ledger: 'account', transaction: withVisiblePair(account, seen) };
    }
    const card = await deps.cardTransactions.findById(householdId, transactionId);
    if (!card) {
      // Only the membership check, so a non-member still learns nothing (OQ-117).
      await requireAccess(deps.authorization, context.actor.userId, householdId, memberOnly);
      throw transactionNotFound();
    }
    await checkCardView(deps, context, householdId, card);
    return { ledger: 'card', transaction: card };
  },
});

export default createBrowse;
