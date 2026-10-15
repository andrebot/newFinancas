import {
  describe, expect, it, vi,
} from 'vitest';
import { createAlertQueue, findDuplicate, type Alert } from '../../../src/utilities/alerts';

// AlertUtility's queue (BDT: Utility → unit). Pure: nothing is mocked.

describe('findDuplicate', () => {
  const queued: Alert[] = [{ id: 1, tone: 'error', message: 'Offline' }];

  it('finds a toast with the same tone and message', () => {
    expect(findDuplicate(queued, { tone: 'error', message: 'Offline' })).toBe(queued[0]);
  });

  it('does not match the same message in another tone', () => {
    expect(findDuplicate(queued, { tone: 'warning', message: 'Offline' })).toBeUndefined();
  });

  it('does not match another message in the same tone', () => {
    expect(findDuplicate(queued, { tone: 'error', message: 'Not found' })).toBeUndefined();
  });
});

describe('createAlertQueue', () => {
  it('starts empty', () => {
    expect(createAlertQueue(3).visible()).toEqual([]);
  });

  it('shows toasts oldest first, with fresh ids, and tells listeners', () => {
    const queue = createAlertQueue(3);
    const listener = vi.fn();
    queue.subscribe(listener);
    const first = queue.show({ tone: 'success', message: 'Saved' });
    const second = queue.show({ tone: 'info', message: 'Synced', duration: null });

    expect(second).not.toBe(first);
    expect(queue.visible()).toEqual([
      { id: first, tone: 'success', message: 'Saved' },
      {
        id: second, tone: 'info', message: 'Synced', duration: null,
      },
    ]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps toasts past the cap waiting, then slides them in as shown ones close', () => {
    const queue = createAlertQueue(2);
    const first = queue.show({ tone: 'error', message: 'A' });
    queue.show({ tone: 'error', message: 'B' });
    const listener = vi.fn();
    queue.subscribe(listener);
    const third = queue.show({ tone: 'success', message: 'C' });

    expect(queue.visible().map((alert) => alert.message)).toEqual(['A', 'B']);
    expect(listener).not.toHaveBeenCalled();

    queue.dismiss(first);
    expect(queue.visible().map((alert) => alert.message)).toEqual(['B', 'C']);
    expect(queue.visible()[1]?.id).toBe(third);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('closes a waiting toast without disturbing the shown ones', () => {
    const queue = createAlertQueue(1);
    queue.show({ tone: 'error', message: 'A' });
    const waiting = queue.show({ tone: 'error', message: 'B' });
    const shown = queue.visible();
    const listener = vi.fn();
    queue.subscribe(listener);

    queue.dismiss(waiting);
    expect(queue.visible()).toBe(shown);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not add a duplicate of a shown or waiting toast, and returns its id', () => {
    const queue = createAlertQueue(1);
    const shown = queue.show({ tone: 'error', message: 'Offline' });
    const waiting = queue.show({ tone: 'error', message: 'Not found' });

    expect(queue.show({ tone: 'error', message: 'Offline' })).toBe(shown);
    expect(queue.show({ tone: 'error', message: 'Not found' })).toBe(waiting);
    queue.dismiss(shown);
    queue.dismiss(waiting);
    expect(queue.visible()).toEqual([]);
  });

  it('shows a message again once its toast has closed', () => {
    const queue = createAlertQueue(3);
    const first = queue.show({ tone: 'success', message: 'Saved' });
    queue.dismiss(first);

    expect(queue.show({ tone: 'success', message: 'Saved' })).not.toBe(first);
    expect(queue.visible()).toHaveLength(1);
  });

  it('ignores an unknown id', () => {
    const queue = createAlertQueue(3);
    queue.show({ tone: 'success', message: 'Saved' });
    const shown = queue.visible();
    const listener = vi.fn();
    queue.subscribe(listener);

    queue.dismiss(999);
    expect(queue.visible()).toBe(shown);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops telling a listener once it unsubscribes', () => {
    const queue = createAlertQueue(3);
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    unsubscribe();

    queue.show({ tone: 'success', message: 'Saved' });
    expect(listener).not.toHaveBeenCalled();
  });
});
