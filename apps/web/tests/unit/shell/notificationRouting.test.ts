import {
  describe, expect, it, vi,
} from 'vitest';
import {
  handlerFor, routeNotificationAction, type NotificationAction, type NotificationRoutes,
} from '../../../src/shell/notificationRouting';

// Notification routing (BDT: App Shell routing table → the Experiences it
// routes to are mocked). Asserts the action reaches the owning Experience with
// its params, and the notification is dismissed only after that succeeds.

const ACCEPT: NotificationAction = {
  notificationId: 'n-1',
  type: 'invitation.received',
  action: 'accept',
  params: { invitationId: 'inv-1' },
};

const ARCHIVE: NotificationAction = {
  notificationId: 'n-2',
  type: 'holding.matured',
  action: 'archive',
  params: { holdingId: 'h-1' },
};

/**
 * Builds the table with a spy per owning Experience.
 *
 * @param outcome - What both handlers report.
 * @returns The table, its spies and the dismiss spy.
 */
const routing = (outcome: 'done' | 'failed') => {
  const respondToInvitation = vi.fn(async () => outcome);
  const archiveMaturedHolding = vi.fn(async () => outcome);
  const routes: NotificationRoutes = {
    'invitation.received': respondToInvitation,
    'holding.matured': archiveMaturedHolding,
  };
  const dismiss = vi.fn(async () => {});
  return {
    routes, respondToInvitation, archiveMaturedHolding, dismiss,
  };
};

describe('routeNotificationAction', () => {
  it('hands each type to its owner and dismisses it once that owner succeeded', async () => {
    const {
      routes, respondToInvitation, archiveMaturedHolding, dismiss,
    } = routing('done');

    expect(await routeNotificationAction(routes, dismiss, ACCEPT)).toBe('done');
    expect(await routeNotificationAction(routes, dismiss, ARCHIVE)).toBe('done');

    expect(respondToInvitation).toHaveBeenCalledWith(ACCEPT);
    expect(archiveMaturedHolding).toHaveBeenCalledWith(ARCHIVE);
    expect(dismiss.mock.calls).toEqual([['n-1'], ['n-2']]);
  });

  it('keeps the notification when the owner failed', async () => {
    const { routes, dismiss } = routing('failed');

    expect(await routeNotificationAction(routes, dismiss, ACCEPT)).toBe('failed');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('routes an unknown type nowhere', async () => {
    const { routes, dismiss } = routing('done');

    const unknown = { ...ACCEPT, type: 'budget.exceeded' };
    const outcome = await routeNotificationAction(routes, dismiss, unknown);

    expect(outcome).toBe('unrouted');
    expect(dismiss).not.toHaveBeenCalled();
  });
});

describe('handlerFor', () => {
  it('never mistakes an inherited property for a route', () => {
    expect(handlerFor({}, 'toString')).toBeUndefined();
    expect(handlerFor({}, 'invitation.received')).toBeUndefined();
  });
});
