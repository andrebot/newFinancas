import {
  describe, expect, it, vi,
} from 'vitest';
import { watchSignOutElsewhere } from '../../../src/shell/signOutElsewhere';

// Cross-tab sign-out (BDT: Utility → unit). The page is jsdom's window; the
// test raises the `storage` event the browser sends to the other tabs.

const KEY = 'financas.refreshToken';

/**
 * Raises a `storage` event on the window.
 *
 * @param init - The event's key and new value.
 */
const storageEvent = (init: StorageEventInit) => {
  window.dispatchEvent(new StorageEvent('storage', init));
};

describe('watchSignOutElsewhere', () => {
  it('ends the session when another tab removes the refresh token or clears storage', () => {
    const onSignedOut = vi.fn();
    const stop = watchSignOutElsewhere(window, KEY, onSignedOut);

    storageEvent({ key: KEY, newValue: null });
    storageEvent({ key: null, newValue: null });

    expect(onSignedOut).toHaveBeenCalledTimes(2);
    stop();
  });

  it('ignores a rotated token and other entries', () => {
    const onSignedOut = vi.fn();
    const stop = watchSignOutElsewhere(window, KEY, onSignedOut);

    storageEvent({ key: KEY, newValue: 'rotated' });
    storageEvent({ key: 'financas.theme', newValue: null });

    expect(onSignedOut).not.toHaveBeenCalled();
    stop();
  });

  it('stops watching', () => {
    const onSignedOut = vi.fn();
    watchSignOutElsewhere(window, KEY, onSignedOut)();

    storageEvent({ key: KEY, newValue: null });

    expect(onSignedOut).not.toHaveBeenCalled();
  });
});
