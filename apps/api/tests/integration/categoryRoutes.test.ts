import {
  describe, expect, it, vi,
} from 'vitest';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
const FOOD = '0199c5a0-0000-7000-8000-0000000000c1';
const MARKET = '0199c5a0-0000-7000-8000-0000000000c2';
const ACTOR = { userId: USER_ID, sessionId: 's1', systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');
const CATEGORIES = `/households/${HOME}/categories`;
const SUBCATEGORY = {
  id: MARKET, categoryId: FOOD, name: 'Market', archivedAt: null, createdAt: NOW,
};
const CATEGORY = {
  id: FOOD,
  householdId: HOME,
  name: 'Food',
  icon: 'restaurant' as const,
  color: 'coral' as const,
  archivedAt: NOW as Date | null,
  createdAt: NOW,
  subcategories: [SUBCATEGORY],
};
const CATEGORY_JSON = {
  id: FOOD,
  householdId: HOME,
  name: 'Food',
  icon: 'restaurant',
  color: 'coral',
  archivedAt: NOW.toISOString(),
  createdAt: NOW.toISOString(),
  subcategories: [{
    id: MARKET, categoryId: FOOD, name: 'Market', archivedAt: null, createdAt: NOW.toISOString(),
  }],
};

/**
 * The app, with a token check accepting only `good-token`.
 *
 * @returns The app and its mocked Managers.
 */
const setup = () => appWithMocks(vi.fn(async (token: string) => (
  token === 'good-token' ? ACTOR : undefined
)));

/**
 * Sends a signed-in JSON request under /api/v1.
 *
 * @param app - The app.
 * @param method - HTTP method.
 * @param path - Path under /api/v1.
 * @param body - JSON body, if any.
 * @returns The response.
 */
const send = (
  app: ReturnType<typeof setup>['app'],
  method: string,
  path: string,
  body?: unknown,
) => app.request(`/api/v1${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/**
 * The context the Manager receives: a correlation ID and the actor.
 *
 * @returns A matcher.
 */
const signedIn = () => expect.objectContaining({ actor: ACTOR });

describe('category routes (OQ-174: under /households/:householdId)', () => {
  it('check the token exactly once, through the household guard', async () => {
    const verify = vi.fn(async () => ACTOR);
    const { app, account } = appWithMocks(verify);
    account.listCategories.mockResolvedValueOnce([]);

    await app.request(`/api/v1${CATEGORIES}`, { headers: { Authorization: 'Bearer t' } });

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('need a signed-in user', async () => {
    const { app, account } = setup();

    const response = await app.request(`/api/v1${CATEGORIES}`);

    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe('auth.unauthenticated');
    expect(account.listCategories).not.toHaveBeenCalled();
  });

  it('GET …/categories → 200, open only unless includeArchived=true', async () => {
    const { app, account } = setup();
    account.listCategories.mockResolvedValue([CATEGORY]);

    const response = await send(app, 'GET', CATEGORIES);
    await send(app, 'GET', `${CATEGORIES}?includeArchived=true`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [CATEGORY_JSON] });
    expect(account.listCategories).toHaveBeenNthCalledWith(
      1,
      signedIn(),
      HOME,
      { includeArchived: false },
    );
    expect(account.listCategories).toHaveBeenNthCalledWith(
      2,
      signedIn(),
      HOME,
      { includeArchived: true },
    );
  });

  it('POST …/categories → 201 with the Category', async () => {
    const { app, account } = setup();
    account.createCategory.mockResolvedValueOnce({ ...CATEGORY, archivedAt: null });
    const body = { name: 'Food', icon: 'restaurant', color: 'coral' };

    const response = await send(app, 'POST', CATEGORIES, body);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ...CATEGORY_JSON, archivedAt: null });
    expect(account.createCategory).toHaveBeenCalledWith(signedIn(), HOME, body);
  });

  it('POST …/categories refuses an icon outside the set before the Manager (OQ-174)', async () => {
    const { app, account } = setup();

    const response = await send(app, 'POST', CATEGORIES, {
      name: 'Food', icon: 'rocket', color: 'coral',
    });

    expect(response.status).toBe(422);
    const { error } = await response.json() as { error: { details: unknown[] } };
    expect(error.details).toEqual([
      expect.objectContaining({ field: 'icon', code: 'field.invalid_option' }),
    ]);
    expect(account.createCategory).not.toHaveBeenCalled();
  });

  it('GET …/categories/:categoryId → 200', async () => {
    const { app, account } = setup();
    account.getCategory.mockResolvedValueOnce(CATEGORY);

    const response = await send(app, 'GET', `${CATEGORIES}/${FOOD}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(CATEGORY_JSON);
    expect(account.getCategory).toHaveBeenCalledWith(signedIn(), HOME, FOOD);
  });

  it('PATCH …/categories/:categoryId → 200, Subcategories folded in', async () => {
    const { app, account } = setup();
    account.editCategory.mockResolvedValueOnce(CATEGORY);
    const body = {
      name: 'Groceries', subcategories: [{ id: MARKET, name: 'Market' }, { name: 'Bakery' }],
    };

    const response = await send(app, 'PATCH', `${CATEGORIES}/${FOOD}`, body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(CATEGORY_JSON);
    expect(account.editCategory).toHaveBeenCalledWith(signedIn(), HOME, FOOD, body);
  });

  it('PATCH …/categories/:categoryId needs a name on every Subcategory', async () => {
    const { app, account } = setup();

    const response = await send(app, 'PATCH', `${CATEGORIES}/${FOOD}`, {
      subcategories: [{ id: MARKET }],
    });

    expect(response.status).toBe(422);
    expect(account.editCategory).not.toHaveBeenCalled();
  });

  it('POST …/categories/:categoryId/archive → 204', async () => {
    const { app, account } = setup();
    account.archiveCategory.mockResolvedValueOnce(undefined);

    const response = await send(app, 'POST', `${CATEGORIES}/${FOOD}/archive`);

    expect(response.status).toBe(204);
    expect(account.archiveCategory).toHaveBeenCalledWith(signedIn(), HOME, FOOD);
  });

  it('POST …/subcategories/:subcategoryId/archive → 204', async () => {
    const { app, account } = setup();
    account.archiveSubcategory.mockResolvedValueOnce(undefined);

    const response = await send(
      app,
      'POST',
      `${CATEGORIES}/${FOOD}/subcategories/${MARKET}/archive`,
    );

    expect(response.status).toBe(204);
    expect(account.archiveSubcategory).toHaveBeenCalledWith(signedIn(), HOME, FOOD, MARKET);
  });

  it('refuse an id that is not a UUID before the Manager', async () => {
    const { app, account } = setup();

    const response = await send(app, 'GET', `/households/not-a-uuid/categories/${FOOD}`);

    expect(response.status).toBe(422);
    expect(account.getCategory).not.toHaveBeenCalled();
  });
});
