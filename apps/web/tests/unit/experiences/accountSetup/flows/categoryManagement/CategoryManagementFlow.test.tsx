import { act, fireEvent, screen } from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { Category } from '@financas/api-types';

import { renderInLocale } from '../../../../../support/renderInLocale';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import {
  CategoryManagementFlow, type CategoryManagementFlowProps,
} from '../../../../../../src/experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow';
import type { CategoryCardProps } from '../../../../../../src/experiences/accountSetup/flows/categoryManagement/interactions/CategoryCard';
import type { CategoryFormCardProps } from '../../../../../../src/experiences/accountSetup/flows/categoryManagement/interactions/CategoryFormCard';
import type { CategoriesView } from '../../../../../../src/experiences/accountSetup/flows/categoryManagement/categoryManagementState';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';

// The panel's children are stubbed: the Flow is tested against its own state
// machine and handlers; the cards' internals have their own suites. The list
// comes in as the Experience's display state. The kit (Expandable,
// InlineConfirm), the toast queue and the translator stay real.

vi.mock('../../../../../../src/experiences/accountSetup/flows/categoryManagement/interactions/CategoryCard', () => ({
  /**
   * The category card's stand-in: its id, role gate and the Flow's handlers.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  CategoryCard: ({
    category, canManage, archivingOpen, onEdit, onArchiveRequest, onConfirmArchive,
    onCancelArchive, onAddSubcategory, onArchiveSubcategory,
  }: CategoryCardProps) => (
    <div data-testid="card" data-id={category.id} data-manage={String(canManage)}>
      {canManage ? (
        <button type="button" onClick={() => onEdit(category.id)}>
          {'edit '}
          {category.id}
        </button>
      ) : null}
      {canManage ? (
        <button type="button" onClick={() => onArchiveRequest(category.id)}>
          {'archive '}
          {category.id}
        </button>
      ) : null}
      {archivingOpen ? (
        <>
          <button type="button" onClick={onConfirmArchive}>confirm archive</button>
          <button type="button" onClick={onCancelArchive}>cancel archive</button>
        </>
      ) : null}
      {category.id === 'cat' ? (
        <button type="button" onClick={onConfirmArchive}>force confirm</button>
      ) : null}
      {canManage ? (
        <button type="button" onClick={() => onAddSubcategory(category.id, 'Parking')}>
          {'add sub '}
          {category.id}
        </button>
      ) : null}
      {category.subcategories.map((sub) => {
        const archive = () => onArchiveSubcategory(category.id, sub.id, sub.name);
        return (
          <button key={sub.id} type="button" onClick={archive}>
            {'sub '}
            {sub.id}
          </button>
        );
      })}
    </div>
  ),
  /**
     * The archived row's stand-in: its name.
     *
     * @param props - What the Flow passes.
     * @returns The stub.
     */
  ArchivedCategory: ({ name }: { readonly name: string }) => (
    <div data-testid="archived-row">{name}</div>
  ),
}));

