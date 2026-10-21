import { act, fireEvent, screen } from '@testing-library/react';
import type { Account } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { AccountListProps } from '../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/AccountList';
import type { CreateAccountDrawerProps } from '../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/CreateAccountDrawer';
import type { EditAccountDrawerProps } from '../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/EditAccountDrawer';
import {
  AccountManagementFlow, type AccountActionOutcome, type AccountManagementFlowProps,
} from '../../../../../../src/experiences/accountSetup/flows/accountManagement/AccountManagementFlow';
import type { AccountsOutcome } from '../../../../../../src/experiences/accountSetup/flows/accountManagement/accountManagementState';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import { renderInLocale } from '../../../../../support/renderInLocale';

// The Flow (BDT: unit, the Interactions beneath mocked): each Interaction is
// a stub that shows what it was given and emits from plain buttons. The
// Experience is represented by stub requests; the toast queue and the
// translator are the real Utilities.

vi.mock('../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/AccountList', () => ({
  /**
     * The accounts panel's stand-in: its status, its accounts and the Flow's handlers.
     *
     * @param props - What the Flow passes.
     * @returns The stub.
     */
  AccountList: ({
    view, canCreate, isEditable, onAdd, onEdit, onRetry,
  }: AccountListProps) => (
    <div
      data-testid="accounts"
      data-status={view.status}
      data-accounts={view.status === 'loaded' ? view.accounts.map(({ id }) => id).join('|') : ''}
      data-can-create={String(canCreate)}
    >
      {canCreate && <button type="button" onClick={onAdd}>add</button>}
      {view.status === 'loaded' && view.accounts
        .filter((acc) => acc.archivedAt === null && isEditable(acc))
        .map(
          (account) => (
            <button key={account.id} type="button" onClick={() => onEdit(account.id)}>
              {'edit '}
              {account.id}
            </button>
          ),
        )}
      <button type="button" onClick={onRetry}>retry</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/CreateAccountDrawer', () => ({
  /**
     * The create drawer's stand-in: its state and a submit of one fixed account.
     *
     * @param props - What the Flow passes.
     * @returns The stub.
     */
  CreateAccountDrawer: ({
    busy, disabled, alert, personalOnly, onSubmit, onCancel,
  }: CreateAccountDrawerProps) => (
    <div
      data-testid="create"
      data-busy={String(busy)}
      data-disabled={String(disabled)}
      data-alert={alert ?? ''}
      data-personal-only={String(personalOnly)}
    >
      <button
        type="button"
        onClick={() => onSubmit({
          name: 'Main Checking',
          type: 'checking',
          currency: 'BRL',
          visibility: 'personal',
          openingBalance: null,
          cards: [],
        })}
      >
        submit create
      </button>
      <button type="button" onClick={onCancel}>cancel create</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/EditAccountDrawer', () => ({
  /**
     * The edit drawer's stand-in: its account and state, a save of one fixed
     * edit and the archive confirm.
     *
     * @param props - What the Flow passes.
     * @returns The stub.
     */
  EditAccountDrawer: ({
    account, busy, archiveBusy, alert, archiveConfirmOpen, onSubmit, onArchive, onOpenArchive,
    onCloseArchive, onCancel,
  }: EditAccountDrawerProps) => (
    <div
      data-testid="edit"
      data-account={account.id}
      data-busy={String(busy)}
      data-archive-busy={String(archiveBusy)}
      data-alert={alert ?? ''}
    >
      <button type="button" onClick={() => onSubmit({ accountId: account.id, name: 'Renamed' })}>
        save edit
      </button>
      <button type="button" onClick={onOpenArchive}>open archive</button>
      {archiveConfirmOpen && (
      <>
        <button type="button" onClick={onArchive}>confirm archive</button>
        <button type="button" onClick={onCloseArchive}>cancel archive</button>
      </>
      )}
      <button type="button" onClick={onCancel}>cancel edit</button>
    </div>
  ),
}));

/**
 * Builds an account with sensible defaults for its id and name.
 *
 * @param id - Its id.
 * @returns The account.
 */
const account = (id: string): Account => ({
  id,
  householdId: 'doe',
  ownerUserId: null,
  name: `Account ${id}`,
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-10-01',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  currentBalance: 0,
  cards: [],
});

const LOADED: AccountsOutcome = { ok: true, data: [account('chk'), account('ccr')] };
const CREATED: AccountActionOutcome = { ok: true, data: account('new') };
const EDITED: AccountActionOutcome = { ok: true, data: account('chk') };
const OK: AccountActionOutcome = { ok: true };
const FORBIDDEN = { ok: false, error: { code: 'auth.forbidden' } } as const;

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
const renderFlow = async (props: Partial<AccountManagementFlowProps> = {}) => {
  const requests: AccountManagementFlowProps = {
    selfUserId: 'ana',
    role: 'Owner',
    onLoad: vi.fn(async () => LOADED),
    onCreate: vi.fn(async () => CREATED),
    onEdit: vi.fn(async () => EDITED),
    onArchive: vi.fn(async () => OK),
    ...props,
  };
  const queue: AlertQueue = createAlertQueue(3);
  let view: ReturnType<typeof renderInLocale> | undefined;
  await act(async () => {
    view = renderInLocale(
      <AlertProvider queue={queue}><AccountManagementFlow {...requests} /></AlertProvider>,
    );
  });
  return { requests, queue, view: view! };
};

const panel = () => screen.getByTestId('accounts');
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

describe('loading the list', () => {
  it('fetches as it mounts and lists what came back', async () => {
    const load = pending<AccountsOutcome>();
    await renderFlow({ onLoad: load.request });
    expect(panel().dataset.status).toBe('loading');

    await load.answer(LOADED);
    expect(panel().dataset).toMatchObject({ status: 'loaded', accounts: 'chk|ccr' });
  });

  it('shows the failure and retries on a click', async () => {
    const onLoad = vi.fn<() => Promise<AccountsOutcome>>()
      .mockResolvedValueOnce(FORBIDDEN)
      .mockResolvedValueOnce(LOADED);
    await renderFlow({ onLoad });
    expect(panel().dataset.status).toBe('failed');

    await click('retry');
    expect(onLoad).toHaveBeenCalledTimes(2);
    expect(panel().dataset.status).toBe('loaded');
  });

  it('lets a Viewer add a personal account only', async () => {
    await renderFlow({ role: 'Viewer' });
    expect(panel().dataset.canCreate).toBe('true');
    await click('add');
    expect(screen.getByTestId('create').dataset.personalOnly).toBe('true');
  });

  it('lets a Member pick the visibility', async () => {
    await renderFlow({ role: 'Member' });
    await click('add');
    expect(screen.getByTestId('create').dataset.personalOnly).toBe('false');
  });

  it('hides the add button from someone without a role', async () => {
    await renderFlow({ role: undefined });
    expect(panel().dataset.canCreate).toBe('false');
    expect(screen.queryByRole('button', { name: 'add' })).toBeNull();
  });

  it('drops a superseded load’s answer once a new load is asked for', async () => {
    const stale = pending<AccountsOutcome>();
    const { requests, queue, view } = await renderFlow({ onLoad: stale.request });
    const fresh = vi.fn(async (): Promise<AccountsOutcome> => (
      { ok: true, data: [account('new')] }
    ));
    await act(async () => {
      view.rerenderInLocale(
        <AlertProvider queue={queue}>
          <AccountManagementFlow {...requests} onLoad={fresh} />
        </AlertProvider>,
      );
    });
    expect(panel().dataset.accounts).toBe('new');

    await stale.answer(LOADED);
    expect(panel().dataset.accounts).toBe('new');
  });
});

describe('creating an account', () => {
  it('opens the drawer, sends what it holds and toasts the success', async () => {
    const { requests, queue } = await renderFlow();
    expect(screen.queryByTestId('create')).toBeNull();

    await click('add');
    expect(screen.getByTestId('create')).toBeTruthy();

    await click('submit create');
    expect(requests.onCreate).toHaveBeenCalledWith({
      name: 'Main Checking',
      type: 'checking',
      currency: 'BRL',
      visibility: 'personal',
      openingBalance: null,
      cards: [],
    });
    expect(panel().dataset.accounts).toBe('chk|ccr|new');
    expect(toasts(queue)).toEqual(['Main Checking created.']);
    expect(screen.queryByTestId('create')).toBeNull();
  });

  it('keeps the drawer open with the failure in its banner, not a toast', async () => {
    const { queue } = await renderFlow({ onCreate: vi.fn(async () => FORBIDDEN) });
    await click('add');
    await click('submit create');

    expect(screen.getByTestId('create').dataset.alert)
      .toBe("You don't have permission to do that.");
    expect(toasts(queue)).toEqual([]);
  });

  it('closes the drawer on a cancel', async () => {
    await renderFlow();
    await click('add');
    await click('cancel create');
    expect(screen.queryByTestId('create')).toBeNull();
  });

  it('keeps the list when a create answers without its account', async () => {
    const { queue } = await renderFlow({ onCreate: vi.fn(async () => OK) });
    await click('add');
    await click('submit create');
    expect(panel().dataset.accounts).toBe('chk|ccr');
    expect(toasts(queue)).toEqual(['Main Checking created.']);
  });

  // Defensive: the real list shows no Add while it loads; the stub does, so
  // the branch that leaves an unloaded list alone is reachable here.
  it('leaves an unloaded list alone when a create lands, then takes the load', async () => {
    const load = pending<AccountsOutcome>();
    const { queue } = await renderFlow({ onLoad: load.request });
    await click('add');
    await click('submit create');
    expect(panel().dataset.status).toBe('loading');
    expect(toasts(queue)).toEqual(['Main Checking created.']);
    expect(screen.queryByTestId('create')).toBeNull();

    await load.answer(LOADED);
    expect(panel().dataset).toMatchObject({ status: 'loaded', accounts: 'chk|ccr' });
  });
});

describe('editing an account', () => {
  it('opens the drawer about its account and toasts the success', async () => {
    const { requests, queue } = await renderFlow();
    await click('edit chk');
    expect(screen.getByTestId('edit').dataset.account).toBe('chk');

    await click('save edit');
    expect(requests.onEdit).toHaveBeenCalledWith({ accountId: 'chk', name: 'Renamed' });
    expect(toasts(queue)).toEqual(['Renamed updated.']);
    expect(screen.queryByTestId('edit')).toBeNull();
  });

  it('keeps the drawer open with the failure when an edit fails', async () => {
    const { queue } = await renderFlow({ onEdit: vi.fn(async () => FORBIDDEN) });
    await click('edit ccr');
    await click('save edit');
    expect(screen.getByTestId('edit').dataset.alert).toBe("You don't have permission to do that.");
    expect(toasts(queue)).toEqual([]);
  });

  it('keeps the list when an edit answers without its account', async () => {
    const { queue } = await renderFlow({ onEdit: vi.fn(async () => OK) });
    await click('edit chk');
    await click('save edit');
    expect(panel().dataset.accounts).toBe('chk|ccr');
    expect(toasts(queue)).toEqual(['Renamed updated.']);
  });
});

describe('archiving an account', () => {
  it('opens the confirm from the drawer and archives on a yes', async () => {
    const { requests, queue } = await renderFlow();
    await click('edit ccr');
    expect(screen.queryByRole('button', { name: 'confirm archive' })).toBeNull();

    await click('open archive');
    await click('confirm archive');
    expect(requests.onArchive).toHaveBeenCalledWith('ccr');
    expect(toasts(queue)).toEqual(['Account ccr archived.']);
    expect(screen.queryByTestId('edit')).toBeNull();
  });

  it('closes the confirm on a no and keeps the drawer open', async () => {
    const { queue } = await renderFlow();
    await click('edit ccr');
    await click('open archive');
    await click('cancel archive');
    expect(screen.getByTestId('edit')).toBeTruthy();
    expect(toasts(queue)).toEqual([]);
  });

  it('keeps the confirm open with the failure in the banner when an archive fails', async () => {
    const { queue } = await renderFlow({ onArchive: vi.fn(async () => FORBIDDEN) });
    await click('edit ccr');
    await click('open archive');
    await click('confirm archive');
    expect(screen.getByRole('button', { name: 'confirm archive' })).toBeTruthy();
    expect(screen.getByTestId('edit').dataset.alert).toBe("You don't have permission to do that.");
    expect(toasts(queue)).toEqual([]);
  });

  it('sends nothing else while a request is out, so each answer lands on its own', async () => {
    const edit = pending<AccountActionOutcome>();
    const { requests, queue } = await renderFlow({ onEdit: edit.request });
    await click('edit chk');
    await click('open archive');
    await click('save edit');
    await click('confirm archive');
    expect(requests.onArchive).not.toHaveBeenCalled();

    await edit.answer(EDITED);
    expect(toasts(queue)).toEqual(['Renamed updated.']);
    expect(panel().dataset.accounts).toBe('chk|ccr');
  });

  it('keeps the drawer through a cancel while its request is out, for the failure', async () => {
    const create = pending<AccountActionOutcome>();
    await renderFlow({ onCreate: create.request });
    await click('add');
    await click('submit create');
    await click('cancel create');
    await create.answer(FORBIDDEN);
    expect(screen.getByTestId('create').dataset.alert)
      .toBe("You don't have permission to do that.");
  });

  it('spins only the control whose request is out', async () => {
    const edit = pending<AccountActionOutcome>();
    const archive = pending<AccountActionOutcome>();
    await renderFlow({ onEdit: edit.request, onArchive: archive.request });
    await click('edit ccr');
    await click('save edit');
    expect(screen.getByTestId('edit').dataset)
      .toMatchObject({ busy: 'true', archiveBusy: 'false' });
    await edit.answer({ ok: false, error: { code: 'auth.forbidden' } });

    await click('open archive');
    await click('confirm archive');
    expect(screen.getByTestId('edit').dataset)
      .toMatchObject({ busy: 'false', archiveBusy: 'true' });
    await archive.answer(OK);
  });
});
