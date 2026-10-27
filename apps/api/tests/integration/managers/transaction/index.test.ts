import {
  describe, expect, it, vi,
} from 'vitest';
import type { ServiceBus } from '../../../../src/utilities/serviceBus';
import {
  createTransactionManager,
  subscribeTransactionManager,
} from '../../../../src/managers/transaction';
import type { TransactionEventHandlers } from '../../../../src/managers/transaction/events';
import { fakeDeps } from './fakes';

describe('createTransactionManager', () => {
  it('exposes every use case and the event handlers on one object (VBD §3.1)', () => {
    const manager = createTransactionManager(fakeDeps().deps);
    for (const name of ['recordTransaction', 'editTransaction', 'deleteTransaction',
      'listTransactions',

      'postScheduledEntry']) {
      expect(typeof (manager as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

describe('subscribeTransactionManager', () => {
  it('subscribes the one handler to its topic and unsubscribes on release (VBD §3.2a)', () => {
    const seen: { topic: string; handler: unknown }[] = [];
    const unsubscribe = vi.fn();
    const bus = {
      subscribe: vi.fn((topic: string, handler: unknown) => {
        seen.push({ topic, handler });
        return unsubscribe;
      }),
    } as Pick<ServiceBus, 'subscribe'>;
    const handlers = { postScheduledEntry: vi.fn() } as unknown as TransactionEventHandlers;

    const release = subscribeTransactionManager(bus, handlers);

    expect(seen).toEqual([{
      topic: 'transaction.import.requested',
      handler: handlers.postScheduledEntry,
    }]);
    release();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
