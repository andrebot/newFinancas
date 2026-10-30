import type { LedgerItem, TransactionPage } from '@financas/api-types';
import { ledgerLookupOf } from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerRow';
import { ACCOUNTS, CATEGORIES, accountRowOf } from '../recordTransaction/fixtures';

// What the Browse Transactions suites browse: Record Transaction's accounts
// (a BRL account with a Visa, a USD account, a credit-card-only account with
// its own card, an archived account) and categories, with ledger rows of
// both ledgers.

export {
  ACCOUNTS, CATEGORIES, CHASE, ITAU, NUBANK_CARD_ONLY, OLD, accountOf, accountRowOf, cardOf,
} from '../recordTransaction/fixtures';

/**
 * Copies a value without some of its fields — how a row the API sent with a
 * field missing looks (every field of the contract is optional).
 *
 * @param value - The value.
 * @param keys - The fields to leave out.
 * @returns The copy.
 */
export const omit = <Value extends object>(value: Value, ...keys: readonly string[]): Value => (
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) as Value
);

/** The lookup over the fixtures' accounts and categories. */
export const LOOKUP = ledgerLookupOf(ACCOUNTS, CATEGORIES);

/** A card ledger row's shape. */
type CardRow = LedgerItem & { ledger: 'card' };

/** A card ledger row: a charge on Itaú's Visa. */
export const cardRowOf = (over: Partial<CardRow> = {}): LedgerItem => ({
  ledger: 'card',
  id: 'c1',
  creditCardId: 'visa1',
  kind: 'charge',
  date: '2026-09-12',
  amount: 3_990,
  currency: 'BRL',
  categoryId: 'housing',
  subcategoryId: null,
  description: 'Netflix',
  ...over,
});

/** A page of rows, with the figures given. */
export const pageOf = (
  items: readonly LedgerItem[],
  over: Partial<TransactionPage> = {},
): TransactionPage => ({
  items: [...items], dayTotals: [], monthCounts: [], nextCursor: null, ...over,
});

/** A bill payment from Main Checking (USD) to Itaú's Visa. */
export const BILL_PAYMENT = accountRowOf({
  id: 'b1',
  accountId: 'chase',
  kind: 'credit_card_bill_payment',
  effect: 'bill_payment',
  creditCardId: 'visa1',
  categoryId: null,
  currency: 'USD',
  amount: 20_000,
  description: 'Visa Payment',
});
