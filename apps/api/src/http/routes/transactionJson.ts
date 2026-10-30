import type { AccountTransaction, CardTransaction } from '../../managers/transaction';

// TransactionManager's results in the contract's JSON shapes (the `LedgerItem`
// discriminator): times as ISO strings, only the fields the contract names — a
// trade row shows its units traded (`quantity`, positive), not its signed deltas.

/** The units a trade row traded — positive; cash rows carry none. */
const quantityOf = (row: AccountTransaction): number | null => (
  row.trade === null ? null : Math.abs(row.trade.quantityDelta)
);

/**
 * An Account-ledger transaction as the contract shows it
 * (`components/schemas/AccountTransaction`).
 *
 * @param row - The row.
 * @returns The JSON shape, tagged `ledger: 'account'`.
 */
export const toAccountTransactionJson = (row: AccountTransaction) => ({
  id: row.id,
  accountId: row.accountId,
  kind: row.kind,
  effect: row.effect,
  date: row.date,
  amount: row.amount,
  currency: row.currency,
  categoryId: row.categoryId,
  subcategoryId: row.subcategoryId,
  description: row.description,
  holdingId: row.holdingId,
  holding: row.holding,
  quantity: quantityOf(row),
  creditCardId: row.creditCardId,
  // A transfer between own accounts: its other side, as the caller may see it (OQ-222).
  transfer: row.pair === null
    ? null
    : { accountId: row.pair.accountId, amount: row.pair.amount, currency: row.pair.currency },
  createdByUserId: row.createdByUserId,
  source: row.source,
  createdAt: row.createdAt.toISOString(),
  ledger: 'account' as const,
});

/**
 * A card-ledger transaction as the contract shows it
 * (`components/schemas/CardTransaction`).
 *
 * @param row - The row.
 * @returns The JSON shape, tagged `ledger: 'card'`.
 */
export const toCardTransactionJson = (row: CardTransaction) => ({
  id: row.id,
  creditCardId: row.creditCardId,
  kind: row.kind,
  date: row.date,
  amount: row.amount,
  currency: row.currency,
  categoryId: row.categoryId,
  subcategoryId: row.subcategoryId,
  description: row.description,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  ledger: 'card' as const,
});

/**
 * A row of either ledger into the contract's `LedgerItem` — an Account row is
 * recognised by its `accountId`, which a card row never carries.
 *
 * @param row - The row on either ledger.
 * @returns The JSON shape, tagged with its ledger.
 */
export const toLedgerItemJson = (row: AccountTransaction | CardTransaction) => (
  'accountId' in row ? toAccountTransactionJson(row) : toCardTransactionJson(row)
);
