import type { Locale } from '@financas/i18n';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, parsePath, useLocation } from 'react-router';
import { vi } from 'vitest';
import type { ApiEnvironment } from '../../../src/api/baseQuery';
import { createTokenStore } from '../../../src/api/tokens';
import type { LocaleController } from '../../../src/utilities/i18n';
import { ROUTES, type RouteId } from '../../../src/shell/routes';
import type {
  ShellConfig, ShellHousehold, ShellIdentity,
} from '../../../src/shell/shellConfig';
import { createAppStore, type AppStore } from '../../../src/store';
import { I18nProvider } from '../../../src/utilities/I18nProvider';
import { fixedLocale } from '../../support/renderInLocale';
import { jsonResponse, memoryStorage } from '../api/fakes';

// Shared fakes for the App Shell's tests (S1). The store is the real one, over
// fake surroundings (`fetch`, storage); the Experiences the shell routes to are
// stand-ins — BDT: the shell is tested with the Experiences below it mocked.

/** The Doe household, which Jane owns. */
export const DOE: ShellHousehold = { id: 'doe', name: 'The Doe Household', role: 'Owner' };

/** The Rivera household, where Jane is a Member. */
export const RIVERA: ShellHousehold = {
  id: 'rivera', name: 'The Rivera Household', role: 'Member',
};

/** Both households, Doe first. Stable, as an RTK Query result is. */
export const HOUSEHOLDS: readonly ShellHousehold[] = [DOE, RIVERA];

/** The signed-in user. */
export const JANE: ShellIdentity = {
  id: 'jane', firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@example.com',
};

/** What a fake store lets the test look at. */
export interface StoreOptions {
  /** A refresh token kept from before: the page loads signed in. */
  readonly refreshToken?: string | undefined;
  /** The remembered active household. */
  readonly rememberedHousehold?: string | undefined;
  /** The fake `fetch`; answers `{}` by default. */
  readonly fetchFn?: typeof fetch | undefined;
}

/**
 * Builds the real store over fake surroundings.
 *
 * @param options - The kept refresh token, remembered household and `fetch`.
 * @returns The store and the fakes behind it.
 */
export const fakeStore = (options: StoreOptions = {}) => {
  const tokenStorage = memoryStorage(options.refreshToken ?? null);
  const householdMemory = memoryStorage(options.rememberedHousehold ?? null);
  const fetchFn = options.fetchFn ?? vi.fn<typeof fetch>(async () => jsonResponse(200, {}));
  const api: ApiEnvironment = {
    baseUrl: 'http://app.test/api/v1',
    fetchFn,
    tokens: createTokenStore(tokenStorage),
    refresh: async () => 'failed',
    newCorrelationId: () => 'cid-1',
  };
  const store = createAppStore({ api, shell: { householdMemory } });
  return {
    store, tokenStorage, householdMemory, api,
  };
};

/** Each page as a heading naming its route id, so a test sees where it landed. */
export const STAND_IN_PAGES = Object.fromEntries(
  ROUTES.map((route) => [route.id, <h1 key={route.id}>{`page:${route.id}`}</h1>]),
) as Record<RouteId, ReactElement>;

/**
 * Builds a shell configuration of stand-ins: Jane, both households, every
 * action a spy.
 *
 * @param overrides - Parts to replace.
 * @returns The configuration.
 */
export const fakeConfig = (overrides: Partial<ShellConfig> = {}): ShellConfig => ({
  pages: STAND_IN_PAGES,
  sources: {
    useIdentity: () => ({ status: 'ready', data: JANE }),
    useHouseholds: () => ({ status: 'ready', data: HOUSEHOLDS }),
    usePendingInvitationCount: () => 0,
  },
  actions: { signOut: vi.fn(), exportAuditLog: vi.fn() },
  notificationRoutes: {},
  themeController: { apply: vi.fn(), restore: vi.fn() },
  ...overrides,
});

/**
 * Shows the router's current address and state, for assertions.
 *
 * @returns The probe.
 */
export function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location" data-state={JSON.stringify(location.state)}>
      {`${location.pathname}${location.search}`}
    </output>
  );
}

/** Where and how to render. */
export interface RenderOptions {
  readonly path?: string | undefined;
  readonly state?: unknown;
  readonly locale?: Locale | undefined;
  /** A locale controller to watch; one fixed to `locale` by default. */
  readonly localeController?: LocaleController | undefined;
}

/**
 * Renders an element as the app does: i18n, the store and a router at a path.
 *
 * @param element - What to render.
 * @param store - The store.
 * @param options - The starting address, its state and the locale or its controller.
 * @returns The render result.
 */
export const renderWithShell = (
  element: ReactElement,
  store: AppStore,
  options: RenderOptions = {},
) => render(
  <I18nProvider controller={options.localeController ?? fixedLocale(options.locale ?? 'en-US')}>
    <Provider store={store}>
      <MemoryRouter initialEntries={[{ ...parsePath(options.path ?? '/'), state: options.state }]}>
        {element}
        <LocationProbe />
      </MemoryRouter>
    </Provider>
  </I18nProvider>,
);
