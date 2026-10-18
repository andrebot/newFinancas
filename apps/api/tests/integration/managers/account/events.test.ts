import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  createAccountManager, subscribeAccountManager,
} from '../../../../src/managers/account';
import type { BusMessage } from '../../../../src/utilities/serviceBus';
import {
  ANA_ID, BEA_ID, CORRELATION_ID, fakeDeps, HOUSEHOLD_ID, NOW,
} from './fakes';

// The household.created → default Categories effect, verified from the
// receiving side (BDT plan, AccountManager): the bus is mocked, and the test
// delivers the event IdentityManager publishes.

const HOUSEHOLD_CREATED = {
  topic: 'household.created',
  payload: { householdId: HOUSEHOLD_ID, createdByUserId: ANA_ID, language: 'en-US' },
  correlationId: CORRELATION_ID,
  publishedAt: NOW,
} as BusMessage<'household.created'>;

const CDB_ID = '0199c5a0-0000-7000-8000-0000000000b9';
const MATURED_PAYLOAD = {
  holdingId: CDB_ID,
  accountId: '0199c5a0-0000-7000-8000-0000000000a1',
  householdId: HOUSEHOLD_ID,
  ownerUserId: ANA_ID as string | null,
  visibility: 'personal',
  assetType: 'cdb',
  ticker: null,
  dueDate: '2026-10-01',
};
/** What every recipient is told: a type and params, never text (OQ-82). */
const MATURED_PARAMS = {
  holdingId: CDB_ID, assetType: 'cdb', ticker: null, dueDate: '2026-10-01',
};

/**
 * A `holding.matured` event, as the daily job publishes it.
 *
 * @param changes - Fields that differ from Ana's personal CDB.
 * @returns The bus message.
 */
const matured = (changes: Partial<typeof MATURED_PAYLOAD> = {}) => ({
  topic: 'holding.matured',
  payload: { ...MATURED_PAYLOAD, ...changes },
  correlationId: CORRELATION_ID,
  publishedAt: NOW,
}) as BusMessage<'holding.matured'>;

/**
 * A mocked bus that keeps every subscription.
 *
 * @returns The bus, and the handler registered for each topic.
 */
const fakeBus = () => {
  const unsubscribe = vi.fn();
  const handlers = new Map<string, (message: BusMessage) => Promise<void>>();
  const bus = {
    subscribe: vi.fn((topic: string, handler: (message: BusMessage) => Promise<void>) => {
      handlers.set(topic, handler);
      return unsubscribe;
    }),
  };
  return { bus, handlers, unsubscribe };
};

describe('AccountManager — household.created (FR-10.1, VBD §3.1b)', () => {
  it('subscribes to household.created; seeds the defaults in the creator\'s language', async () => {
    const { deps, categories } = fakeDeps();
    const { bus, handlers } = fakeBus();

    subscribeAccountManager(bus as never, createAccountManager(deps));
    await handlers.get('household.created')!(HOUSEHOLD_CREATED);

    expect(bus.subscribe).toHaveBeenCalledWith('household.created', expect.any(Function));
    expect(categories.seedDefaults).toHaveBeenCalledWith(HOUSEHOLD_ID, 'en-US');
  });

  it('returns a function that unsubscribes', () => {
    const { deps } = fakeDeps();
    const { bus, unsubscribe } = fakeBus();

    subscribeAccountManager(bus as never, createAccountManager(deps))();

    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it.each([
    [true, 'Default categories seeded'],
    [false, 'Default categories not seeded: already there or household gone'],
  ])('logs the outcome (seeded: %s) as the system, on the event\'s ID', async (seeded, message) => {
    const { deps, categories } = fakeDeps();
    categories.seedDefaults.mockResolvedValueOnce(seeded);
    const logs = captureLogs();

    await createAccountManager(deps).seedDefaultCategories(HOUSEHOLD_CREATED);
    logs.stop();

    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'info',
      message,
      label: 'AccountManager',
      actor: 'system',
      correlationId: CORRELATION_ID,
      householdId: HOUSEHOLD_ID,
    }));
  });

  it('lets a failure reach the bus\'s error sink', async () => {
    const { deps, categories } = fakeDeps();
    categories.seedDefaults.mockRejectedValueOnce(new Error('db down'));

    await expect(createAccountManager(deps).seedDefaultCategories(HOUSEHOLD_CREATED))
      .rejects.toThrow('db down');
  });
});

describe('AccountManager — holding.matured (FR-5.8, FR-6.5, track-investments/uc-11)', () => {
  it('subscribes to holding.matured; tells a personal Account\'s owner; marks it', async () => {
    const {
      deps, notifications, holdings, households,
    } = fakeDeps();
    const { bus, handlers } = fakeBus();

    subscribeAccountManager(bus as never, createAccountManager(deps));
    await handlers.get('holding.matured')!(matured());

    expect(bus.subscribe).toHaveBeenCalledWith('holding.matured', expect.any(Function));
    expect(households.listMembers).not.toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledExactlyOnceWith(
      'holding.matured',
      { userId: ANA_ID },
      MATURED_PARAMS,
    );
    expect(holdings.markMaturedNotified).toHaveBeenCalledWith(CDB_ID);
  });

  it('tells every member of the household for a shared Account (OQ-171)', async () => {
    const { deps, notifications, households } = fakeDeps();
    households.listMembers.mockResolvedValueOnce([{ userId: ANA_ID }, { userId: BEA_ID }]);

    await createAccountManager(deps).notifyMaturedHolding(matured({ visibility: 'shared' }));

    expect(households.listMembers).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(notifications.notify.mock.calls.map(([, recipient]) => recipient))
      .toEqual([{ userId: ANA_ID }, { userId: BEA_ID }]);
  });

  it('marks a personal Holding with no owner left without telling anyone', async () => {
    const { deps, notifications, holdings } = fakeDeps();

    await createAccountManager(deps).notifyMaturedHolding(matured({ ownerUserId: null }));

    expect(notifications.notify).not.toHaveBeenCalled();
    expect(holdings.markMaturedNotified).toHaveBeenCalledWith(CDB_ID);
  });

  it('leaves it unmarked when a delivery fails, so tomorrow\'s run tries again', async () => {
    const {
      deps, notifications, holdings, households,
    } = fakeDeps();
    households.listMembers.mockResolvedValueOnce([{ userId: ANA_ID }, { userId: BEA_ID }]);
    notifications.notify.mockRejectedValueOnce(new Error('inbox down'));
    const logs = captureLogs();

    await createAccountManager(deps).notifyMaturedHolding(matured({ visibility: 'shared' }));
    logs.stop();

    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(holdings.markMaturedNotified).not.toHaveBeenCalled();
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'warn',
      message: 'Matured holding not marked: a delivery failed',
      actor: 'system',
      correlationId: CORRELATION_ID,
      holdingId: CDB_ID,
      recipients: 2,
      failed: 1,
    }));
  });

  it('logs the notice as the system, on the event\'s ID', async () => {
    const { deps } = fakeDeps();
    const logs = captureLogs();

    await createAccountManager(deps).notifyMaturedHolding(matured());
    logs.stop();

    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'info',
      message: 'Matured holding notified',
      label: 'AccountManager',
      actor: 'system',
      correlationId: CORRELATION_ID,
      holdingId: CDB_ID,
      recipients: 1,
    }));
  });
});
