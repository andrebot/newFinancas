import type {
  Account, Category, CreditCard, LedgerItem, TransactionPage,
} from '@financas/api-types';
import { ledgerLookupOf } from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerRow';

// What the Browse Transactions suites browse: a BRL account with a Visa, a USD
// account, a credit-card-only account with its own card, an archived account;
// categories with subcategories; ledger rows of both ledgers.

const NOW = '2026-09-01T12:00:00Z';

/** A card on the account given. */
export const cardOf = (id: string, accountId: string, last4: string): CreditCard => ({
  id,
  accountId,
  network: 'visa',
  last4,
  closingDay: 5,
  dueDay: 12,
  expirationMonth: 12,
  expirationYear: 2030,
  createdAt: NOW,
  outstandingBalance: 0,
});

/** An open account. */
export const accountOf = (
  id: string,
  over: Partial<Account> = {},
): Account => ({
  id,
  householdId: 'h1',
  ownerUserId: null,
  name: id,
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-01-01',
  archivedAt: null,
  createdAt: NOW,
  currentBalance: 0,
  cards: [],
  ...over,
});

export const ITAU = accountOf('itau', {
  name: 'Itaú Conta', cards: [cardOf('visa1', 'itau', '1111')],
});
export const CHASE = accountOf('chase', { name: 'Main Checking', currency: 'USD' });
export const NUBANK_CARD_ONLY = accountOf('nucard', {
  name: 'Nubank', type: 'credit_card_only', cards: [cardOf('nu1', 'nucard', '2222')],
});
export const OLD = accountOf('old', { name: 'Old', archivedAt: NOW });
export const ACCOUNTS: readonly Account[] = [ITAU, CHASE, NUBANK_CARD_ONLY, OLD];

export const CATEGORIES: readonly Category[] = [
  {
    id: 'groceries',
    householdId: 'h1',
    name: 'Groceries',
    icon: 'shopping-cart-outline',
    color: 'mint',
    archivedAt: null,
    createdAt: NOW,
    subcategories: [
      { id: 'market', name: 'Market', archivedAt: null },
      { id: 'gone', name: 'Gone', archivedAt: NOW },
    ],
  },
  {
    id: 'housing',
    householdId: 'h1',
    name: 'Housing',
    icon: 'home-outline',
    color: 'sky',
    archivedAt: null,
    createdAt: NOW,
    subcategories: [],
  },
  {
    id: 'retired',
    householdId: 'h1',
    name: 'Retired',
    icon: 'home-outline',
    color: 'sun',
    archivedAt: NOW,
    createdAt: NOW,
    subcategories: [],
  },
] as unknown as readonly Category[];

/** An account ledger row's shape. */
type AccountRow = LedgerItem & { ledger: 'account' };

/** An account ledger row. */
export const accountRowOf = (over: Partial<AccountRow> = {}): LedgerItem => ({
  ledger: 'account',
  id: 't1',
  accountId: 'itau',
  kind: 'pix_payment',
  effect: 'movement',
  date: '2026-09-14',
  amount: 8_690,
  currency: 'BRL',
  categoryId: 'groceries',
  subcategoryId: null,
  description: 'Feira',
  holdingId: null,
  holding: null,
  quantity: null,
  creditCardId: null,
  ...over,
});

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

/** A bill payment from Itaú Conta to the credit-card-only account's card, both BRL (OQ-219). */
export const BILL_PAYMENT = accountRowOf({
  id: 'b1',
  accountId: 'itau',
  kind: 'credit_card_bill_payment',
  effect: 'bill_payment',
  creditCardId: 'nu1',
  categoryId: null,
  amount: 20_000,
  description: 'Nubank Payment',
});
