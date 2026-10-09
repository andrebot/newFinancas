import type { CorrelationId } from '../correlationId';
import type {
  BusEvents, BusHandler, BusMessage, Topic,
} from './events';

// ServiceBusUtility (U6, VBD §3.0): publish/subscribe between Managers. v1 is an
// in-process bus; another transport can replace it without touching a Manager.
// Delivery is fire-and-forget and at-most-once — a crash mid-delivery loses the
// message (accepted for v1; OQ-102 has the outbox option and what it would cost).

export type {
  BusEvents, BusHandler, BusMessage, Topic,
} from './events';

/** What the bus needs from outside. */
export interface ServiceBusDeps {
  readonly now: () => Date;
  /** Receives a subscriber's failure; it never reaches the publisher (LoggingUtility, U2). */
  readonly onHandlerError: (error: unknown, message: BusMessage) => void;
}

/**
 * Creates an in-process service bus.
 *
 * @param deps - Clock and handler-failure sink.
 * @returns `publish`, `subscribe` and `drain`.
 */
export const createServiceBus = (deps: ServiceBusDeps) => {
  const subscribers = new Map<Topic, Set<BusHandler<Topic>>>();
  const inFlight = new Set<Promise<void>>();

  /**
   * Runs one handler after the publisher's current step, isolating its failure.
   *
   * @param handler - The subscriber.
   * @param message - The frozen message.
   */
  const deliver = <T extends Topic>(handler: BusHandler<T>, message: BusMessage<T>) => {
    const run: Promise<void> = Promise.resolve()
      .then(() => handler(message))
      .catch((error: unknown) => deps.onHandlerError(error, message as BusMessage))
      .finally(() => inFlight.delete(run));
    inFlight.add(run);
  };

  return {
    /**
     * Publishes an event. Returns before any subscriber runs; subscribers see a
     * frozen message, in the order they subscribed.
     *
     * @param topic - The event.
     * @param payload - Its payload, typed by the topic.
     * @param correlationId - The publishing request's ID.
     */
    publish: <T extends Topic>(
      topic: T,
      payload: BusEvents[T],
      correlationId: CorrelationId,
    ): void => {
      const message: BusMessage<T> = Object.freeze({
        topic,
        payload: Object.freeze({ ...payload }) as BusEvents[T],
        correlationId,
        publishedAt: deps.now(),
      });
      [...(subscribers.get(topic) ?? [])].forEach((handler) => deliver(handler, message));
    },
    /**
     * Subscribes to a topic. Subscribing the same handler twice registers it once.
     *
     * @param topic - The event.
     * @param handler - Called with each message.
     * @returns A function that unsubscribes this handler.
     */
    subscribe: <T extends Topic>(topic: T, handler: BusHandler<T>): (() => void) => {
      const handlers = subscribers.get(topic) ?? new Set<BusHandler<Topic>>();
      handlers.add(handler as BusHandler<Topic>);
      subscribers.set(topic, handlers);
      return () => {
        handlers.delete(handler as BusHandler<Topic>);
      };
    },
    /**
     * Waits until every handler started so far — and any they caused — has finished.
     *
     * @returns Resolves when nothing is in flight.
     */
    drain: async (): Promise<void> => {
      while (inFlight.size > 0) {
        // eslint-disable-next-line no-await-in-loop -- handlers may publish more while we wait
        await Promise.allSettled([...inFlight]);
      }
    },
  };
};

/** The bus's operations, as injected into Managers. */
export type ServiceBus = ReturnType<typeof createServiceBus>;
