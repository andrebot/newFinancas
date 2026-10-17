import {
  zArchiveCategoryPath, zArchiveSubcategoryPath, zCreateCategoryBody, zCreateCategoryPath,
  zEditCategoryBody, zEditCategoryPath, zGetCategoryPath, zListCategoriesPath,
  zListCategoriesQuery,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import type { AccountManager } from '../../managers/account';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import { toCategoryJson } from './accountJson';
import { signedInContextOf } from './requestContext';

// A household's Categories and Subcategories (M2, FR-10). Every path sits under
// `/households/:householdId` (OQ-174), so the `/households/*` guard mounted with
// the household routes admits only signed-in USERs; the household role checks
// are AccountManager's (OQ-111).

const CATEGORIES_PATH = '/households/:householdId/categories';
const CATEGORY_PATH = `${CATEGORIES_PATH}/:categoryId`;
const SUBCATEGORY_ARCHIVE_PATH = `${CATEGORY_PATH}/subcategories/:subcategoryId/archive`;

/**
 * Builds the Category routes.
 *
 * @param account - The Manager.
 * @returns The routes, relative to `/api/v1`.
 */
const createCategoryRoutes = (account: AccountManager) => new Hono<AppEnv>()
  .get(
    CATEGORIES_PATH,
    validate('param', zListCategoriesPath),
    validate('query', zListCategoriesQuery),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const filter = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const categories = await account.listCategories(context, householdId, filter);
      return httpContext.json({ data: categories.map(toCategoryJson) });
    },
  )
  .post(
    CATEGORIES_PATH,
    validate('param', zCreateCategoryPath),
    validate('json', zCreateCategoryBody),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const request = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const category = await account.createCategory(context, householdId, request);
      return httpContext.json(toCategoryJson(category), 201);
    },
  )
  .get(CATEGORY_PATH, validate('param', zGetCategoryPath), async (httpContext) => {
    const { householdId, categoryId } = httpContext.req.valid('param');
    const context = signedInContextOf(httpContext);
    const category = await account.getCategory(context, householdId, categoryId);
    return httpContext.json(toCategoryJson(category));
  })
  .patch(
    CATEGORY_PATH,
    validate('param', zEditCategoryPath),
    validate('json', zEditCategoryBody),
    async (httpContext) => {
      const { householdId, categoryId } = httpContext.req.valid('param');
      const changes = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const category = await account.editCategory(context, householdId, categoryId, changes);
      return httpContext.json(toCategoryJson(category));
    },
  )
  .post(
    `${CATEGORY_PATH}/archive`,
    validate('param', zArchiveCategoryPath),
    async (httpContext) => {
      const { householdId, categoryId } = httpContext.req.valid('param');
      await account.archiveCategory(signedInContextOf(httpContext), householdId, categoryId);
      return httpContext.body(null, 204);
    },
  )
  .post(
    SUBCATEGORY_ARCHIVE_PATH,
    validate('param', zArchiveSubcategoryPath),
    async (httpContext) => {
      const { householdId, categoryId, subcategoryId } = httpContext.req.valid('param');
      const context = signedInContextOf(httpContext);
      await account.archiveSubcategory(context, householdId, categoryId, subcategoryId);
      return httpContext.body(null, 204);
    },
  );

export default createCategoryRoutes;
