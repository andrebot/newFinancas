import { screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import InboxPanel, { inboxReadOf, namesHouseholdLeft } from '../../../../src/experiences/reviewInsights/InboxPanel';
import type { NotificationInboxProps } from '../../../../src/experiences/reviewInsights/interactions/NotificationInbox';
import type { InboxPanelProps } from '../../../../src/shell/shellConfig';
import { householdChosen, selectActiveHouseholdId } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  fakeFetch, press, sent, settle, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';
import {
  INBOX, INVITATION, INVITED, MATURED, maturedWith,
} from './dashboardFixtures';

// The bell's panel (BDT: integration at the Experience tier). The
// Notification Inbox Interaction is a stub — what it is handed shown as JSON,
// one button per event; beneath it, the real store and API client — only
// `fetch` is fake. The shell's action router and close are spies.

vi.mock('../../../../src/experiences/reviewInsights/interactions/NotificationInbox', () => ({
  /**
   * The inbox's stand-in.
   *
   * @param props - What the panel passes.
   * @returns The stub.
   */
  NotificationInbox: ({
    read, busyIds, onRetry, onAnswer, onArchive, onView, onDelete,
  }: NotificationInboxProps) => (
    <Stub
      name="inbox"
      shows={{
        status: read.status,
        entries: read.status === 'loaded'
          ? read.entries.map(({ id, fresh, notice }) => ({ id, fresh, kind: notice.kind }))
          : null,
        busyIds,
      }}
      events={{
        retry: onRetry,
        accept: () => onAnswer('n-invite', 'accept'),
        archive: () => onArchive('n-matured'),
        view: () => onView('n-matured'),
        viewInvite: () => onView('n-invite'),
        archiveGone: () => onArchive('n-gone'),
        delete: () => onDelete('n-matured'),
      }}
    />
  ),
}));

/** Answers for a panel that loads: the inbox and the invitation waiting. */
const LOADED: Answers = {
  'GET /notifications': () => jsonResponse(200, { data: INBOX }),
  'GET /users/me/invitations': () => jsonResponse(200, { data: [INVITATION] }),
  'GET /households': () => jsonResponse(200, {
    data: [
      { id: 'home', name: 'Home', role: 'Owner' }, { id: 'rivera', name: 'Rivera', role: 'Admin' },
    ],
  }),
  'POST /notifications/seen': () => jsonResponse(204),
  'DELETE /notifications/n-matured': () => jsonResponse(204),
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Renders the panel over the real store, signed in.
 *
 * @param answers - The API's answers, over the loaded panel's.
 * @param onAction - The shell's action router.
 * @returns The fake `fetch`, the panel's props and the store, the `home` household active.
 */
const renderPanel = async (
  answers: Answers = {},
  onAction: InboxPanelProps['onAction'] = vi.fn(async () => 'done' as const),
) => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('home'));
  const props = { close: vi.fn(), onAction };
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <InboxPanel {...props} />
    </AlertProvider>,
    store,
    { path: '/' },
  );
  await settle();
  await settle();
  return { fetchFn, props, store };
};

/**
 * Lists the bodies of the "mark seen" calls.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each call's body.
 */
const seenCalls = async (fetchFn: ReturnType<typeof fakeFetch>) => (
  (await sent(fetchFn)).filter(({ route }) => route === 'POST /api/v1/notifications/seen')
    .map(({ body }) => body)
);

describe('namesHouseholdLeft', () => {
  it('is true only for a named household missing from the list', () => {
    expect(namesHouseholdLeft(undefined, undefined)).toBe(false);
    expect(namesHouseholdLeft('home', [{ id: 'home' }])).toBe(false);
    expect(namesHouseholdLeft('left', [{ id: 'home' }])).toBe(true);
    expect(namesHouseholdLeft('home', undefined)).toBe(true);
  });
});

