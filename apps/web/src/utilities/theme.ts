import type { UserPreferences } from '@financas/api-types';
import { isPaletteToken } from '@financas/reference';
import { theme } from '../config/constants';
import { safeStorage, type PreferenceStorage } from './safeStorage';

// ThemeUtility (FU4, EBD): which theme the page shows and what colour a
// category's stored palette token paints. The colours themselves are tokens in
// styles/theme.css (K1, OQ-121): `:root` is dark, `data-theme="light"` on
// <html> swaps in the light set, so applying a theme is one attribute and no
// component re-renders. `system` follows the device's colour scheme, live.
// The last applied preference is remembered in browser storage so a reload
// (or the sign-in screen) starts in it before the user's preferences load.

/** The user's setting (FR-1.21), as the API carries it. */
export type ThemePreference = NonNullable<UserPreferences['theme']>;

/** The theme actually shown. */
export type Theme = 'dark' | 'light';

/** The device's colour-scheme query (`matchMedia('(prefers-color-scheme: light)')`). */
export type ColorSchemeQuery = Pick<
  MediaQueryList,
  'matches' | 'addEventListener' | 'removeEventListener'
>;

/** What ThemeUtility touches: the <html> element, the device query and storage. */
export interface ThemeEnvironment {
  readonly root: HTMLElement;
  readonly prefersLight: ColorSchemeQuery;
  /** Remembers the last applied preference. */
  readonly storage: PreferenceStorage;
}

/** Applies preferences to one page; a new preference replaces the previous one. */
export interface ThemeController {
  /** Shows a preference and remembers it. */
  readonly apply: (preference: ThemePreference) => void;
  /** Shows the remembered preference, or the default when none is. */
  readonly restore: () => void;
}

const PREFERENCES: readonly string[] = ['dark', 'light', 'system'] satisfies ThemePreference[];

/**
 * Decides which theme a preference shows.
 *
 * @param preference - The user's setting.
 * @param prefersLight - Whether the device asks for a light colour scheme.
 * @returns The theme to show.
 */
export const resolveTheme = (preference: ThemePreference, prefersLight: boolean): Theme => {
  if (preference === 'system') {
    return prefersLight ? 'light' : 'dark';
  }
  return preference;
};

/**
 * Narrows a stored value to a preference.
 *
 * @param value - What storage holds (anything, if it was edited by hand).
 * @returns Whether it is a known preference.
 */
export const isThemePreference = (value: string | null): value is ThemePreference => (
  value !== null && PREFERENCES.includes(value)
);

/**
 * Builds the CSS colour for a category's stored palette token (OQ-85). It is a
 * variable reference, so it follows the theme without re-rendering; use it in
 * `style` (fill, stroke, background), not in a Tailwind class name.
 *
 * @param token - The category's `color` (`teal`, `rose`, …).
 * @returns `var(--c-cat-<token>)`, or the fallback colour for an unknown token.
 */
export const categoryColor = (token: string): string => {
  const known = isPaletteToken(token) ? token : theme.fallbackCategoryColor;
  return `var(--c-cat-${known})`;
};

/**
 * Builds the soft tint behind a category's icon (K50): its palette colour
 * mixed with transparency, as Tailwind's `/15` modifier does. Like
 * `categoryColor`, it follows the theme without re-rendering; use it in `style`.
 *
 * @param token - The category's `color` (`teal`, `rose`, …).
 * @returns A `color-mix()` of the category's colour (the fallback colour's for an unknown token).
 */
export const categoryTint = (token: string): string => (
  `color-mix(in oklab, ${categoryColor(token)} ${theme.categoryTintPercent}%, transparent)`
);

/**
 * Creates the controller for one page. Only a `system` preference listens to
 * the device; applying another preference stops that listening.
 *
 * @param environment - The <html> element, the device query and storage.
 * @returns The page's theme controller.
 */
export const createThemeController = (environment: ThemeEnvironment): ThemeController => {
  const { root, prefersLight, storage } = environment;
  let stopFollowingDevice = (): void => {};

  /**
   * Sets the attribute styles/theme.css keys on.
   *
   * @param preference - The preference to show.
   */
  const show = (preference: ThemePreference): void => {
    root.dataset.theme = resolveTheme(preference, prefersLight.matches);
  };

  /**
   * Shows a preference, following the device when it is `system`.
   *
   * @param preference - The preference to show.
   */
  const follow = (preference: ThemePreference): void => {
    stopFollowingDevice();
    stopFollowingDevice = () => {};
    show(preference);
    if (preference === 'system') {
      const onDeviceChange = (): void => show('system');
      prefersLight.addEventListener('change', onDeviceChange);
      stopFollowingDevice = () => prefersLight.removeEventListener('change', onDeviceChange);
    }
  };

  return {
    apply: (preference) => {
      follow(preference);
      storage.write(preference);
    },
    restore: () => {
      const saved = storage.read();
      follow(isThemePreference(saved) ? saved : theme.defaultPreference);
    },
  };
};

/**
 * The real page's environment.
 *
 * @param page - The browser window.
 * @returns <html>, the device's light-scheme query and the remembered preference.
 */
export const browserThemeEnvironment = (page: Window): ThemeEnvironment => ({
  root: page.document.documentElement,
  prefersLight: page.matchMedia('(prefers-color-scheme: light)'),
  storage: safeStorage(() => page.localStorage, theme.storageKey),
});
