import { DEFAULT_CATEGORIES, INDEX_CODES } from '@financas/reference';
import { describe, expect, it } from 'vitest';
import { buildDemoSeed, demoId } from '../../../src/db/seed/demoSeed';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;
const CREDENTIALS = { passwordHash: '$argon2id$demo', encryptedMfaSecret: 'v1.sealed' };
const seed = buildDemoSeed(new Date('2026-10-08T12:00:00Z'), CREDENTIALS);

describe('demoId', () => {
  it('builds fixed, version-7-shaped UUIDs', () => {
    expect(demoId(1)).toBe('0d3e0000-0000-7000-8000-000000000001');
    expect(demoId(250)).toMatch(UUID);
  });
});

describe('buildDemoSeed', () => {
  it('gives every row a distinct fixed id', () => {
    const ids = Object.values(seed).flat().map((row) => row.id);

    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(UUID));
  });

  it('has an Owner (pt-BR) and a Member (en-US), both with the dev credentials', () => {
    expect(seed.memberships.map((membership) => membership.role)).toEqual(['Owner', 'Member']);
    expect(seed.users.map((user) => [user.email, user.language])).toEqual([
      ['ana@demo.financas.local', 'pt-BR'],
      ['ben@demo.financas.local', 'en-US'],
    ]);
    seed.users.forEach((user) => {
      expect([user.passwordHash, user.mfaSecret]).toEqual(['$argon2id$demo', 'v1.sealed']);
    });
  });

  it('seeds the default categories in the owner language, subcategories under their parent', () => {
    expect(seed.categories.map((category) => category.name))
      .toEqual(DEFAULT_CATEGORIES.map((category) => category.name['pt-BR']));
    expect(seed.subcategories).toHaveLength(6);
    const categoryIds = new Set(seed.categories.map((category) => category.id));
    seed.subcategories.forEach((subcategory) => {
      expect(categoryIds.has(subcategory.categoryId)).toBe(true);
    });
  });

  it('opens a balance row for every account in the seeding month', () => {
    expect(seed.accountMonthBalances.map((balance) => balance.accountId).sort())
      .toEqual(seed.accounts.map((account) => account.id).sort());
    seed.accountMonthBalances.forEach((balance) => {
      expect([balance.year, balance.month]).toEqual([2026, 10]);
      expect(balance.openingBalance).toBe(balance.endingBalance);
    });
    expect(seed.creditCardMonthBalances[0])
      .toMatchObject({ year: 2026, month: 10, endingOutstandingBalance: 0 });
  });

  it('records one value per index, dated the seeding day', () => {
    expect(seed.indexRates.map((rate) => rate.indexCode))
      .toEqual(INDEX_CODES.map((index) => index.code));
    seed.indexRates.forEach((rate) => expect(rate.asOfDate).toBe('2026-10-08'));
  });

  it('attaches the credit card to the credit_card_only account', () => {
    const cardAccountId = seed.creditCards[0]!.accountId;
    const cardsAccount = seed.accounts.find((account) => account.id === cardAccountId);

    expect(cardsAccount?.type).toBe('credit_card_only');
  });
});
