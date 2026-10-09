import { defaultCategoriesFor } from '@financas/reference';
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

/**
 * Credentials that can never verify. Demo users can log in once U4 (password
 * hashing + MFA) sets real ones; until then the rows only exist for data.
 */
export const UNUSABLE_SECRET = 'demo:unusable';

/**
 * A fixed id for demo row `n`, so re-running the seed inserts nothing new.
 *
 * @param n - Row number, unique across the demo seed.
 * @returns A version-7-shaped UUID.
 */
export const demoId = (n: number): string => (
  `0d3e0000-0000-7000-8000-${String(n).padStart(12, '0')}`
);

const ANA = demoId(1);
const BEN = demoId(2);
const HOUSEHOLD = demoId(10);
const CHECKING_BRL = demoId(20);
const CHECKING_USD = demoId(21);
const INVESTMENTS = demoId(22);
const CARDS_ACCOUNT = demoId(23);
const CARD = demoId(30);

/** Opening balances per account, in minor units (FR-2.1). */
const OPENING_BALANCES: Record<string, number> = {
  [CHECKING_BRL]: 250_000,
  [CHECKING_USD]: 320_050,
  [INVESTMENTS]: 0,
  [CARDS_ACCOUNT]: 0,
};

/**
 * A demo user with unusable credentials.
 *
 * @param id - Fixed id.
 * @param firstName - First name; the email is derived from it.
 * @param language - UI language.
 * @param theme - UI theme.
 * @returns The user row.
 */
const demoUser = (
  id: string,
  firstName: string,
  language: string,
  theme: string,
): DemoSeed['users'][number] => ({
  id,
  email: `${firstName.toLowerCase()}@demo.financas.local`,
  firstName,
  lastName: 'Demo',
  language,
  theme,
  passwordHash: UNUSABLE_SECRET,
  mfaSecret: UNUSABLE_SECRET,
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
 * @returns The account row.
 */
const demoAccount = (
  id: string,
  ownerUserId: string,
  name: string,
  type: string,
  currency: string,
  visibility: string,
): DemoSeed['accounts'][number] => ({
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
 * @returns Every row, with fixed ids.
 */
export const buildDemoSeed = (today: Date): DemoSeed => {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const asOfDate = today.toISOString().slice(0, 10);

  return {
    users: [demoUser(ANA, 'Ana', 'pt-BR', 'dark'), demoUser(BEN, 'Ben', 'en-US', 'light')],
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
    ],
    creditCards: [{
      id: CARD,
      accountId: CARDS_ACCOUNT,
      network: 'mastercard',
      last4: '4242',
      closingDay: 5,
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
      year,
      month,
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
