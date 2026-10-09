import type { Database } from '../database';
import {
  accountMonthBalances, accounts, categories, creditCardMonthBalances, creditCards,
  householdMemberships, households, indexRateValues, subcategories, users,
} from '../schema';
import type { DemoSeed } from './demoSeed';

/**
 * Inserts the demo seed in foreign-key order, in one transaction. Rows that
 * already exist (same id) are left untouched, so running it again is harmless.
 *
 * @param db - The database, connected as the application role.
 * @param seed - Rows from `buildDemoSeed`.
 * @returns Resolves once everything is inserted.
 */
const applyDemoSeed = async (db: Database, seed: DemoSeed): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.insert(users).values(seed.users).onConflictDoNothing();
    await tx.insert(households).values(seed.households).onConflictDoNothing();
    await tx.insert(householdMemberships).values(seed.memberships).onConflictDoNothing();
    await tx.insert(categories).values(seed.categories).onConflictDoNothing();
    await tx.insert(subcategories).values(seed.subcategories).onConflictDoNothing();
    await tx.insert(accounts).values(seed.accounts).onConflictDoNothing();
    await tx.insert(creditCards).values(seed.creditCards).onConflictDoNothing();
    await tx.insert(accountMonthBalances).values(seed.accountMonthBalances).onConflictDoNothing();
    await tx.insert(creditCardMonthBalances).values(seed.creditCardMonthBalances)
      .onConflictDoNothing();
    await tx.insert(indexRateValues).values(seed.indexRates).onConflictDoNothing();
  });
};

export default applyDemoSeed;
