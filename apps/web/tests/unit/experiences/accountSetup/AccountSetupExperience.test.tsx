import { act, fireEvent, screen } from '@testing-library/react';
import type { Account, Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { AccountManagementFlowProps } from '../../../../src/experiences/accountSetup/flows/accountManagement/AccountManagementFlow';
import type { CategoryManagementFlowProps } from '../../../../src/experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow';
import { AccountSetupExperience } from '../../../../src/experiences/accountSetup/AccountSetupExperience';
import { householdChosen } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  deferred, fakeFetch, outcomeOf, press, sent, settle, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// The Account Setup Experience (BDT: integration). Its Flow is a stub with one
// button per request the Experience answers; beneath it, the real store and
// API client — only `fetch` is fake.

vi.mock(
  '../../../../src/experiences/accountSetup/flows/accountManagement/AccountManagementFlow',
  () => ({
    /**
     * The Account Management Flow's stand-in: one button per request branch.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    AccountManagementFlow: ({
      selfUserId, role, onLoad, onCreate, onEdit, onArchive,
    }: AccountManagementFlowProps) => (
      <Stub
        name="accounts"
        shows={{ selfUserId, role }}
        requests={{
          load: () => onLoad(),
          createZero: () => onCreate({
            name: 'Main Checking',
            type: 'checking',
            currency: 'BRL',
            visibility: 'personal',
            openingBalance: null,
            cards: [],
          }),
          createFunded: () => onCreate({
            name: 'Savings',
            type: 'savings',
            currency: 'BRL',
            visibility: 'shared',
            openingBalance: 150,
            cards: [],
          }),
          editPlain: () => onEdit({ accountId: 'chk', name: 'Renamed' }),
          editFull: () => onEdit({
            accountId: 'ccr', name: 'Cards', visibility: 'personal', cards: { remove: ['card-1'] },
          }),
          archive: () => onArchive('ccr'),
        }}
      />
    ),
  }),
);

vi.mock(
  '../../../../src/experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow',
  () => ({
    /**
     * The Category Management Flow's stand-in: one button per request branch.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    CategoryManagementFlow: ({
      role, onLoad, onCreate, onEdit, onAddSubcategory, onArchiveCategory, onArchiveSubcategory,
    }: CategoryManagementFlowProps) => (
      <Stub
        name="categories"
        shows={{ role }}
        requests={{
          load: () => onLoad(),
          create: () => onCreate({ name: 'Housing', icon: 'home-outline', color: 'mint' }),
          editPlain: () => onEdit({
            categoryId: 'cat', name: 'Renamed', icon: 'home-outline', color: 'mint',
          }),
          addSub: () => onAddSubcategory('cat', 'Parking'),
          archiveCategory: () => onArchiveCategory('cat'),
          archiveSub: () => onArchiveSubcategory('cat', 's1'),
        }}
      />
    ),
  }),
);

const USER = {
  id: 'jane',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: '2024-01-01T00:00:00Z',
  preferences: { theme: 'dark', language: 'en-US' },
};

const DOE = {
  id: 'doe', name: 'The Doe Household', createdAt: '2024-01-01T00:00:00Z', role: 'Owner',
};

const ACCOUNT: Account = {
  id: 'chk',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Main Checking',
  type: 'checking',
  currency: 'BRL',
  visibility: 'personal',
  startingBalanceDate: '2026-10-01',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  currentBalance: 150,
  cards: [],
};

/** Answers for a page that loads: Jane, Owner of Doe. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, USER),
  'GET /households': () => jsonResponse(200, { data: [DOE] }),
};

/**
 * Renders the Experience over the real store, signed in with Doe active.
 *
 * @param answers - The API's answers, over the loaded page's.
 * @param loads - Whether to wait for the page to show.
 * @returns The store and the fake `fetch`.
 */
const renderExperience = async (answers: Answers = {}, loads = true) => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <AccountSetupExperience />
    </AlertProvider>,
    store,
    { path: '/account-setup' },
  );
  if (loads) await screen.findByRole('heading', { level: 1 });
  await settle();
  return { store, fetchFn };
};

/**
 * Lists the routes `fetch` was called with.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each call's `METHOD path`.
 */
const routes = async (fetchFn: ReturnType<typeof fakeFetch>) => (
  (await sent(fetchFn)).map(({ route }) => route)
);

/**
 * Reads the last body a create or edit went out with.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns The call's parsed body, if any.
 */
const lastBody = async (fetchFn: ReturnType<typeof fakeFetch>) => {
  const calls = await sent(fetchFn);
  return calls[calls.length - 1]?.body;
};

/**
 * Selects the Categories tab so its stub is in front.
 */
const pickCategories = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Categories' }));
  });
};

