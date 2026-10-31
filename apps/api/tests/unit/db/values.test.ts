import {
  ASSET_TYPES, CATEGORY_ICONS, PALETTE_TOKENS, TRANSACTION_KINDS, isFixedTerm,
} from '@financas/reference';
import { describe, expect, it } from 'vitest';
import { FIXED_TERM_ASSET_TYPES, TRANSACTION_EFFECTS } from '../../../src/db/schema/values';

describe('schema value sets agree with the shared reference data', () => {
  it('accepts every effect a transaction kind declares', () => {
    TRANSACTION_KINDS.forEach((kind) => {
      if ('effect' in kind) expect(TRANSACTION_EFFECTS, kind.code).toContain(kind.effect);
    });
  });

  it('takes the fixed-term asset types from the reference list (OQ-224)', () => {
    expect(FIXED_TERM_ASSET_TYPES).toEqual(ASSET_TYPES
      .filter(({ code }) => isFixedTerm(code))
      .map(({ code }) => code));
    expect(FIXED_TERM_ASSET_TYPES).toContain('cdb');
    expect(FIXED_TERM_ASSET_TYPES).not.toContain('stock');
  });

  it('keeps palette tokens and icons as plain names that fit the text columns', () => {
    [...PALETTE_TOKENS, ...CATEGORY_ICONS].forEach((value) => {
      expect(value).toMatch(/^[a-z-]+$/);
    });
  });
});