vi.mock('../../../../../../src/experiences/accountSetup/flows/categoryManagement/interactions/CategoryFormCard', () => ({
  /**
   * The form card's stand-in: its mode and a submit of one fixed category.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  CategoryFormCard: ({
    mode, busy, alert, onSubmit, onCancel,
  }: CategoryFormCardProps) => (
    <div data-testid="form" data-mode={mode} data-busy={String(busy)} data-alert={alert ?? ''}>
      <button
        type="button"
        onClick={() => onSubmit('New Name', 'pets', 'mint')}
      >
        submit form
      </button>
      <button type="button" onClick={onCancel}>cancel form</button>
    </div>
  ),
}));

/**
 * Builds a category with sensible defaults for its id and name.
 *
 * @param id - Its id.
 * @param over - The fields to override.
 * @returns The category.
 */
const cat = (id: string, over: Partial<Category> = {}): Category => ({
  id,
  householdId: 'doe',
  name: `Category ${id}`,
  icon: 'pets',
  color: 'mint',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [],
  ...over,
});

const HOUSING = cat('cat', { name: 'Housing' });
const GROCERIES = cat('gro');
const LOADED: CategoriesView = { status: 'loaded', categories: [HOUSING, GROCERIES] };
const OK: RequestOutcome = { ok: true };
const FORBIDDEN = { ok: false, error: { code: 'auth.forbidden' } } as const;

/** One subcategory of Groceries, for the chip-archive test. */
const GROCERY_SUB = {
  id: 's1', categoryId: 'gro', name: 'Sub s1', archivedAt: null, createdAt: '2026-10-01T00:00:00Z',
};

/** Groceries grown by that subcategory. */
const GROWN_GROCERIES = cat('gro', { subcategories: [GROCERY_SUB] });

/** The list with the grown Groceries in it. */
const WITH_SUB_LIST: CategoriesView = { status: 'loaded', categories: [HOUSING, GROWN_GROCERIES] };

/** An archived category, for the archived-section test. */
const GONE_CATEGORY = cat('old', { name: 'Old', archivedAt: '2026-10-05T00:00:00Z' });

/** The list with the archived one in it. */
const WITH_GONE_LIST: CategoriesView = { status: 'loaded', categories: [HOUSING, GONE_CATEGORY] };

/** What an empty household's grid says. */
const EMPTY_NOTE = 'No categories yet. Add the first one to start tagging spending.';

/** A request whose answer the test gives when it wants. */
interface Pending<T> {
  readonly request: () => Promise<T>;
  readonly answer: (value: T) => Promise<void>;
}

/**
 * Builds a request that waits until the test answers it.
 *
 * @returns The request and its answer.
 */
const pending = <T,>(): Pending<T> => {
  let resolve: (value: T) => void = () => {};
  return {
    request: vi.fn(() => new Promise<T>((settle) => {
      resolve = settle;
    })),
    answer: async (value) => {
      await act(async () => resolve(value));
    },
  };
};

/**
 * Renders the Flow inside a real toast queue, with stub requests that answer at once.
 *
 * @param props - The props and requests to override.
 * @returns The requests, the queue and the render result.
 */
const renderFlow = async (props: Partial<CategoryManagementFlowProps> = {}) => {
  const requests = {
    role: 'Owner',
    categories: LOADED,
    onRetry: vi.fn(),
    onCreate: vi.fn(async () => OK),
    onEdit: vi.fn(async () => OK),
    onAddSubcategory: vi.fn(async () => OK),
    onArchiveCategory: vi.fn(async () => OK),
    onArchiveSubcategory: vi.fn(async () => OK),
    ...props,
  };
  const queue: AlertQueue = createAlertQueue(3);
  let view: ReturnType<typeof renderInLocale> | undefined;
  await act(async () => {
    view = renderInLocale(
      <AlertProvider queue={queue}><CategoryManagementFlow {...requests} /></AlertProvider>,
    );
  });
  return { requests, queue, view: view! };
};

const toasts = (queue: AlertQueue) => queue.visible().map(({ message }) => message);

/**
 * Clicks a stub's button and lets the outcome land.
 *
 * @param name - The button's name.
 */
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

beforeEach(() => vi.clearAllMocks());

describe('the list it is given', () => {
  it('shows its skeleton while the list loads', async () => {
    await renderFlow({ categories: { status: 'loading' } });
    expect(screen.getByRole('status', { name: 'Loading the categories' })).toBeTruthy();
    expect(screen.queryByTestId('card')).toBeNull();
  });

  it('lists the cards it was given', async () => {
    await renderFlow();
    expect(screen.getAllByTestId('card').map((el) => el.dataset.id)).toEqual(['cat', 'gro']);
  });

  it('shows the failure with a retry that asks the Experience again', async () => {
    const { requests } = await renderFlow({
      categories: { status: 'failed', error: { code: 'internal.unexpected' } },
    });
    expect(screen.getByText("Couldn't load the categories.")).toBeTruthy();
    await click('Try again');
    expect(requests.onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the list and an open form when a refresh fails, with a banner and retry', async () => {
    const { requests } = await renderFlow({
      categories: { ...LOADED, refreshError: { code: 'internal.unexpected' } },
    });
    await click('Add category');
    expect(screen.getByTestId('form')).toBeTruthy();
    expect(screen.getAllByTestId('card').map((el) => el.dataset.id)).toEqual(['cat', 'gro']);
    expect(screen.getByRole('alert').textContent)
      .toContain("Couldn't refresh the categories, so the list may be out of date.");
    await click('Try again');
    expect(requests.onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows no banner while the list is current', async () => {
    await renderFlow();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides Add from a Viewer and shows it to a Member', async () => {
    const first = await renderFlow({ role: 'Viewer' });
    expect(first.view.container.querySelector('[data-testid="form"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
    first.view.unmount();

    await renderFlow({ role: 'Member' });
    expect(screen.getByRole('button', { name: 'Add category' })).toBeTruthy();
  });
});

describe('creating a category', () => {
  it('creates from its card, toasts and closes the card', async () => {
    const { requests, queue } = await renderFlow();
    await click('Add category');
    expect(screen.getByTestId('form').dataset.mode).toBe('create');
    await click('submit form');
    expect(requests.onCreate).toHaveBeenCalledWith({
      name: 'New Name', icon: 'pets', color: 'mint',
    });
    expect(toasts(queue)).toEqual(['New Name created.']);
    expect(screen.queryByTestId('form')).toBeNull();
  });

  it('keeps the create card open on failure with its error in the banner only', async () => {
    const { queue } = await renderFlow({ onCreate: vi.fn(async () => FORBIDDEN) });
    await click('Add category');
    await click('submit form');
    expect(screen.getByTestId('form').dataset.alert).toBe("You don't have permission to do that.");
    expect(toasts(queue)).toEqual([]);
  });

  it('spins the create card while it is out', async () => {
    const create = pending<RequestOutcome>();
    await renderFlow({ onCreate: create.request });
    await click('Add category');
    await click('submit form');
    expect(screen.getByTestId('form').dataset.busy).toBe('true');
    await create.answer(OK);
    expect(screen.queryByTestId('form')).toBeNull();
  });

  it('closes the create card from Cancel without calling out', async () => {
    const { requests } = await renderFlow();
    await click('Add category');
    await click('cancel form');
    expect(screen.queryByTestId('form')).toBeNull();
    expect(requests.onCreate).not.toHaveBeenCalled();
  });
});

describe('editing a category', () => {
  it('turns its card into the form and saves in place', async () => {
    const { requests, queue } = await renderFlow();
    await click('edit cat');
    expect(screen.getByTestId('form').dataset.mode).toBe('edit');
    await click('submit form');
    expect(requests.onEdit).toHaveBeenCalledWith({
      categoryId: 'cat', name: 'New Name', icon: 'pets', color: 'mint',
    });
    expect(toasts(queue)).toEqual(['New Name updated.']);
    expect(screen.queryByTestId('form')).toBeNull();
  });

  it('keeps the edit card open on failure with its error in the banner only', async () => {
    const { queue } = await renderFlow({ onEdit: vi.fn(async () => FORBIDDEN) });
    await click('edit cat');
    await click('submit form');
    expect(screen.getByTestId('form').dataset.alert).toBe("You don't have permission to do that.");
    expect(toasts(queue)).toEqual([]);
  });
});

describe('subcategories', () => {
  it('adds one from its card and toasts the name', async () => {
    const { requests, queue } = await renderFlow();
    await click('add sub cat');
    expect(requests.onAddSubcategory).toHaveBeenCalledWith('cat', 'Parking');
    expect(toasts(queue)).toEqual(['Parking added.']);
  });

  it('archives one of its subcategories from the chip', async () => {
    const { requests, queue } = await renderFlow({ categories: WITH_SUB_LIST });
    await click('sub s1');
    expect(requests.onArchiveSubcategory).toHaveBeenCalledWith('gro', 's1');
    expect(toasts(queue)).toEqual(['Sub s1 archived.']);
  });

  it('toasts a refused add, and leaves an open form’s banner alone', async () => {
    const { queue } = await renderFlow({ onAddSubcategory: vi.fn(async () => FORBIDDEN) });
    await click('Add category');
    await click('add sub cat');
    expect(toasts(queue)).toEqual(["You don't have permission to do that."]);
    expect(screen.getByTestId('form').dataset.alert).toBe('');
  });
});

describe('archiving a category', () => {
  it('archives after confirming the cascade and toasts the name', async () => {
    const { requests, queue } = await renderFlow();
    await click('archive cat');
    expect(screen.getByRole('button', { name: 'confirm archive' })).toBeTruthy();
    await click('confirm archive');
    expect(requests.onArchiveCategory).toHaveBeenCalledWith('cat');
    expect(toasts(queue)).toEqual(['Housing archived.']);
  });

  it('cancels its confirm without calling out', async () => {
    const { requests } = await renderFlow();
    await click('archive cat');
    await click('cancel archive');
    expect(screen.queryByRole('button', { name: 'confirm archive' })).toBeNull();
    expect(requests.onArchiveCategory).not.toHaveBeenCalled();
  });

  it('keeps the confirm open on failure and toasts why', async () => {
    const { queue } = await renderFlow({ onArchiveCategory: vi.fn(async () => FORBIDDEN) });
    await click('archive cat');
    await click('confirm archive');
    expect(screen.getByRole('button', { name: 'confirm archive' })).toBeTruthy();
    expect(toasts(queue)).toEqual(["You don't have permission to do that."]);
  });
});

describe('the rest of the list', () => {
  it('shows the empty note when there are none', async () => {
    await renderFlow({ categories: { status: 'loaded', categories: [] } });
    expect(screen.getByText(EMPTY_NOTE)).toBeTruthy();
  });

  it('lists its archived categories under their note', async () => {
    await renderFlow({ categories: WITH_GONE_LIST });
    expect(screen.queryByTestId('archived-row')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /archived categor/ }));
    });
    expect(screen.getByTestId('archived-row')).toBeTruthy();
  });
});

describe('a confirm with nothing open', () => {
  it('is ignored without calling out', async () => {
    const { requests, queue } = await renderFlow();
    await click('force confirm');
    expect(requests.onArchiveCategory).not.toHaveBeenCalled();
    expect(toasts(queue)).toEqual([]);
  });
});