describe('the page', () => {
  it('shows the active household with its flow, signed in as its owner', async () => {
    await renderExperience();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Doe Household');
    expect(shownBy('accounts')).toEqual({ selfUserId: 'jane', role: 'Owner' });
    expect(screen.getByRole('radio', { name: 'Accounts' })).toBeTruthy();
  });

  it('shows each unbuilt section as its empty state, and the built ones back', async () => {
    await renderExperience();
    const pickTab = async (tab: string) => {
      await act(async () => {
        fireEvent.click(screen.getByRole('radio', { name: tab }));
      });
    };
    await pickTab('Categories');
    expect(screen.getByTestId('categories')).toBeTruthy();
    await pickTab('Budgets');
    expect(screen.getByText('Budgets arrive in a later task.')).toBeTruthy();
    await pickTab('Goals');
    expect(screen.getByText('Goals arrive in a later task.')).toBeTruthy();
    await pickTab('Accounts');
    expect(screen.getByTestId('accounts')).toBeTruthy();
  });

  it('shows a skeleton while the user loads', async () => {
    const hold = deferred();
    const fetchFn = fakeFetch({ ...LOADED, 'GET /users/me': () => hold.promise });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
    store.dispatch(householdChosen('doe'));
    renderWithShell(
      <AlertProvider queue={createAlertQueue(3)}>
        <AccountSetupExperience />
      </AlertProvider>,
      store,
      { path: '/account-setup' },
    );
    expect(screen.getByRole('status', { name: 'Loading the setup' })).toBeTruthy();
  });

  it('offers a retry when the user can’t load', async () => {
    const fetchFn = fakeFetch({
      ...LOADED,
      'GET /users/me': () => jsonResponse(500, envelope('internal.unexpected')),
    });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
    store.dispatch(householdChosen('doe'));
    renderWithShell(
      <AlertProvider queue={createAlertQueue(3)}>
        <AccountSetupExperience />
      </AlertProvider>,
      store,
      { path: '/account-setup' },
    );
    await screen.findByText("Couldn't load the setup.");

    await press('Try again');
    expect(await routes(fetchFn)).toEqual([
      'GET /api/v1/users/me', 'GET /api/v1/households', 'GET /api/v1/users/me',
    ]);
  });
});

describe('the accounts it answers for its flow', () => {
  it('lists them through the endpoint, archived included', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/accounts': () => jsonResponse(200, { data: [ACCOUNT] }),
    });
    await press('load');
    expect(outcomeOf('accounts')).toEqual({ ok: true, data: [ACCOUNT] });
    expect(await routes(fetchFn)).toContain('GET /api/v1/households/doe/accounts');
  });

  it('shows the failure when a load fails', async () => {
    await renderExperience({
      'GET /households/doe/accounts': () => jsonResponse(500, envelope('internal.unexpected')),
    });
    await press('load');
    expect(outcomeOf('accounts')).toEqual(
      { ok: false, error: { code: 'internal.unexpected', params: {} } },
    );
  });

  it('shows the failure when a create fails', async () => {
    await renderExperience({
      'POST /households/doe/accounts': () => jsonResponse(403, envelope('auth.forbidden')),
    });
    await press('createZero');
    expect(outcomeOf('accounts')).toEqual(
      { ok: false, error: { code: 'auth.forbidden', params: {} } },
    );
  });

  it('creates without an opening balance when there is none', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/accounts': () => jsonResponse(201, ACCOUNT),
    });
    await press('createZero');
    expect(outcomeOf('accounts')).toEqual({ ok: true, data: ACCOUNT });
    expect(await lastBody(fetchFn)).toEqual({
      name: 'Main Checking', type: 'checking', currency: 'BRL', visibility: 'personal', cards: [],
    });
  });

  it('creates with its opening balance when there is one', async () => {
    const funded = {
      ...ACCOUNT, id: 'sav', name: 'Savings', type: 'savings' as const,
    };
    const { fetchFn } = await renderExperience({
      'POST /households/doe/accounts': () => jsonResponse(201, funded),
    });
    await press('createFunded');
    expect(await lastBody(fetchFn)).toEqual({
      name: 'Savings',
      type: 'savings',
      currency: 'BRL',
      visibility: 'shared',
      openingBalance: 150,
      cards: [],
    });
  });

  it('edits with only what moved', async () => {
    const renamed = { ...ACCOUNT, name: 'Renamed' };
    const { fetchFn } = await renderExperience({
      'PATCH /households/doe/accounts/chk': () => jsonResponse(200, renamed),
    });
    await press('editPlain');
    expect(await lastBody(fetchFn)).toEqual({ name: 'Renamed' });
  });

  it('edits with its moved visibility and card changes', async () => {
    const cards = { ...ACCOUNT, id: 'ccr', type: 'credit_card_only' as const };
    const { fetchFn } = await renderExperience({
      'PATCH /households/doe/accounts/ccr': () => jsonResponse(200, cards),
    });
    await press('editFull');
    expect(await lastBody(fetchFn)).toEqual({
      name: 'Cards', visibility: 'personal', cards: { remove: ['card-1'] },
    });
  });

  it('archives through its endpoint and shows the success', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/accounts/ccr/archive': () => jsonResponse(204),
    });
    await press('archive');
    expect(outcomeOf('accounts')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toContain('POST /api/v1/households/doe/accounts/ccr/archive');
  });
});

