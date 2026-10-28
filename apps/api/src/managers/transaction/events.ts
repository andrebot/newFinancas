import { findKind } from '@financas/reference';
import type { BusMessage } from '../../utilities/serviceBus';
import { loggerFor, type TransactionDeps } from './context';
import { loadScheduledTarget, recordScheduled } from './record';

// What TransactionManager does when the daily job announces a due schedule
// entry (VBD §3.0/§3.2a): the bus is the only door between Managers, so the
// scheduler never learns TransactionManager exists — and this handler runs the
// exact same Record pipeline a user's entry would, as the system.

/** Builds the event handlers. */
export const createEventHandlers = (deps: TransactionDeps) => ({
  /**
   * A due schedule entry posts itself through the exact Record pipeline
   * (§3.2a), with `markEntryPosted` first in the same transaction — a second
   * delivery of the event finds it posted and does nothing more (OQ-171).
   * Runs as the system, so its row carries no user (`source: schedule`). An
   * entry whose position is already zero — or whose Holding its user archived —
   * is moot and closes out instead of retrying forever; any other refusal
   * reaches the bus's error sink and leaves the entry unposted for tomorrow's
   * run.
   *
   * @param message - The `transaction.import.requested` event.
   */
  postScheduledEntry: async (
    message: BusMessage<'transaction.import.requested'>,
  ): Promise<void> => {
    const { payload } = message;
    const kind = findKind(payload.kind);
    if (!kind) throw new Error(`Unknown scheduled transaction kind ${payload.kind}`);
    const target = await loadScheduledTarget(deps, payload.householdId, payload.accountId);
    // The FK makes a missing Holding impossible — loud if it ever is.
    const holding = await deps.holdings.findById(payload.householdId, payload.holdingId);
    if (!holding) throw new Error(`Schedule entry for a missing Holding ${payload.holdingId}`);
    if (holding.archivedAt !== null && holding.archivedBy === 'user') {
      // The user closed this instrument: a late entry is an anomaly to see, not a retry.
      await deps.holdings.markEntryPosted(payload.scheduleEntryId);
      const log = loggerFor(message.correlationId);
      log.error('Schedule entry skipped: Holding archived by its user', {
        scheduleEntryId: payload.scheduleEntryId, holdingId: payload.holdingId,
      });
      return;
    }
    if (holding.quantity === 0) {
      await deps.holdings.markEntryPosted(payload.scheduleEntryId);
      loggerFor(message.correlationId).info('Schedule entry skipped: position already zero', {
        scheduleEntryId: payload.scheduleEntryId, holdingId: payload.holdingId,
      });
      return;
    }
    // A redemption posts the whole position as of now; a concurrent change fails this post and
    // retries tomorrow.
    const request = {
      kind: kind.code,
      date: payload.date,
      amount: payload.amount,
      currency: target.account.currency,
      accountId: payload.accountId,
      holdingId: payload.holdingId,
      source: 'schedule' as const,
      ...(kind.code === 'investment_redemption' && { quantity: holding.quantity }),
    };
    await recordScheduled(
      deps,
      payload.householdId,
      target,
      kind,
      request,
      payload.scheduleEntryId,
    );
    loggerFor(message.correlationId).info('Schedule entry posted', {
      scheduleEntryId: payload.scheduleEntryId, holdingId: payload.holdingId,
    });
  },
});

export type TransactionEventHandlers = ReturnType<typeof createEventHandlers>;
