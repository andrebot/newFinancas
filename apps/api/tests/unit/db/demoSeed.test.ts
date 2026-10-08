import { DEFAULT_CATEGORIES, INDEX_CODES } from '@financas/reference';
import { describe, expect, it } from 'vitest';
import { buildDemoSeed, demoId, UNUSABLE_SECRET } from '../../../src/db/seed/demoSeed';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;
const seed = buildDemoSeed(new Date('2026-10-08T12:00:00Z'));

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

  it('has an Owner (pt-BR) and a Member (en-US) who cannot log in yet', () => {
    expect(seed.memberships.map((m) => m.role)).toEqual(['Owner', 'Member']);
    expect(seed.users.map((u) => [u.email, u.language])).toEqual([
      ['ana@demo.financas.local', 'pt-BR'],
      ['ben@demo.financas.local', 'en-US'],
    ]);
    seed.users.forEach((u) => {
      expect([u.passwordHash, u.mfaSecret]).toEqual([UNUSABLE_SECRET, UNUSABLE_SECRET]);
    });
  });

  it('seeds the default categories in the owner language, subcategories under their parent', () => {
    expect(seed.categories.map((c) => c.name))
      .toEqual(DEFAULT_CATEGORIES.map((c) => c.name['pt-BR']));
    expect(seed.subcategories).toHaveLength(6);
    const categoryIds = new Set(seed.categories.map((c) => c.id));
    seed.subcategories.forEach((s) => expect(categoryIds.has(s.categoryId)).toBe(true));
  });

  it('opens a balance row for every account in the seeding month', () => {
    expect(seed.accountMonthBalances.map((b) => b.accountId).sort())
      .toEqual(seed.accounts.map((a) => a.id).sort());
    seed.accountMonthBalances.forEach((b) => {
      expect([b.year, b.month]).toEqual([2026, 10]);
      expect(b.openingBalance).toBe(b.endingBalance);
    });
    expect(seed.creditCardMonthBalances[0])
      .toMatchObject({ year: 2026, month: 10, endingOutstandingBalance: 0 });
  });

  it('records one value per index, dated the seeding day', () => {
    expect(seed.indexRates.map((r) => r.indexCode)).toEqual(INDEX_CODES.map((i) => i.code));
    seed.indexRates.forEach((r) => expect(r.asOfDate).toBe('2026-10-08'));
  });

  it('attaches the credit card to the credit_card_only account', () => {
    const cardsAccount = seed.accounts.find((a) => a.id === seed.creditCards[0]!.accountId);

    expect(cardsAccount?.type).toBe('credit_card_only');
  });
});
