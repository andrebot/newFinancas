// Browser storage that never throws (FU4, FU5): a blocked `localStorage`
// (private mode, disabled site data, a full quota) only means a remembered
// preference is forgotten on the next load. ThemeUtility and I18nUtility keep
// their last applied preference in one entry each.

/** One remembered value; reading or writing it never throws. */
export interface PreferenceStorage {
  readonly read: () => string | null;
  readonly write: (value: string) => void;
}

/**
 * Wraps one `localStorage` entry so failures are silent.
 *
 * @param getStorage - Returns the storage; reaching it may itself throw.
 * @param key - The entry holding the value.
 * @returns The never-throwing storage.
 */
export const safeStorage = (getStorage: () => Storage, key: string): PreferenceStorage => ({
  read: () => {
    try {
      return getStorage().getItem(key);
    } catch {
      return null;
    }
  },
  write: (value) => {
    try {
      getStorage().setItem(key, value);
    } catch {
      // Nothing to do: the preference is applied, only the next load forgets it.
    }
  },
});