describe('inboxReadOf', () => {
  it('is loaded once both reads are in and the panel knows what it opened with', () => {
    const loaded = inboxReadOf(
      { data: [INVITED], isError: false },
      { data: [INVITATION], isError: false },
      ['n-invite'],
    );
    expect(loaded).toEqual({
      status: 'loaded', entries: [expect.objectContaining({ fresh: true })],
    });
    expect(inboxReadOf({ data: [], isError: false }, { data: [], isError: false }, undefined))
      .toEqual({ status: 'loading' });
    expect(inboxReadOf({ isError: true }, { data: [], isError: false }, undefined))
      .toEqual({ status: 'failed' });
    expect(inboxReadOf({ data: [], isError: false }, { isError: true }, undefined))
      .toEqual({ status: 'failed' });
  });
});

describe('InboxPanel (FR-6.10, OQ-105)', () => {
  it('shows each notification, new when it was unseen as the panel opened', async () => {
    await renderPanel();

    expect(shownBy('inbox')).toEqual({
      status: 'loaded',
      entries: [
        { id: 'n-matured', fresh: true, kind: 'matured' },
        { id: 'n-invite', fresh: true, kind: 'invitation' },
        { id: 'n-other', fresh: false, kind: 'other' },
      ],
      busyIds: [],
    });
  });

  it('marks exactly the unseen ones seen, once, and keeps them new while open', async () => {
    // The refetch after marking answers them seen, as the API would.
    const marked = INBOX.map((notification) => ({
      ...notification, seenAt: notification.seenAt ?? '2026-10-13T12:00:00Z',
    }));
    const answers = [INBOX, marked];
    const { fetchFn } = await renderPanel({
      'GET /notifications': () => jsonResponse(200, { data: answers.shift() ?? marked }),
    });
    await settle();

    expect(await seenCalls(fetchFn)).toEqual([{ notificationIds: ['n-matured', 'n-invite'] }]);
    const reads = (await sent(fetchFn))
      .filter(({ route }) => route === 'GET /api/v1/notifications');
    expect(reads).toHaveLength(2);
    expect(shownBy('inbox')).toEqual(expect.objectContaining({
      entries: [
        { id: 'n-matured', fresh: true, kind: 'matured' },
        { id: 'n-invite', fresh: true, kind: 'invitation' },
        { id: 'n-other', fresh: false, kind: 'other' },
      ],
    }));
  });

  it('shows as new one that arrived after the last poll (PR #172 review)', async () => {
    // Opened on a stale list with the invitation only; the refetch brings the CDB.
    const answers = [[INVITED], [MATURED, { ...INVITED, seenAt: '2026-10-13T12:00:00Z' }]];
    await renderPanel({
      'GET /notifications': () => jsonResponse(200, { data: answers.shift() ?? [] }),
    });
    await settle();

    expect(shownBy('inbox')).toEqual(expect.objectContaining({
      entries: [
        { id: 'n-matured', fresh: true, kind: 'matured' },
        { id: 'n-invite', fresh: true, kind: 'invitation' },
      ],
    }));
  });

  it('marks nothing when everything was seen', async () => {
    const seen = INBOX.map((notification) => ({ ...notification, seenAt: '2026-10-12T00:00:00Z' }));
    const { fetchFn } = await renderPanel({
      'GET /notifications': () => jsonResponse(200, { data: seen }),
    });

    expect(await seenCalls(fetchFn)).toEqual([]);
  });

  it('marks a long inbox in batches the contract takes', async () => {
    const many = Array.from({ length: 201 }, (_, index) => ({ ...MATURED, id: `n-${index}` }));
    const { fetchFn } = await renderPanel({
      'GET /notifications': () => jsonResponse(200, { data: many }),
    });

    const batches = await seenCalls(fetchFn) as { notificationIds: string[] }[];
    expect(batches.map(({ notificationIds }) => notificationIds.length)).toEqual([200, 1]);
  });

  it('keeps going when marking seen fails: the badge only stays', async () => {
    await renderPanel({
      'POST /notifications/seen': () => jsonResponse(500, envelope('internal.unexpected')),
    });

    expect(shownBy('inbox')).toEqual(expect.objectContaining({ status: 'loaded' }));
  });

  it('hands an answer to the shell, the row busy meanwhile', async () => {
    let finish: (outcome: 'done') => void = () => {};
    const onAction = vi.fn(() => new Promise<'done'>((resolve) => {
      finish = resolve;
    }));
    await renderPanel({}, onAction);

    await press('accept');
    expect(onAction).toHaveBeenCalledWith({
      notificationId: 'n-invite',
      type: 'invitation.received',
      action: 'accept',
      params: INVITED.params,
    });
    expect(shownBy('inbox')).toEqual(expect.objectContaining({ busyIds: ['n-invite'] }));

    // A second row's work ending first leaves the first one busy (PR #172 review).
    await press('delete');
    expect(shownBy('inbox')).toEqual(expect.objectContaining({ busyIds: ['n-invite'] }));

    finish('done');
    await settle();
    expect(shownBy('inbox')).toEqual(expect.objectContaining({ busyIds: [] }));
  });

  it('tells the user when no Experience owns the action yet', async () => {
    const onAction = vi.fn(async () => 'unrouted' as const);
    await renderPanel({}, onAction);

    await press('archive');

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'archive' }));
    expect(screen.getByText('This can\'t be done from here.')).toBeTruthy();
  });

  it('routes nothing for a notification no longer listed', async () => {
    const onAction = vi.fn(async () => 'done' as const);
    await renderPanel({}, onAction);

    await press('archiveGone');

    expect(onAction).not.toHaveBeenCalled();
  });

  it('opens a matured Holding in Investments, closing the panel', async () => {
    const { props, store } = await renderPanel();

    await press('view');

    expect(props.close).toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent)
      .toBe('/investments?tab=holdings&holding=cdb-1');
    expect(selectActiveHouseholdId(store.getState())).toBe('home');
  });

  it('opens it in the household the notice names, switching to it (OQ-245)', async () => {
    const elsewhere = maturedWith({ ...MATURED.params, householdId: 'rivera' });
    const { store } = await renderPanel({
      'GET /notifications': () => jsonResponse(200, { data: [elsewhere, INVITED] }),
    });

    await press('view');

    expect(selectActiveHouseholdId(store.getState())).toBe('rivera');
    expect(screen.getByTestId('location').textContent)
      .toBe('/investments?tab=holdings&holding=cdb-1');
  });

  it('stays put for a household the user left, saying so (PR #174 review)', async () => {
    const gone = maturedWith({ ...MATURED.params, householdId: 'left' });
    const { props, store } = await renderPanel({
      'GET /notifications': () => jsonResponse(200, { data: [gone, INVITED] }),
    });

    await press('view');

    expect(screen.getByText('You\'re no longer a member of that household.')).toBeTruthy();
    expect(props.close).not.toHaveBeenCalled();
    expect(selectActiveHouseholdId(store.getState())).toBe('home');
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it('views nothing for a notice that isn\'t a matured Holding', async () => {
    const { props } = await renderPanel();

    await press('viewInvite');

    expect(props.close).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it('deletes a notification', async () => {
    const { fetchFn } = await renderPanel();

    await press('delete');

    expect((await sent(fetchFn)).map(({ route }) => route))
      .toContain('DELETE /api/v1/notifications/n-matured');
  });

  it('tells the user when a delete fails', async () => {
    await renderPanel({
      'DELETE /notifications/n-matured': () => jsonResponse(500, envelope('internal.unexpected')),
    });

    await press('delete');

    expect(screen.getByText('Couldn\'t delete the notification.')).toBeTruthy();
  });

  it('fails as one, and asks again only for what failed', async () => {
    let fails = true;
    // All seen: no "mark seen" reads the inbox again once it loads.
    const seen = INBOX.map((notification) => ({ ...notification, seenAt: '2026-10-12T00:00:00Z' }));
    const { fetchFn } = await renderPanel({
      'GET /notifications': () => jsonResponse(200, { data: seen }),
      'GET /users/me/invitations': () => (fails
        ? jsonResponse(500, envelope('internal.unexpected'))
        : jsonResponse(200, { data: [] })),
    });
    expect(shownBy('inbox')).toEqual(expect.objectContaining({ status: 'failed' }));

    fails = false;
    await press('retry');
    await settle();

    expect(shownBy('inbox')).toEqual(expect.objectContaining({ status: 'loaded' }));
    const reads = (await sent(fetchFn)).map(({ route }) => route);
    expect(reads.filter((route) => route === 'GET /api/v1/notifications')).toHaveLength(1);
    expect(reads.filter((route) => route === 'GET /api/v1/users/me/invitations')).toHaveLength(2);
  });
});
