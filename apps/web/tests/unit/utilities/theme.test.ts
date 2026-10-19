import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PALETTE_TOKENS } from '@financas/reference';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { theme } from '../../../src/config/constants';
import {
  browserThemeEnvironment,
  categoryColor,
  categoryTint,
  createThemeController,
  isThemePreference,
  resolveTheme,
  type ColorSchemeQuery,
  type ThemeEnvironment,
} from '../../../src/utilities/theme';
import type { PreferenceStorage } from '../../../src/utilities/safeStorage';

// ThemeUtility (BDT: Utility → unit). Mocked: only what it touches outside —
// the device's colour-scheme query and storage. <html> is jsdom's own.

const css = readFileSync(resolve(import.meta.dirname, '../../../src/styles/theme.css'), 'utf8');

/** A device query whose answer the test flips, firing `change` like the browser. */
interface FakeDevice extends ColorSchemeQuery {
  setLight: (light: boolean) => void;
  listenerCount: () => number;
}

/**
 * Builds a fake `prefers-color-scheme: light` query.
 *
 * @param light - Whether the device starts in a light scheme.
 * @returns The fake query.
 */
const fakeDevice = (light: boolean): FakeDevice => {
  // A media query only ever fires `change`; a listener on any other event never runs.
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const device = {
    matches: light,
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change') listeners.delete(listener);
    },
    setLight: (next: boolean) => {
      device.matches = next;
      listeners.forEach((listener) => (listener as () => void)());
    },
    listenerCount: () => listeners.size,
  };
  return device as FakeDevice;
};

/**
 * Builds an in-memory storage.
 *
 * @param saved - What it holds at start.
 * @returns The storage.
 */
const memoryStorage = (saved: string | null = null) => {
  let value = saved;
  return {
    read: () => value,
    write: (next: string) => {
      value = next;
    },
    value: () => value,
  };
};

/**
 * Builds an environment on jsdom's <html>.
 *
 * @param device - The device query.
 * @param storage - The storage.
 * @returns The environment.
 */
const environmentOf = (device: FakeDevice, storage: PreferenceStorage): ThemeEnvironment => ({
  root: document.documentElement,
  prefersLight: device,
  storage,
});

const shown = () => document.documentElement.dataset.theme;

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe('resolveTheme', () => {
  it.each([
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['system', false, 'dark'],
    ['system', true, 'light'],
  ] as const)('%s on a device preferring light=%s shows %s', (preference, light, expected) => {
    expect(resolveTheme(preference, light)).toBe(expected);
  });
});

describe('isThemePreference', () => {
  it.each(['dark', 'light', 'system'])('accepts %s', (value) => {
    expect(isThemePreference(value)).toBe(true);
  });

  it.each([null, '', 'Dark', 'sepia'])('rejects %s', (value) => {
    expect(isThemePreference(value)).toBe(false);
  });
});

describe('categoryColor', () => {
  it.each([...PALETTE_TOKENS])('%s resolves to a variable declared in both themes', (token) => {
    const color = categoryColor(token);
    const variable = `--c-cat-${token}`;
    const lightStart = css.indexOf("[data-theme='light'] {");

    expect(color).toBe(`var(${variable})`);
    expect(css.slice(0, lightStart)).toContain(`${variable}:`);
    expect(css.slice(lightStart)).toContain(`${variable}:`);
  });

  it('falls back to the fallback colour for a token this build does not know', () => {
    expect(categoryColor('ultraviolet')).toBe(`var(--c-cat-${theme.fallbackCategoryColor})`);
  });
});

describe('categoryTint', () => {
  it('mixes the category’s colour with transparency', () => {
    expect(categoryTint('teal'))
      .toBe(`color-mix(in oklab, var(--c-cat-teal) ${theme.categoryTintPercent}%, transparent)`);
  });

  it('tints the fallback colour for a token this build does not know', () => {
    expect(categoryTint('ultraviolet')).toContain(`var(--c-cat-${theme.fallbackCategoryColor})`);
  });
});

describe('createThemeController', () => {
  it('shows and remembers an explicit preference', () => {
    const storage = memoryStorage();
    const controller = createThemeController(environmentOf(fakeDevice(true), storage));

    controller.apply('dark');
    expect(shown()).toBe('dark');

    controller.apply('light');
    expect(shown()).toBe('light');
    expect(storage.value()).toBe('light');
  });

  it('follows the device live while the preference is system', () => {
    const device = fakeDevice(false);
    const controller = createThemeController(environmentOf(device, memoryStorage()));

    controller.apply('system');
    expect(shown()).toBe('dark');

    device.setLight(true);
    expect(shown()).toBe('light');
  });

  it('stops following the device once another preference is applied', () => {
    const device = fakeDevice(false);
    const controller = createThemeController(environmentOf(device, memoryStorage()));

    controller.apply('system');
    controller.apply('system');
    expect(device.listenerCount()).toBe(1);

    controller.apply('dark');
    device.setLight(true);
    expect(shown()).toBe('dark');
    expect(device.listenerCount()).toBe(0);
  });

  it('restores the remembered preference', () => {
    const device = fakeDevice(true);
    const controller = createThemeController(environmentOf(device, memoryStorage('system')));

    controller.restore();
    expect(shown()).toBe('light');
    expect(device.listenerCount()).toBe(1);
  });

  it.each([null, 'sepia'])('restores the default when storage holds %s', (saved) => {
    const controller = createThemeController(environmentOf(fakeDevice(true), memoryStorage(saved)));

    controller.restore();
    expect(shown()).toBe(theme.defaultPreference);
  });
});

describe('browserThemeEnvironment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('uses <html>, the light colour-scheme query and the configured storage key', () => {
    const device = fakeDevice(false);
    const matchMedia = vi.fn(() => device);
    vi.stubGlobal('matchMedia', matchMedia);

    const environment = browserThemeEnvironment(window);
    environment.storage.write('light');

    expect(environment.root).toBe(document.documentElement);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: light)');
    expect(environment.prefersLight).toBe(device);
    expect(localStorage.getItem(theme.storageKey)).toBe('light');
  });
});
