import { CATEGORY_ICONS, PALETTE_TOKENS, TRANSACTION_KINDS } from '@financas/reference';
import { describe, expect, it } from 'vitest';
import { TRANSACTION_EFFECTS } from '../../../src/db/schema/values';

describe('schema value sets agree with the shared reference data', () => {
  it('accepts every effect a transaction kind declares', () => {
    TRANSACTION_KINDS.forEach((kind) => {
      if ('effect' in kind) expect(TRANSACTION_EFFECTS, kind.code).toContain(kind.effect);
    });
  });

  it('keeps palette tokens and icons as plain names that fit the text columns', () => {
    [...PALETTE_TOKENS, ...CATEGORY_ICONS].forEach((value) => {
      expect(value).toMatch(/^[a-z-]+$/);
    });
  });
});
