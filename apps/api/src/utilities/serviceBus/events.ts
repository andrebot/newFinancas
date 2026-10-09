import type { CorrelationId } from '../correlationId';

// The events Managers exchange (VBD §3.0): the only coupling between them is
// this map of topic → payload. Adding an event is adding an entry here.

/** Topic → payload of every event on the bus. */
export interface BusEvents {
  /** IdentityManager created a household → AccountManager seeds default categories (§3.1b). */
  readonly 'household.created': { readonly householdId: string };
  /** The daily job found a matured holding → AccountManager notifies its owners (§3.2a). */
  readonly 'holding.matured': {
    readonly holdingId: string;
    readonly ownerUserIds: readonly string[];
  };
  /**
   * The daily job found a due schedule entry → TransactionManager posts it (§3.2a).
   * Draft shape; finalised with the scheduler (N9).
   */
  readonly 'transaction.import.requested': {
    readonly scheduleEntryId: string;
    readonly holdingId: string;
    readonly kind: string;
    readonly amount: number;
    readonly date: string;
  };
}

/** A topic on the bus. */
export type Topic = keyof BusEvents;

/** What a subscriber receives: the payload plus where it came from. */
export interface BusMessage<T extends Topic = Topic> {
  readonly topic: T;
  readonly payload: BusEvents[T];
  /** The publishing request's ID, so the subscriber's logs line up with it (OQ-99). */
  readonly correlationId: CorrelationId;
  readonly publishedAt: Date;
}

/** A subscriber; may be async. */
export type BusHandler<T extends Topic> = (message: BusMessage<T>) => void | Promise<void>;
