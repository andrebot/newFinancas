/** Locales supported from day one; pt-BR is the primary one. */
export const SUPPORTED_LOCALES = ['pt-BR', 'en-US'] as const;

/** A locale the catalog has messages for. */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Locale used when the user has not chosen one. */
export const DEFAULT_LOCALE: Locale = 'pt-BR';

/**
 * Tells whether a locale tag is one the catalog supports.
 *
 * @param value - A BCP 47 tag, e.g. from a user preference or `Accept-Language`.
 * @returns `true` (narrowing `value` to `Locale`) when it is supported.
 */
export const isSupportedLocale = (value: string): value is Locale => (
  (SUPPORTED_LOCALES as readonly string[]).includes(value)
);
