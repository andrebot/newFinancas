import type { BusMessage, ServiceBus } from '../../utilities/serviceBus';
import { loggerFor, type AccountDeps } from './context';

// What AccountManager does when another Manager announces something (VBD §3.0,
// §3.1b): the bus is the only door between Managers, so IdentityManager never
// learns AccountManager exists.

/**
 * Builds the event handlers.
 *
 * @param deps - The tier below.
 * @returns `seedDefaultCategories`.
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
  const unsubscribers = [bus.subscribe('household.created', handlers.seedDefaultCategories)];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};
