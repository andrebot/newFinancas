import {
  describe, expect, it, vi,
} from 'vitest';
import { newCorrelationId } from '../../../../src/utilities/correlationId';
import { createServiceBus, type BusMessage } from '../../../../src/utilities/serviceBus';

const NOW = new Date('2026-10-08T12:00:00Z');
const CORRELATION_ID = newCorrelationId(() => '0199c5a0-1b2c-7d3e-8f40-123456789abc');

/**
 * Builds a bus with a fixed clock and a spy for handler failures.
 *
 * @returns The bus and the failure spy.
 */
const setup = () => {
  const onHandlerError = vi.fn();
  return { bus: createServiceBus({ now: () => NOW, onHandlerError }), onHandlerError };
};

describe('ServiceBusUtility', () => {
  it('delivers a message with its payload, correlation ID and publish time', async () => {
    const { bus } = setup();
    const received: BusMessage<'household.created'>[] = [];
    bus.subscribe('household.created', (message) => {
      received.push(message);
    });

    bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);
    await bus.drain();

    expect(received).toEqual([{
      topic: 'household.created',
      payload: { householdId: 'h1' },
      correlationId: CORRELATION_ID,
      publishedAt: NOW,
    }]);
  });

  it('delivers to every subscriber of the topic, in subscription order', async () => {
    const { bus } = setup();
    const calls: string[] = [];
    bus.subscribe('household.created', () => {
      calls.push('first');
    });
    bus.subscribe('household.created', () => {
      calls.push('second');
    });

    bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);
    await bus.drain();

    expect(calls).toEqual(['first', 'second']);
  });

  it('keeps topics apart, and publishing with no subscribers is harmless', async () => {
    const { bus } = setup();
    const handler = vi.fn();
    bus.subscribe('holding.matured', handler);

    bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);
    await bus.drain();

    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe, leaving other subscribers in place', async () => {
    const { bus } = setup();
    const removed = vi.fn();
    const kept = vi.fn();
    const unsubscribe = bus.subscribe('household.created', removed);
    bus.subscribe('household.created', kept);

    unsubscribe();
    bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);
    await bus.drain();

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('registers the same handler once', async () => {
    const { bus } = setup();
    const handler = vi.fn();
    bus.subscribe('household.created', handler);
    bus.subscribe('household.created', handler);

    bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);
    await bus.drain();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is fire-and-forget: publish returns before any subscriber runs', async () => {
    const { bus } = setup();
    const handler = vi.fn();
    bus.subscribe('household.created', handler);

    bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);

    expect(handler).not.toHaveBeenCalled();
    await bus.drain();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates a failing subscriber: reported, publisher and others unaffected', async () => {
    const { bus, onHandlerError } = setup();
    const failure = new Error('seed failed');
    const other = vi.fn();
    bus.subscribe('household.created', async () => {
      throw failure;
    });
    bus.subscribe('household.created', other);

    const publish = () => bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);

    expect(publish).not.toThrow();
    await bus.drain();

    expect(other).toHaveBeenCalledTimes(1);
    expect(onHandlerError)
      .toHaveBeenCalledWith(failure, expect.objectContaining({ topic: 'household.created' }));
  });

  it('gives subscribers a frozen copy, so one cannot change what the next sees', async () => {
    const { bus } = setup();
    const payload = { householdId: 'h1' };
    const seen: unknown[] = [];
    bus.subscribe('household.created', (message) => {
      expect(Object.isFrozen(message)).toBe(true);
      expect(Object.isFrozen(message.payload)).toBe(true);
      expect(Reflect.set(message.payload, 'householdId', 'x')).toBe(false);
    });
    bus.subscribe('household.created', (message) => {
      seen.push(message.payload.householdId);
    });

    bus.publish('household.created', payload, CORRELATION_ID);
    payload.householdId = 'changed-after-publish';
    await bus.drain();

    expect(seen).toEqual(['h1']);
  });

  it('delivers to the subscribers present at publish time', async () => {
    const { bus } = setup();
    const late = vi.fn();
    bus.subscribe('household.created', () => {
      bus.subscribe('household.created', late);
    });

    bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);
    await bus.drain();

    expect(late).not.toHaveBeenCalled();
  });

  it('drain waits for async handlers and for events they publish in turn', async () => {
    const { bus } = setup();
    const order: string[] = [];
    bus.subscribe('household.created', async (message) => {
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      order.push('household handled');
      bus.publish('holding.matured', { holdingId: 'x', ownerUserIds: [] }, message.correlationId);
    });
    bus.subscribe('holding.matured', async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      order.push('holding handled');
    });

    bus.publish('household.created', { householdId: 'h1' }, CORRELATION_ID);
    await bus.drain();

    expect(order).toEqual(['household handled', 'holding handled']);
  });

  it('drain resolves immediately when nothing is in flight', async () => {
    await expect(setup().bus.drain()).resolves.toBeUndefined();
  });
});
