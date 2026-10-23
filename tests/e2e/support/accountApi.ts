import type { APIRequestContext } from '@playwright/test';
import type { Category } from '@financas/api-types';
import type { Locale } from '@financas/i18n';
import { defaultCategoriesFor } from '@financas/reference';
import { send, type TestUser } from './identityApi';

// Reading a household's set-up data through the API, to check a journey's end
// state where the page does not show it (I5, I7).

/** A Category as the defaults describe one: names, icon and colour, no ids. */
export interface CategoryShape {
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly subcategories: readonly string[];
}

/**
 * Lists a household's active Categories with their Subcategories.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @returns Its Categories.
 */
export const listCategories = async (
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
): Promise<readonly Category[]> => {
  const categories = await send<{ data?: Category[] }>(
    request,
    'GET',
    `/households/${householdId}/categories`,
    { accessToken: member.accessToken },
  );
  return categories.data ?? [];
};

/**
 * Sorts Category shapes by name, so two lists compare whatever their order.
 *
 * @param categories - The Categories.
 * @returns A sorted copy.
 */
const byName = (categories: readonly CategoryShape[]): CategoryShape[] => (
  [...categories].sort((left, right) => left.name.localeCompare(right.name))
);

/**
 * A household's Categories reduced to what the defaults describe, sorted.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @returns Name, icon, colour and Subcategory names of each, by name.
 */
export const categoryShapes = async (
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
): Promise<CategoryShape[]> => byName(
  (await listCategories(request, member, householdId)).map((category) => ({
    name: category.name,
    icon: category.icon,
    color: category.color,
    subcategories: category.subcategories.map((subcategory) => subcategory.name),
  })),
);

/**
 * The default Categories a household is seeded with, sorted as `categoryShapes`.
 *
 * @param language - The creator's language (OQ-117).
 * @returns The defaults, by name.
 */
export const defaultCategoryShapes = (language: Locale): CategoryShape[] => (
  byName(defaultCategoriesFor(language))
);
