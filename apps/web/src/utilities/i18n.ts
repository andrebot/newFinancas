import {
  catalogs as sharedCatalogs, DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES,
  type Catalog, type Locale,
} from '@financas/i18n';
import { createLogger } from '@financas/logging/browser';
import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat';
import { i18n } from '../config/constants';
import { safeStorage, type PreferenceStorage } from './safeStorage';

// I18nUtility (FU5, EBD): every user-facing text comes from the shared ICU
// catalog in `packages/i18n` (NFR-I18N-3). A translator renders one locale's
// messages: copy by typed section and key, and the codes the API sends as
// strings — error codes, field codes and notification types (OQ-82, OQ-83).
// A code this build doesn't know, or a message that fails to format, shows
// its section's generic message and is logged; the UI never sees a throw.
// The locale controller decides which locale the page shows, like
// ThemeUtility: remembered → browser language → pt-BR, until the user's
// `preferences.language` loads and is applied.

const log = createLogger({ label: 'I18nUtility' });

/** Values a message's ICU arguments take (`{min, plural, …}`, `{inviterName}`). */
export type MessageParams = Readonly<Record<string, PrimitiveType>>;

/** A catalog section, e.g. `errors`. */
export type Section = keyof Catalog;

/** Renders one locale's messages. */
export interface Translator {
  readonly locale: Locale;
  /** Copy by a section and key the compiler checks; the key's name if it fails to format. */
  readonly text: <S extends Section>(
    section: S, key: keyof Catalog[S], params?: MessageParams,
  ) => string;
  /** An API error `code`; an unknown one shows `errors.fallback`. */
  readonly error: (code: string, params?: MessageParams) => string;
  /** A validation `details[].code`; an unknown one shows `fields['field.invalid']`. */
  readonly field: (code: string, params?: MessageParams) => string;
  /** A notification `type`; an unknown one shows `notifications.fallback`. */
  readonly notification: (type: string, params?: MessageParams) => string;
}

/**
 * Formats one ICU message.
 *
 * @param message - The ICU source.
 * @param locale - The locale whose plural rules and number format apply.
 * @param params - The message's arguments.
 * @returns The text, or `null` when the message can't be formatted (e.g. a missing argument).
 */
export const formatMessage = (
  message: string,
  locale: Locale,
  params: MessageParams = {},
): string | null => {
  try {
    return String(new IntlMessageFormat(message, locale).format(params));
  } catch {
    return null;
  }
};

/**
 * Creates the translator for one locale.
 *
 * @param locale - The locale to render.
 * @param catalogs - Every locale's catalog (the shared one by default).
 * @returns The translator.
 */
export const createTranslator = (
  locale: Locale,
  catalogs: Readonly<Record<Locale, Catalog>> = sharedCatalogs,
): Translator => {
  const catalog = catalogs[locale];
  // Codes arrive from the API as plain strings, so lookups go through a loose view.
  const sections = catalog as Readonly<Record<Section, Readonly<Record<string, string>>>>;

  /**
   * Renders a key of a section, or the section's generic message when the key
   * is unknown or fails to format.
   *
   * @param section - The section to look in.
   * @param key - The key, as the API (or a caller) sent it.
   * @param fallback - What to show instead (a generic message, which takes no arguments).
   * @param params - The message's arguments.
   * @returns The text.
   */
  const render = (section: Section, key: string, fallback: string, params?: MessageParams) => {
    const message = Object.hasOwn(sections[section], key) ? sections[section][key] : undefined;
    const text = message === undefined ? null : formatMessage(message, locale, params);
    if (text !== null) return text;
    log.warn(message === undefined ? 'unknown message key' : 'message failed to format', {
      locale, section, key, params: Object.keys(params ?? {}),
    });
    return fallback;
  };

  return {
    locale,
    // A typed key only fails on missing arguments; its name points at the bug.
    text: (section, key, params) => render(section, String(key), String(key), params),
    error: (code, params) => render('errors', code, catalog.errors.fallback, params),
    field: (code, params) => render('fields', code, catalog.fields['field.invalid'], params),
    notification: (type, params) => (
      render('notifications', type, catalog.notifications.fallback, params)
    ),
  };
};

/**
 * Picks the first browser language the catalog supports: an exact tag first
 * (`en-US`), then the same language (`pt-PT` → `pt-BR`, `en` → `en-US`).
 *
 * @param tags - The browser's languages, most preferred first (`navigator.languages`).
 * @returns The locale, or `null` when none matches.
 */
export const matchLocale = (tags: readonly string[]): Locale | null => {
  const languageOf = (tag: string): string => tag.toLowerCase().replace(/-.*$/, '');
  const matches = tags.map((tag) => (
    SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === tag.toLowerCase())
    ?? SUPPORTED_LOCALES.find((locale) => languageOf(locale) === languageOf(tag))
  ));
  return matches.find((locale) => locale !== undefined) ?? null;
};

/** What the locale controller touches: <html>, the browser's languages and storage. */
export interface LocaleEnvironment {
  readonly root: HTMLElement;
  readonly languages: readonly string[];
  /** Remembers the last applied locale. */
  readonly storage: PreferenceStorage;
}

/** Decides which locale one page shows and tells subscribers when it changes. */
export interface LocaleController {
  /** The locale shown now. */
  readonly current: () => Locale;
  /** Shows a locale (the user's `preferences.language`) and remembers it. */
  readonly apply: (locale: Locale) => void;
  /** Shows the remembered locale, else the browser's, else the default. */
  readonly restore: () => void;
  /** Calls `listener` after each change; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * Creates the locale controller for one page.
 *
 * @param environment - <html>, the browser's languages and storage.
 * @returns The page's locale controller.
 */
export const createLocaleController = (environment: LocaleEnvironment): LocaleController => {
  const { root, languages, storage } = environment;
  const listeners = new Set<() => void>();
  let locale: Locale = DEFAULT_LOCALE;

  /**
   * Shows a locale: `lang` on <html> (screen readers, hyphenation) and a re-render.
   *
   * @param next - The locale to show.
   */
  const show = (next: Locale): void => {
    locale = next;
    root.lang = next;
    listeners.forEach((listener) => listener());
  };

  return {
    current: () => locale,
    apply: (next) => {
      show(next);
      storage.write(next);
    },
    restore: () => {
      const saved = storage.read();
      show(saved !== null && isSupportedLocale(saved)
        ? saved
        : matchLocale(languages) ?? DEFAULT_LOCALE);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/**
 * The real page's environment.
 *
 * @param page - The browser window.
 * @returns <html>, `navigator.languages` and the remembered locale.
 */
export const browserLocaleEnvironment = (page: Window): LocaleEnvironment => ({
  root: page.document.documentElement,
  languages: page.navigator.languages,
  storage: safeStorage(() => page.localStorage, i18n.storageKey),
});
