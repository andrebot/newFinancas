import { describe, expect, it } from 'vitest';
import {
  ASSET_TYPES, findAssetType, INDEX_CODES, isFixedTerm, isIndexCode, SCHEDULE_ENTRY_KINDS,
} from '../../src/investments';

describe('ASSET_TYPES (OQ-79)', () => {
  it('has 8 market-priced and 11 fixed-term types', () => {
    expect(ASSET_TYPES.filter((t) => t.pricing === 'market')).toHaveLength(8);
    expect(ASSET_TYPES.filter((t) => t.pricing === 'fixed_term')).toHaveLength(11);
  });

  it('gives every fixed-term type a market, and no market-priced one', () => {
    ASSET_TYPES.forEach((type) => {
      expect('market' in type, type.code).toBe(type.pricing === 'fixed_term');
    });
  });

  it('marks the US instruments', () => {
    expect(findAssetType('cd')?.market).toBe('US');
    expect(findAssetType('treasury')?.market).toBe('US');
    expect(findAssetType('tesouro_direto')?.market).toBe('BR');
  });
});

describe('isFixedTerm', () => {
  it.each([
    ['cdb', true], ['debenture', true], ['stock', false], ['fii', false], ['unknown', false],
  ])(
    '%s → %s',
    (code, expected) => {
      expect(isFixedTerm(code)).toBe(expected);
    },
  );
});

describe('index codes and schedule kinds', () => {
  it('has selic/cdi as annual and ipca/igpm as trailing 12-month', () => {
    expect(INDEX_CODES).toEqual([
      { code: 'selic', unit: 'annual_percent' },
      { code: 'cdi', unit: 'annual_percent' },
      { code: 'ipca', unit: 'trailing_12m_percent' },
      { code: 'igpm', unit: 'trailing_12m_percent' },
    ]);
  });

  it.each([['selic', true], ['igpm', true], ['libor', false]])(
    'isIndexCode(%s) → %s',
    (code, ok) => {
      expect(isIndexCode(code)).toBe(ok);
    },
  );

  it('lists the three FR-11.3 cash events', () => {
    expect(SCHEDULE_ENTRY_KINDS).toEqual(['interest_payment', 'redemption', 'tax']);
  });
});
