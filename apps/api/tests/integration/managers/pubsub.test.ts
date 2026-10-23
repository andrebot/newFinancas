import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, vi,
} from 'vitest';
import { createAccountManager, subscribeAccountManager } from '../../../src/managers/account';
import { createIdentityManager } from '../../../src/managers/identity';
import type { CorrelationId } from '../../../src/utilities/correlationId';
import { createServiceBus, type BusMessage } from '../../../src/utilities/serviceBus';
import { fakeDeps as fakeAccountDeps } from './account/fakes';
import {
  ANA, fakeDeps as fakeIdentityDeps, HOUSEHOLD, NOW, SESSION,
} from './identity/fakes';

// I5 — Manager ↔ Manager through the bus (VBD §3.0): the real in-process bus
// between the real Managers, wired as server.ts wires them, each Manager on
// its own tier below, mocked. The suites on either side mock the bus; this one
// proves the publish and the subscription meet — same topic, same payload,
// delivered after the publisher has answered.

const CORRELATION_ID = '0199c5a0-0000-7000-8000-0000000000cc' as CorrelationId;
const CONTEXT = {
  correlationId: CORRELATION_ID,
  actor: { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const },
};
const CDB_ID = '0199c5a0-0000-7000-8000-0000000000b9';

/**
 * Both Managers on one real bus, AccountManager subscribed as at start-up.
 *
 * @returns The bus, its error sink, both Managers and their mocked tiers.
 */
const wired = () => {
  const onHandlerError = vi.fn();
  const bus = createServiceBus({ now: () => NOW, onHandlerError });
  const identityTier = fakeIdentityDeps();
  const accountTier = fakeAccountDeps();
  const identity = createIdentityManager({ ...identityTier.deps, bus });
  subscribeAccountManager(bus, createAccountManager(accountTier.deps));
  return {
    bus, onHandlerError, identity, identityTier, accountTier,
  };
};

describe('I5 — household.created: IdentityManager → AccountManager (FR-10.1, VBD §3.1b)', () => {
  it('seeds the new household\'s default Categories in the creator\'s language', async () => {
    const { bus, identity, accountTier } = wired();

    await identity.createHousehold(CONTEXT, 'Casa');
    await bus.drain();

    expect(accountTier.categories.seedDefaults)
      .toHaveBeenCalledExactlyOnceWith(HOUSEHOLD.id, ANA.language);
  });

  it('answers the creator before the seeding finishes', async () => {
    const { bus, identity, accountTier } = wired();
    let finishSeeding = (_seeded: boolean) => {};
    accountTier.categories.seedDefaults.mockReturnValueOnce(new Promise((resolve) => {
      finishSeeding = resolve;
    }));

    const created = await identity.createHousehold(CONTEXT, 'Casa');

    expect(created).toMatchObject({ id: HOUSEHOLD.id, role: 'Owner' });
    finishSeeding(true);
    await bus.drain();
    expect(accountTier.categories.seedDefaults).toHaveBeenCalledOnce();
  });

  it('logs the seeding on the creating request\'s correlation ID (OQ-99)', async () => {
    const { bus, identity } = wired();
    const logs = captureLogs();

    await identity.createHousehold(CONTEXT, 'Casa');
    await bus.drain();
    logs.stop();

    expect(logs.events).toContainEqual(expect.objectContaining({
      message: 'Default categories seeded',
      label: 'AccountManager',
      correlationId: CORRELATION_ID,
      householdId: HOUSEHOLD.id,
    }));
  });

  it('hands a failed seeding to the bus\'s error sink; the household stands', async () => {
    const {
      bus, onHandlerError, identity, accountTier,
    } = wired();
    accountTier.categories.seedDefaults.mockRejectedValueOnce(new Error('db down'));

    const created = await identity.createHousehold(CONTEXT, 'Casa');
    await bus.drain();

    expect(created.id).toBe(HOUSEHOLD.id);
    expect(onHandlerError).toHaveBeenCalledExactlyOnceWith(
      new Error('db down'),
      expect.objectContaining({ topic: 'household.created', correlationId: CORRELATION_ID }),
    );
  });
});

describe('I5 — holding.matured: the daily job → AccountManager (FR-5.8, uc-11)', () => {
  // The daily job (N9) is not built yet: the test publishes what it will, the
  // payload typed by the bus; the run itself is I6's.
  const MATURED: BusMessage<'holding.matured'>['payload'] = {
    holdingId: CDB_ID,
    accountId: '0199c5a0-0000-7000-8000-0000000000a1',
    householdId: HOUSEHOLD.id,
    ownerUserId: ANA.id,
    visibility: 'personal',
    assetType: 'cdb',
    ticker: null,
    dueDate: '2026-10-01',
  };

  it('tells the owner and marks the Holding notified', async () => {
    const { bus, accountTier } = wired();

    bus.publish('holding.matured', MATURED, CORRELATION_ID);
    await bus.drain();

    expect(accountTier.notifications.notify).toHaveBeenCalledExactlyOnceWith(
      'holding.matured',
      { userId: ANA.id },
      {
        holdingId: CDB_ID, assetType: 'cdb', ticker: null, dueDate: '2026-10-01',
      },
    );
    expect(accountTier.holdings.markMaturedNotified).toHaveBeenCalledExactlyOnceWith(CDB_ID);
  });

  it('hands a failed notice to the bus\'s error sink', async () => {
    const { bus, onHandlerError, accountTier } = wired();
    accountTier.holdings.markMaturedNotified.mockRejectedValueOnce(new Error('db down'));

    bus.publish('holding.matured', MATURED, CORRELATION_ID);
    await bus.drain();

    expect(onHandlerError).toHaveBeenCalledExactlyOnceWith(
      new Error('db down'),
      expect.objectContaining({ topic: 'holding.matured', payload: MATURED }),
    );
  });
});
