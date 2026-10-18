import { describe, expect, it } from 'vitest';
import inSequence from '../../../src/managers/sequence';

describe('inSequence', () => {
  it('starts each step only after the last one finished, keeping the order', async () => {
    const events: string[] = [];
    const step = async (item: number) => {
      events.push(`start ${item}`);
      await new Promise((resolve) => {
        setTimeout(resolve, 3 - item);
      });
      events.push(`end ${item}`);
      return item * 10;
    };

    const results = await inSequence([1, 2], step);

    expect(results).toEqual([10, 20]);
    expect(events).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
  });

  it('answers an empty list without running anything', async () => {
    expect(await inSequence([], async () => 1)).toEqual([]);
  });

  it('stops at the first failure', async () => {
    const ran: number[] = [];

    await expect(inSequence([1, 2, 3], async (item) => {
      ran.push(item);
      if (item === 2) throw new Error('boom');
      return item;
    })).rejects.toThrow('boom');
    expect(ran).toEqual([1, 2]);
  });
});
