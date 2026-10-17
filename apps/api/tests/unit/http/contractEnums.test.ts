import { zCategoryColor, zCategoryIcon } from '@financas/api-types/zod';
import { CATEGORY_ICONS, PALETTE_TOKENS } from '@financas/reference';
import { describe, expect, it } from 'vitest';

// The contract repeats two in-code reference lists as enums, so the route can
// refuse an unknown value and the web app gets the type (OQ-165, OQ-174). This
// keeps each copy equal to its source.

describe('the contract\'s category enums', () => {
  it('list exactly the in-code icon set, in order', () => {
    expect(zCategoryIcon.options).toEqual(CATEGORY_ICONS);
  });

  it('list exactly the palette tokens, in order', () => {
    expect(zCategoryColor.options).toEqual(PALETTE_TOKENS);
  });
});
