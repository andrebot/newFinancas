import { CARD_NETWORKS, CATEGORY_ICONS } from '@financas/reference';
import { describe, expect, it } from 'vitest';
import { CARD_NETWORK_LOGOS, GLYPHS } from '../../../../src/kit/icons/generated/iconData';

// The generated registry agrees with the reference lists the API validates
// against: any stored category icon or card network can be drawn.

describe('icon registry', () => {
  it('has a glyph for every category icon', () => {
    const missing = CATEGORY_ICONS.filter((name) => !(name in GLYPHS));

    expect(missing).toEqual([]);
  });

  it('has a logo for every card network except other', () => {
    const withLogo = CARD_NETWORKS.filter((network) => network !== 'other');

    expect(Object.keys(CARD_NETWORK_LOGOS).sort()).toEqual([...withLogo].sort());
  });

  it('has the generic card glyph that stands in for other', () => {
    expect(GLYPHS['credit-card-outline']).toContain('<path');
  });
});
