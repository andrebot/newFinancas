import { defaultCategoriesFor } from '@financas/reference';
import cycleOf from '../../accessors/billingCycle';
import type {
  accountMonthBalances, accounts, categories, creditCardMonthBalances, creditCards,
  householdMemberships, households, indexRateValues, subcategories, users,
} from '../schema';

/** Every row of the demo household, ready to insert (OQ-98). */
export interface DemoSeed {
  readonly users: (typeof users.$inferInsert)[];
  readonly households: (typeof households.$inferInsert)[];
  readonly memberships: (typeof householdMemberships.$inferInsert)[];
  readonly categories: (typeof categories.$inferInsert)[];
  readonly subcategories: (typeof subcategories.$inferInsert)[];
  readonly accounts: (typeof accounts.$inferInsert)[];
  readonly creditCards: (typeof creditCards.$inferInsert)[];
  readonly accountMonthBalances: (typeof accountMonthBalances.$inferInsert)[];
  readonly creditCardMonthBalances: (typeof creditCardMonthBalances.$inferInsert)[];
  readonly indexRates: (typeof indexRateValues.$inferInsert)[];
}

/** The demo users' stored credentials: the hash and the sealed TOTP secret. */
export interface DemoCredentials {
  readonly passwordHash: string;
  readonly encryptedMfaSecret: string;
}

/**
 * A fixed id for demo row `n`, so re-running the seed inserts nothing new.
 *
 * @param rowNumber - Row number, unique across the demo seed.
 * @returns A version-7-shaped UUID.
 */
export const demoId = (rowNumber: number): string => (
  `0d3e0000-0000-7000-8000-${String(rowNumber).padStart(12, '0')}`
);

const ANA = demoId(1);
const BEN = demoId(2);
const HOUSEHOLD = demoId(10);
const CHECKING_BRL = demoId(20);
const CHECKING_USD = demoId(21);
const INVESTMENTS = demoId(22);
const CARDS_ACCOUNT = demoId(23);
const CARD = demoId(30);
const CARD_CLOSING_DAY = 5;

/** Opening balances per account, in minor units (FR-2.1). */
const OPENING_BALANCES: Record<string, number> = {
  [CHECKING_BRL]: 250_000,
  [CHECKING_USD]: 320_050,
  [INVESTMENTS]: 0,
  [CARDS_ACCOUNT]: 0,
};

/**
 * A demo user signing in with the shared dev credentials.
 *
 * @param id - Fixed id.
 * @param firstName - First name; the email is derived from it.
 * @param language - UI language.
 * @param theme - UI theme.
 * @param credentials - The stored dev credentials.
 * @param today - The seeding date: the MFA enrollment counts as confirmed then (OQ-149).
 * @returns The user row.
 */
const demoUser = (
  id: string,
  firstName: string,
  language: string,
  theme: string,
  credentials: DemoCredentials,
  today: Date,
): DemoSeed['users'][number] => ({
  id,
  email: `${firstName.toLowerCase()}@demo.financas.local`,
  firstName,
  lastName: 'Demo',
  language,
  theme,
  passwordHash: credentials.passwordHash,
  mfaSecret: credentials.encryptedMfaSecret,
  mfaConfirmedAt: today,
});

/**
 * A demo account in the demo household.
 *
 * @param id - Fixed id.
 * @param ownerUserId - Owner (personal) or creator (shared).
 * @param name - Display name.
 * @param type - Account type.
 * @param currency - ISO currency code.
 * @param visibility - `personal` or `shared`.
 * @returns The account row; its starting-balance date is the seeding day's.
 */
const demoAccount = (
  id: string,
  ownerUserId: string,
  name: string,
  type: string,
  currency: string,
  visibility: string,
): Omit<DemoSeed['accounts'][number], 'startingBalanceDate'> => ({
  id, householdId: HOUSEHOLD, ownerUserId, name, type, currency, visibility,
});

/**
 * Builds the default categories in the owner's language, with fixed ids.
 *
 * @returns Category and subcategory rows.
 */
const demoCategories = (): Pick<DemoSeed, 'categories' | 'subcategories'> => {
  const defaults = defaultCategoriesFor('pt-BR');
  return {
    categories: defaults.map((category, index) => ({
      id: demoId(100 + index),
      householdId: HOUSEHOLD,
      name: category.name,
      icon: category.icon,
      color: category.color,
    })),
    subcategories: defaults.flatMap((category, index) => category.subcategories.map(
      (name, sub) => ({
        id: demoId(200 + index * 10 + sub), categoryId: demoId(100 + index), name,
      }),
    )),
  };
};

const INDEX_RATES: readonly [string, number][] = [
  ['selic', 150_000], ['cdi', 149_000], ['ipca', 51_700], ['igpm', 35_000],
];

/**
 * Builds the demo household: Ana (Owner, pt-BR) and Ben (Member, en-US), the
 * default categories, BRL and USD accounts with opening balances for the
 * current month, a credit card, and index rates. Later slices extend it.
 *
 * @param today - The seeding date; month balances and index rates use it.
 * @param credentials - The dev credentials both users sign in with.
 * @returns Every row, with fixed ids.
 */
export const buildDemoSeed = (today: Date, credentials: DemoCredentials): DemoSeed => {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const asOfDate = today.toISOString().slice(0, 10);

  return {
    users: [
      demoUser(ANA, 'Ana', 'pt-BR', 'dark', credentials, today),
      demoUser(BEN, 'Ben', 'en-US', 'light', credentials, today),
    ],
    households: [{ id: HOUSEHOLD, name: 'Casa Demo' }],
    memberships: [
      {
        id: demoId(11), householdId: HOUSEHOLD, userId: ANA, role: 'Owner',
      },
      {
        id: demoId(12), householdId: HOUSEHOLD, userId: BEN, role: 'Member',
      },
    ],
    ...demoCategories(),
    accounts: [
      demoAccount(CHECKING_BRL, ANA, 'Conta Corrente', 'checking', 'BRL', 'shared'),
      demoAccount(CHECKING_USD, BEN, 'Main Checking', 'checking', 'USD', 'personal'),
      demoAccount(INVESTMENTS, ANA, 'Investimentos', 'investment', 'BRL', 'shared'),
      demoAccount(CARDS_ACCOUNT, ANA, 'Cartões', 'credit_card_only', 'BRL', 'personal'),
    ].map((account) => ({ ...account, startingBalanceDate: asOfDate })),
    creditCards: [{
      id: CARD,
      accountId: CARDS_ACCOUNT,
      network: 'mastercard',
      last4: '4242',
      closingDay: CARD_CLOSING_DAY,
      dueDay: 12,
      expirationMonth: 8,
      expirationYear: 2030,
    }],
    accountMonthBalances: Object.entries(OPENING_BALANCES).map(([accountId, balance], index) => ({
      id: demoId(40 + index),
      accountId,
      year,
      month,
      openingBalance: balance,
      endingBalance: balance,
    })),
    creditCardMonthBalances: [{
      id: demoId(50),
      creditCardId: CARD,
      ...cycleOf(asOfDate, CARD_CLOSING_DAY),
      openingOutstandingBalance: 0,
      endingOutstandingBalance: 0,
    }],
    indexRates: INDEX_RATES.map(([indexCode, value], index) => ({
      id: demoId(60 + index),
      householdId: HOUSEHOLD,
      indexCode,
      value,
      asOfDate,
      createdByUserId: ANA,
    })),
  };
};
