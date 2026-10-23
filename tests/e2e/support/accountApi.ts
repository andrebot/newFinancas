import { expect, type APIRequestContext } from '@playwright/test';
import type {
  Account, Budget, Category, Goal,
} from '@financas/api-types';
import type { Locale } from '@financas/i18n';
import { defaultCategoriesFor } from '@financas/reference';
import { send, type TestUser } from './identityApi';

// Reading a household's set-up data through the API, to check a journey's end
// state where the page does not show it (I5, I7), and arranging what a journey
// starts from (I8).

/** A Category as the defaults describe one: names, icon and colour, no ids. */
export interface CategoryShape {
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly subcategories: readonly string[];
}

/** One of a household's collections, as its route names it. */
type Collection = 'accounts' | 'categories' | 'budgets' | 'goals';

/**
 * Lists one of a household's collections, as a member sees it.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @param collection - The collection, e.g. `budgets`.
 * @param query - Its query parameters, if any.
 * @returns Its items.
 */
const listOf = async <Item>(
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
  collection: Collection,
  query: Readonly<Record<string, string>> = {},
): Promise<readonly Item[]> => {
  const search = new URLSearchParams(query).toString();
  const path = `/households/${householdId}/${collection}${search ? `?${search}` : ''}`;
  const list = await send<{ data?: Item[] }>(request, 'GET', path, {
    accessToken: member.accessToken,
  });
  return list.data ?? [];
};

/**
 * Lists a household's Categories with their Subcategories.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @param includeArchived - Whether archived ones are listed too: only active ones unless asked.
 * @returns Its Categories.
 */
export const listCategories = (
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
  includeArchived = false,
): Promise<readonly Category[]> => listOf(
  request,
  member,
  householdId,
  'categories',
  { includeArchived: String(includeArchived) },
);

/**
 * Lists the Accounts a member sees — open ones first — with their cards.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @returns Its Accounts.
 */
export const listAccounts = (
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
): Promise<readonly Account[]> => listOf(request, member, householdId, 'accounts');

/**
 * Lists the Budgets a member sees: every shared one and their personal ones.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @returns Its Budgets.
 */
export const listBudgets = (
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
): Promise<readonly Budget[]> => listOf(request, member, householdId, 'budgets');

/**
 * Lists the Goals a member sees in one status.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @param status - Which list: the active Goals unless asked.
 * @returns Its Goals in that status.
 */
export const listGoals = (
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
  status: 'active' | 'completed' = 'active',
): Promise<readonly Goal[]> => listOf(request, member, householdId, 'goals', { status });

/**
 * Waits until a new household holds its default Categories, seeded through
 * the bus after the household's 201 (I5), and returns them.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @returns Its Categories, once there are some.
 */
export const seededCategories = async (
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
): Promise<readonly Category[]> => {
  // The last list read is kept, so the poll's own answer is the one returned.
  let categories: readonly Category[] = [];
  await expect.poll(async () => {
    categories = await listCategories(request, member, householdId);
    return categories.length;
  }).toBeGreaterThan(0);
  return categories;
};

/**
 * Creates a shared BRL Budget claiming whole Categories, as another member
 * would from their own Budget Management.
 *
 * @param request - Playwright's API client.
 * @param member - A member who may create it.
 * @param householdId - The household.
 * @param budget - Its name and the Categories it claims.
 * @returns The new Budget.
 */
export const createBudget = (
  request: APIRequestContext,
  member: Pick<TestUser, 'accessToken'>,
  householdId: string,
  budget: { readonly name: string; readonly categoryIds: readonly string[] },
): Promise<Budget> => send<Budget>(request, 'POST', `/households/${householdId}/budgets`, {
  data: {
    name: budget.name,
    targetAmount: 100_000,
    currency: 'BRL',
    visibility: 'shared',
    targets: budget.categoryIds.map((categoryId) => ({ categoryId })),
  },
  accessToken: member.accessToken,
});

/**
 * Sorts Category shapes by name, and each one's Subcategories, so two lists
 * compare whatever order the API or the definitions keep.
 *
 * @param categories - The Categories.
 * @returns A sorted copy.
 */
const byName = (categories: readonly CategoryShape[]): CategoryShape[] => (
  categories
    .map((category) => ({
      ...category,
      subcategories: [...category.subcategories].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
);

/**
 * A household's Categories reduced to what the defaults describe, sorted.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @returns Name, icon, colour and Subcategory names of each, both by name.
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
