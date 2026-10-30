import type {
  Account, CreditCard, GoalWithProgress, MonthOverviewReport,
} from '@financas/api-types';

// What the month's suites read (Month Overview, its rails, the balance
// cards): a BRL checking account with a Visa, a USD savings account, a
// credit-card-only account with its own Mastercard (the report sends its own
// row, as the server does, and its card's); a September 2026 report
// in both currencies with a budget over its target and a Goal.

const NOW = '2026-09-01T12:00:00Z';

/** A card on the account given. */
export const cardOf = (
  id: string,
  accountId: string,
  over: Partial<CreditCard> = {},
): CreditCard => ({
  id,
  accountId,
  network: 'visa',
  last4: '1111',
  closingDay: 5,
  dueDay: 12,
  expirationMonth: 12,
  expirationYear: 2030,
  createdAt: NOW,
  outstandingBalance: 0,
  ...over,
});

/** An open account. */
export const accountOf = (id: string, over: Partial<Account> = {}): Account => ({
  id,
  householdId: 'home',
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

export const ACCOUNTS: readonly Account[] = [
  accountOf('itau', { name: 'Itaú Conta', cards: [cardOf('visa', 'itau')] }),
  accountOf('savings', { name: 'Emergency Fund', type: 'savings', currency: 'USD' }),
  accountOf('nubank', {
    name: 'Nubank',
    type: 'credit_card_only',
    cards: [cardOf('master', 'nubank', { network: 'mastercard', last4: '4242' })],
  }),
];

/** A USD Goal, funded as given. */
export const goalOf = (
  id: string,
  fundedBy: GoalWithProgress['fundedBy'] = [],
): GoalWithProgress => ({
  id,
  householdId: 'home',
  ownerUserId: null,
  name: id,
  targetAmount: 1000000,
  targetCurrency: 'USD',
  dueDate: '2028-04-01',
  visibility: 'shared',
  createdAt: NOW,
  completedAt: null,
  fundedBy,
});

/** September 2026, in both currencies. */
export const REPORT: MonthOverviewReport = {
  reportType: 'month-overview',
  summary: [
    {
      currency: 'USD', in: 320000, out: 83139, net: 236861,
    },
    {
      currency: 'BRL', in: 0, out: 11680, net: -11680,
    },
  ],
  yearStrip: [
    {
      month: '2026-08', currency: 'USD', in: 300000, out: 120000,
    },
    {
      month: '2026-09', currency: 'USD', in: 320000, out: 83139,
    },
    {
      month: '2026-09', currency: 'BRL', in: 0, out: 11680,
    },
  ],
  balances: [
    {
      accountId: 'itau', creditCardId: null, currency: 'BRL', amount: 218035,
    },
    {
      accountId: 'itau', creditCardId: 'visa', currency: 'BRL', amount: 4599,
    },
    {
      accountId: 'savings', creditCardId: null, currency: 'USD', amount: 850000,
    },
    {
      accountId: 'nubank', creditCardId: null, currency: 'BRL', amount: 0,
    },
    {
      accountId: 'nubank', creditCardId: 'master', currency: 'BRL', amount: 45000,
    },
  ],
  budgets: [
    {
      budgetId: 'essentials',
      name: 'Household Essentials',
      currency: 'BRL',
      visibility: 'shared',
      targetAmount: 400000,
      spendAmount: 425000,
    },
  ],
  goals: [
    goalOf('Emergency Fund', [{
      holdingId: 'cdb',
      name: 'CDB',
      percentage: 100,
      contribution: { currency: 'USD', amount: 320000 },
    }]),
  ],
};
