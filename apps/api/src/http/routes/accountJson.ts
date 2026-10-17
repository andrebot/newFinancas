import type { Category, Subcategory } from '../../managers/account';

// AccountManager's results in the contract's JSON shapes: times as ISO strings,
// only the fields the contract names.

/**
 * A Subcategory as the contract shows it (`components/schemas/Subcategory`).
 *
 * @param subcategory - The Subcategory.
 * @returns The JSON shape.
 */
export const toSubcategoryJson = (subcategory: Subcategory) => ({
  id: subcategory.id,
  categoryId: subcategory.categoryId,
  name: subcategory.name,
  archivedAt: subcategory.archivedAt?.toISOString() ?? null,
  createdAt: subcategory.createdAt.toISOString(),
});

/**
 * A Category as the contract shows it (`components/schemas/Category`).
 *
 * @param category - The Category with its Subcategories.
 * @returns The JSON shape.
 */
export const toCategoryJson = (category: Category) => ({
  id: category.id,
  householdId: category.householdId,
  name: category.name,
  icon: category.icon,
  color: category.color,
  archivedAt: category.archivedAt?.toISOString() ?? null,
  createdAt: category.createdAt.toISOString(),
  subcategories: category.subcategories.map(toSubcategoryJson),
});
