import { act, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  createReviewInsightsChrome, useUnseenCount,
} from '../../../../src/experiences/reviewInsights/chrome';
import InboxPanel from '../../../../src/experiences/reviewInsights/InboxPanel';
import { reviewInsightsApi } from '../../../../src/experiences/reviewInsights/api';
import { householdChosen } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeFetch, sent, settle } from '../experienceFakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';
import { INBOX } from './dashboardFixtures';

// Review Insights' parts of the App Shell's chrome (BDT: integration at the
// Experience tier, over the real store; only `fetch` is fake). The export
// dialog's host has its own suite.

/**
 * Shows the unseen count.
 *
 * @returns The count, as text.
 */
function UnseenProbe() {
  return <output data-testid="unseen">{useUnseenCount()}</output>;
}

describe('useUnseenCount', () => {
  it('counts the notifications not seen yet, 0 until the inbox is read', async () => {
    const fetchFn = fakeFetch({ 'GET /notifications': () => jsonResponse(200, { data: INBOX }) });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
    renderWithShell(<UnseenProbe />, store);

    expect(screen.getByTestId('unseen').textContent).toBe('0');
    await settle();
    expect(screen.getByTestId('unseen').textContent).toBe('2');
  });

  it('polls while the tab is in front (OQ-243)', async () => {
    const subscribe = vi.spyOn(reviewInsightsApi.endpoints.listNotifications, 'initiate');
    const fetchFn = fakeFetch({ 'GET /notifications': () => jsonResponse(200, { data: [] }) });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
    renderWithShell(<UnseenProbe />, store);
    await settle();

    expect(subscribe).toHaveBeenCalledWith(undefined, expect.objectContaining({
      subscriptionOptions: expect.objectContaining({
        pollingInterval: 60_000, skipPollingIfUnfocused: true, refetchOnFocus: true,
      }),
    }));
    subscribe.mockRestore();
  });
});

describe('createReviewInsightsChrome', () => {
  it('gives the shell the inbox\'s count and panel, the export\'s handler and its dialog', () => {
    const { store } = fakeStore();
    const chrome = createReviewInsightsChrome(store);

    expect(chrome.inbox.useUnseenCount).toBe(useUnseenCount);
    expect(chrome.inbox.Panel).toBe(InboxPanel);
    expect(typeof chrome.exportAuditLog).toBe('function');
    expect(chrome.overlays).toBeTruthy();
  });

  it('dismisses a handled notification by deleting it', async () => {
    const fetchFn = fakeFetch({ 'DELETE /notifications/n-1': () => jsonResponse(204) });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });

    await createReviewInsightsChrome(store).inbox.dismiss('n-1');

    expect((await sent(fetchFn)).map(({ route }) => route))
      .toEqual(['DELETE /api/v1/notifications/n-1']);
  });

  it('settles a dismiss that fails: the action itself went through', async () => {
    const fetchFn = fakeFetch({
      'DELETE /notifications/n-1': () => jsonResponse(500, envelope('internal.unexpected')),
    });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });

    await expect(createReviewInsightsChrome(store).inbox.dismiss('n-1')).resolves.toBeUndefined();
  });

  it('opens the export dialog its overlays mount', async () => {
    const fetchFn = fakeFetch({
      'GET /users/me': () => jsonResponse(200, { id: 'jane', firstName: 'Jane', lastName: 'Doe' }),
      'GET /households': () => jsonResponse(200, {
        data: [{ id: 'doe', name: 'The Doe Household', role: 'Owner' }],
      }),
    });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
    store.dispatch(householdChosen('doe'));
    const chrome = createReviewInsightsChrome(store);
    renderWithShell(
      <AlertProvider queue={createAlertQueue(3)}>{chrome.overlays}</AlertProvider>,
      store,
    );
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => chrome.exportAuditLog());

    expect(screen.getByRole('dialog', { name: 'Export audit log' })).toBeTruthy();
  });
});
