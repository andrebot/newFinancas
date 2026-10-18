import {
  zCardNetwork, zCategoryColor, zCategoryIcon, zIndexCode, zIndexRateUnit,
} from '@financas/api-types/zod';
import {
  CARD_NETWORKS, CATEGORY_ICONS, INDEX_CODES, PALETTE_TOKENS,
} from '@financas/reference';
import { describe, expect, it } from 'vitest';

// The contract repeats in-code reference lists as enums, so the route can refuse
// an unknown value and the web app gets the type (OQ-165, OQ-174, OQ-175,
// OQ-178). This keeps each copy equal to its source.

describe('the contract\'s category enums', () => {
  it('list exactly the in-code icon set, in order', () => {
    expect(zCategoryIcon.options).toEqual(CATEGORY_ICONS);
  });

  it('list exactly the palette tokens, in order', () => {
    expect(zCategoryColor.options).toEqual(PALETTE_TOKENS);
  });
});

describe('the contract\'s card network enum', () => {
  it('lists exactly the in-code networks, in order (OQ-175)', () => {
    expect(zCardNetwork.options).toEqual(CARD_NETWORKS);
  });
});

describe('the contract\'s index enums', () => {
  it('list exactly the in-code indexes, in order (OQ-178)', () => {
    expect(zIndexCode.options).toEqual(INDEX_CODES.map((index) => index.code));
  });

  it('list exactly the in-code units', () => {
    expect(zIndexRateUnit.options).toEqual([...new Set(INDEX_CODES.map((index) => index.unit))]);
  });
});
