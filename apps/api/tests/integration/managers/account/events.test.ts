import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  createAccountManager, subscribeAccountManager,
} from '../../../../src/managers/account';
import type { BusMessage } from '../../../../src/utilities/serviceBus';
import {
  ANA_ID, CORRELATION_ID, fakeDeps, HOUSEHOLD_ID, NOW,
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

    expect(unsubscribe).toHaveBeenCalledTimes(1);
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
