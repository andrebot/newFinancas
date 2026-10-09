import type { Locale } from '@financas/i18n';

// Category reference data (FR-10.1, OQ-57, OQ-85): the colour palette, the icon
// set and the default categories every new household is seeded with.

/**
 * The 18 palette tokens. Categories store a token, never a hex; each token has a
 * dark and a light value in the theme (docs/design/mockups/README.md, K1).
 */
export const PALETTE_TOKENS = [
  'mint', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'lilac',
  'fuchsia', 'pink', 'rose', 'coral', 'peach', 'orange', 'sun', 'lime', 'slate',
] as const;

export type PaletteToken = (typeof PALETTE_TOKENS)[number];

/**
 * Category icons (Material Symbols names, as in the approved mockups). K3 grows
 * this set for the icon picker; stored values are names from this list.
 */
export const CATEGORY_ICONS = [
  'home-outline', 'shopping-cart-outline', 'directions-car-outline', 'restaurant',
  'medical-services-outline', 'shopping-bag-outline', 'child-care-outline',
  'fitness-center', 'flight', 'pets', 'redeem', 'school-outline',
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/** A name in every supported locale. */
type LocalizedName = Readonly<Record<Locale, string>>;

/** A default category as reference data, before it becomes a household's row. */
export interface DefaultCategory {
  readonly name: LocalizedName;
  readonly icon: CategoryIcon;
  readonly color: PaletteToken;
  readonly subcategories: readonly LocalizedName[];
}

/** The starter set shown in Guided Setup and Account Setup (mockups 12 and 41). */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  {
    name: { 'pt-BR': 'Moradia', 'en-US': 'Housing' },
    icon: 'home-outline',
    color: 'peach',
    subcategories: [
      { 'pt-BR': 'Aluguel / Financiamento', 'en-US': 'Rent / Mortgage' },
      { 'pt-BR': 'Contas da casa', 'en-US': 'Utilities' },
    ],
  },
  {
    name: { 'pt-BR': 'Mercado', 'en-US': 'Groceries' },
    icon: 'shopping-cart-outline',
    color: 'mint',
    subcategories: [],
  },
  {
    name: { 'pt-BR': 'Transporte', 'en-US': 'Transportation' },
    icon: 'directions-car-outline',
    color: 'sky',
    subcategories: [
      { 'pt-BR': 'Combustível', 'en-US': 'Fuel' },
      { 'pt-BR': 'Transporte público', 'en-US': 'Public Transit' },
    ],
  },
  {
    name: { 'pt-BR': 'Restaurantes e lazer', 'en-US': 'Dining & Entertainment' },
    icon: 'restaurant',
    color: 'sun',
    subcategories: [
      { 'pt-BR': 'Restaurantes', 'en-US': 'Restaurants' },
      { 'pt-BR': 'Streaming', 'en-US': 'Streaming Services' },
    ],
  },
  {
    name: { 'pt-BR': 'Saúde', 'en-US': 'Healthcare' },
    icon: 'medical-services-outline',
    color: 'coral',
    subcategories: [],
  },
  {
    name: { 'pt-BR': 'Compras', 'en-US': 'Shopping' },
    icon: 'shopping-bag-outline',
    color: 'lilac',
    subcategories: [],
  },
];

/** A default category resolved to one language, ready to insert. */
export interface SeedCategory {
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: PaletteToken;
  readonly subcategories: readonly string[];
}

/**
 * Resolves the default categories in the household creator's language (OQ-98);
 * once inserted they are ordinary, renameable household data.
 *
 * @param locale - The creating user's language.
 * @returns The defaults with names in that language.
 */
export const defaultCategoriesFor = (locale: Locale): SeedCategory[] => DEFAULT_CATEGORIES.map(
  (category) => ({
    name: category.name[locale],
    icon: category.icon,
    color: category.color,
    subcategories: category.subcategories.map((subcategory) => subcategory[locale]),
  }),
);

/**
 * Tells whether a value is one of the 18 palette tokens.
 *
 * @param value - A colour from a request.
 * @returns `true` for a palette token.
 */
export const isPaletteToken = (value: string): value is PaletteToken => (
  (PALETTE_TOKENS as readonly string[]).includes(value)
);

/**
 * Tells whether a value is one of the category icons.
 *
 * @param value - An icon from a request.
 * @returns `true` for a known icon.
 */
export const isCategoryIcon = (value: string): value is CategoryIcon => (
  (CATEGORY_ICONS as readonly string[]).includes(value)
);
