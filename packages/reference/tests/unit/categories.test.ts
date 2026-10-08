import { SUPPORTED_LOCALES } from '@financas/i18n';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ICONS, DEFAULT_CATEGORIES, defaultCategoriesFor, isCategoryIcon, isPaletteToken,
  PALETTE_TOKENS,
} from '../../src/categories';

describe('palette and icons', () => {
  it('has the 18 palette tokens of OQ-85, each once', () => {
    expect(new Set(PALETTE_TOKENS).size).toBe(18);
  });

  it.each([['mint', true], ['slate', true], ['#5EE6B8', false], ['red', false]])(
    'isPaletteToken(%s) → %s',
    (value, ok) => {
      expect(isPaletteToken(value)).toBe(ok);
    },
  );

  it.each([['home-outline', true], ['pets', true], ['material-symbols:pets', false]])(
    'isCategoryIcon(%s) → %s',
    (value, ok) => {
      expect(isCategoryIcon(value)).toBe(ok);
    },
  );

  it('lists each icon once', () => {
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
  });
});

describe('DEFAULT_CATEGORIES (mockups 12 and 41)', () => {
  it('matches the approved starter set: icon and colour per category', () => {
    expect(DEFAULT_CATEGORIES.map((c) => [c.name['en-US'], c.color, c.icon])).toEqual([
      ['Housing', 'peach', 'home-outline'],
      ['Groceries', 'mint', 'shopping-cart-outline'],
      ['Transportation', 'sky', 'directions-car-outline'],
      ['Dining & Entertainment', 'sun', 'restaurant'],
      ['Healthcare', 'coral', 'medical-services-outline'],
      ['Shopping', 'lilac', 'shopping-bag-outline'],
    ]);
  });

  it('uses only palette tokens and known icons', () => {
    DEFAULT_CATEGORIES.forEach((category) => {
      expect(isPaletteToken(category.color)).toBe(true);
      expect(isCategoryIcon(category.icon)).toBe(true);
    });
  });

  it('names every category and subcategory in every supported locale', () => {
    DEFAULT_CATEGORIES.flatMap((c) => [c.name, ...c.subcategories]).forEach((name) => {
      SUPPORTED_LOCALES.forEach((locale) => expect(name[locale].trim()).not.toBe(''));
    });
  });
});

describe('defaultCategoriesFor', () => {
  it('resolves names in the creator language (OQ-98)', () => {
    const [housing] = defaultCategoriesFor('pt-BR');

    expect(housing).toEqual({
      name: 'Moradia',
      icon: 'home-outline',
      color: 'peach',
      subcategories: ['Aluguel / Financiamento', 'Contas da casa'],
    });
    expect(defaultCategoriesFor('en-US')[0]!.subcategories)
      .toEqual(['Rent / Mortgage', 'Utilities']);
  });
});
