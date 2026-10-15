// Cross-tab sign-out (S1, OQ-124 follow-up, OQ-156): every tab shares the
// refresh token's storage entry, so signing out in one tab removes it for all.
// The browser tells the other tabs through the `storage` event; they end their
// session at once instead of when their access token next fails.

/** The parts of `window` the watcher uses. */
export type StorageEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * Watches for another tab removing the refresh token.
 *
 * @param page - The page's `window`.
 * @param storageKey - The refresh token's storage entry.
 * @param onSignedOut - Called when another tab removed it.
 * @returns Stops watching.
 */
export const watchSignOutElsewhere = (
  page: StorageEventTarget,
  storageKey: string,
  onSignedOut: () => void,
) => {
  const onStorage = (event: StorageEvent) => {
    // `key` is null when another tab cleared the whole storage.
    const touched = event.key === storageKey || event.key === null;
    if (touched && event.newValue === null) {
      onSignedOut();
    }
  };
  page.addEventListener('storage', onStorage);
  return () => page.removeEventListener('storage', onStorage);
};
