import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createAccountAccessor from '../../../src/accessors/accountAccessor';
import createCreditCardAccessor from '../../../src/accessors/creditCardAccessor';
import type { Database } from '../../../src/db/database';
import {
  accounts, creditCards, households, users,
} from '../../../src/db/schema';
import createUnitOfWork from '../../../src/utilities/unitOfWork';
import { createMigratedDatabase, withRollback } from '../support/database';

// The unit of work against a real database (OQ-175): two Accessors' writes
// commit together, and a throw undoes both.

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const TODAY = '2026-10-17';
const CARD = {
  network: 'visa',
  last4: '4242',
  closingDay: 5,
  dueDay: 12,
  expirationMonth: 9,
  expirationYear: 2030,
};

/**
 * Builds the two Accessors over a database or transaction.
 *
 * @param db - Where they read and write.
 * @returns The Accessors.
 */
const storesOver = (db: Database) => ({
  accounts: createAccountAccessor(db),
  creditCards: createCreditCardAccessor(db),
});

/**
 * Inserts a household and the user who will own its Account.
 *
 * @param db - The test database.
 * @returns Their ids.
 */
const addHousehold = async (db: Database) => {
  const [household] = await db.insert(households).values({ name: 'Casa' })
    .returning({ id: households.id });
  const [user] = await db.insert(users).values({
    email: 'ana@example.com', passwordHash: 'x', firstName: 'Ana', lastName: 'Lima', mfaSecret: 'x',
  }).returning({ id: users.id });
  return { householdId: household!.id, ownerUserId: user!.id };
};

/**
 * Creates an Account with one card through the unit of work.
 *
 * @param stores - The Accessors over the transaction.
 * @param owner - The household and the Account's owner.
 * @returns The Account's id.
 */
const createWithCard = async (
  stores: ReturnType<typeof storesOver>,
  owner: Awaited<ReturnType<typeof addHousehold>>,
) => {
  const account = await stores.accounts.insert({
    ...owner,
    name: 'Main',
    type: 'checking',
    currency: 'BRL',
    visibility: 'personal',
    startingBalance: 1000,
    startingBalanceDate: TODAY,
  });
  await stores.creditCards.insert({ ...CARD, accountId: account.id }, TODAY);
  return account.id;
};

describe('createUnitOfWork', () => {
  it('commits every Accessor\'s writes together and answers the work\'s result', () => withRollback(
    pglite,
    async (db) => {
      const owner = await addHousehold(db);
      const inTransaction = createUnitOfWork(db, storesOver);

      const accountId = await inTransaction((stores) => createWithCard(stores, owner));

      expect(await db.select().from(accounts).where(eq(accounts.id, accountId))).toHaveLength(1);
      expect(await db.select().from(creditCards).where(eq(creditCards.accountId, accountId)))
        .toHaveLength(1);
    },
  ));

  it('undoes both Accessors\' writes when the work throws', () => withRollback(
    pglite,
    async (db) => {
      const owner = await addHousehold(db);
      const inTransaction = createUnitOfWork(db, storesOver);

      await expect(inTransaction(async (stores) => {
        await createWithCard(stores, owner);
        throw new Error('card refused');
      })).rejects.toThrow('card refused');

      expect(await db.select().from(accounts).where(eq(accounts.householdId, owner.householdId)))
        .toEqual([]);
      expect(await db.select().from(creditCards)).toEqual([]);
    },
  ));
});
