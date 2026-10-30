import type {
  Account, Category, CreditCard, InvestmentHolding, LedgerItem,
} from '@financas/api-types';
import type { SplitGoal } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/recordTransactionState';
import { newFormOf, type TransactionForm } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/transactionForm';

// What the Record Transaction suites record against: a BRL checking account
// with a card, a USD checking account, a credit-card-only account with its
// own card, an archived account; a market-priced and a fixed-term Holding;
// categories with subcategories; Goals.

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

export const STOCK: InvestmentHolding = {
  id: 'bbas3',
  accountId: 'itau',
  assetType: 'stock',
  ticker: 'BBAS3',
  quantity: 300 * 100_000_000,
  costBasis: 1_296_000,
  rate: null,
  archivedAt: null,
};

export const CDB: InvestmentHolding = {
  id: 'cdb1',
  accountId: 'itau',
  assetType: 'cdb',
  ticker: 'CDB Inter 2028',
  quantity: 100_000_000,
  costBasis: 1_000_000,
  rate: { type: 'cdi', value: 1_100_000, spread: null },
  dueDate: '2028-03-15',
  interestPayment: 'at_maturity',
  incentivised: null,
  archivedAt: null,
};

export const CLOSED: InvestmentHolding = {
  ...STOCK, id: 'closed', ticker: 'OLD3', archivedAt: NOW,
};

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

export const GOALS: readonly SplitGoal[] = [
  {
    id: 'house', name: 'House', progress: 57, completed: false,
  },
  { id: 'laptop', name: 'Laptop', completed: false },
  {
    id: 'trip', name: 'Trip', progress: 100, completed: true,
  },
];

/** A new form on the given kind and account, as the drawer would hold it. */
export const formOf = (over: Partial<TransactionForm> = {}): TransactionForm => ({
  ...newFormOf([], '2026-09-14'),
  ...over,
});

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