const SUB = {
  id: 's1',
  categoryId: 'cat',
  name: 'Rent',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
};

const CATEGORY: Category = {
  id: 'cat',
  householdId: 'doe',
  name: 'Housing',
  icon: 'home-outline',
  color: 'mint',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [SUB],
};

describe('the categories it answers for its flow', () => {
  it('lists them through the endpoint, archived included', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': () => jsonResponse(200, { data: [CATEGORY] }),
    });
    await pickCategories();
    await press('load');
    expect(outcomeOf('categories')).toEqual({ ok: true, categories: [CATEGORY] });
    expect(await routes(fetchFn)).toContain('GET /api/v1/households/doe/categories');
  });

  it('shows the failure when a load fails', async () => {
    await renderExperience({
      'GET /households/doe/categories': () => jsonResponse(500, envelope('internal.unexpected')),
    });
    await pickCategories();
    await press('load');
    expect(outcomeOf('categories')).toEqual(
      { ok: false, error: { code: 'internal.unexpected', params: {} } },
    );
  });

  it('creates through its endpoint with only the fields', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/categories': () => jsonResponse(201, CATEGORY),
    });
    await pickCategories();
    await press('create');
    expect(outcomeOf('categories')).toEqual(expect.objectContaining({ ok: true }));
    const body = await lastBody(fetchFn);
    expect(body).toEqual({ name: 'Housing', icon: 'home-outline', color: 'mint' });
  });

  it('answers a failed create with its error', async () => {
    await renderExperience({
      'POST /households/doe/categories': () => jsonResponse(403, envelope('internal.unexpected')),
    });
    await pickCategories();
    await press('create');
    expect(outcomeOf('categories')).toEqual(
      { ok: false, error: { code: 'internal.unexpected', params: {} } },
    );
  });

  it('edits with its fields, address stripped out', async () => {
    const renamed = { ...CATEGORY, name: 'Renamed' };
    const { fetchFn } = await renderExperience({
      'PATCH /households/doe/categories/cat': () => jsonResponse(200, renamed),
    });
    await pickCategories();
    await press('editPlain');
    const body = await lastBody(fetchFn);
    expect(body).toEqual({ name: 'Renamed', icon: 'home-outline', color: 'mint' });
  });

  it('adds a subcategory in the same atomic edit (OQ-173)', async () => {
    const grown = { ...CATEGORY, subcategories: [SUB, { ...SUB, id: 's2', name: 'Parking' }] };
    const { fetchFn } = await renderExperience({
      'PATCH /households/doe/categories/cat': () => jsonResponse(200, grown),
    });
    await pickCategories();
    await press('addSub');
    expect(outcomeOf('categories')).toEqual(expect.objectContaining({ ok: true }));
    expect(await lastBody(fetchFn)).toEqual({ subcategories: [{ name: 'Parking' }] });
  });

  it('archives a category through its endpoint and shows the success', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/categories/cat/archive': () => jsonResponse(204),
    });
    await pickCategories();
    await press('archiveCategory');
    expect(outcomeOf('categories')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toContain('POST /api/v1/households/doe/categories/cat/archive');
  });

  it('archives a subcategory through its endpoint and shows the success', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/categories/cat/subcategories/s1/archive': () => jsonResponse(204),
    });
    await pickCategories();
    await press('archiveSub');
    expect(outcomeOf('categories')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toContain(
      'POST /api/v1/households/doe/categories/cat/subcategories/s1/archive',
    );
  });
});
