import type { BusMessage, ServiceBus } from '../../utilities/serviceBus';
import { loggerFor, type AccountDeps } from './context';

/**
 * Who hears that a Holding matured: a personal Account's owner; every member of
 * the household for a shared one (OQ-171).
 *
 * @param deps - The tier below.
 * @param holding - The matured Holding, as the event carries it.
 * @returns The recipients' user ids.
 */
const recipientsOf = async (
  deps: AccountDeps,
  holding: BusMessage<'holding.matured'>['payload'],
): Promise<string[]> => {
  if (holding.visibility === 'shared') {
    return (await deps.households.listMembers(holding.householdId))
      .map((member) => member.userId);
  }
  return holding.ownerUserId === null ? [] : [holding.ownerUserId];
};

// What AccountManager does when another Manager announces something (VBD §3.0,
// §3.1b): the bus is the only door between Managers, so IdentityManager never
// learns AccountManager exists.

/**
 * Builds the event handlers.
 *
 * @param deps - The tier below.
 * @returns `seedDefaultCategories`, `notifyMaturedHolding`.
 */
export const createEventHandlers = (deps: AccountDeps) => ({
  /**
   * A household was created: seed its default Categories in the creator's
   * language (FR-10.1, OQ-117) — once; a household that already has one is
   * left alone (OQ-173). A failure reaches the bus's error sink.
   *
   * @param message - The `household.created` event.
   */
  seedDefaultCategories: async (message: BusMessage<'household.created'>): Promise<void> => {
    const { householdId, language } = message.payload;
    const seeded = await deps.categories.seedDefaults(householdId, language);
    loggerFor(message.correlationId).info(
      seeded
        ? 'Default categories seeded'
        : 'Default categories not seeded: already there or household gone',
      { householdId, language },
    );
  },

  /**
   * A fixed-term Holding passed its due date with a position: suggest each
   * recipient archives it (uc-11, FR-5.8, FR-6.5) — a type and params, never
   * text (OQ-82). Marked notified only when every delivery succeeded; otherwise
   * tomorrow's run tries again. Runs as the system.
   *
   * @param message - The `holding.matured` event.
   */
  notifyMaturedHolding: async (message: BusMessage<'holding.matured'>): Promise<void> => {
    const holding = message.payload;
    const params = {
      holdingId: holding.holdingId,
      assetType: holding.assetType,
      ticker: holding.ticker,
      dueDate: holding.dueDate,
    };
    const recipients = await recipientsOf(deps, holding);
    const deliveries = await Promise.allSettled(recipients.map((userId) => (
      deps.notifications.notify('holding.matured', { userId }, params))));
    const failed = deliveries.filter((delivery) => delivery.status === 'rejected').length;
    const log = loggerFor(message.correlationId);
    if (failed > 0) {
      log.warn('Matured holding not marked: a delivery failed', {
        holdingId: holding.holdingId, recipients: recipients.length, failed,
      });
      return;
    }
    await deps.holdings.markMaturedNotified(holding.holdingId);
    log.info('Matured holding notified', {
      holdingId: holding.holdingId, recipients: recipients.length,
    });
  },
});

/** AccountManager's event handlers. */
export type AccountEventHandlers = ReturnType<typeof createEventHandlers>;

/**
 * Subscribes AccountManager to the events it handles.
 *
 * @param bus - ServiceBusUtility.
 * @param handlers - AccountManager's event handlers.
 * @returns A function that unsubscribes them all.
 */
export const subscribeAccountManager = (
  bus: Pick<ServiceBus, 'subscribe'>,
  handlers: AccountEventHandlers,
): (() => void) => {
  const unsubscribers = [
    bus.subscribe('household.created', handlers.seedDefaultCategories),
    bus.subscribe('holding.matured', handlers.notifyMaturedHolding),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};
