import { catalogs, type Catalog, type Locale } from '@financas/i18n';
import { IntlMessageFormat } from 'intl-messageformat';

// E2E runs the web app in en-US (playwright.config.ts) and finds elements by
// the text a user sees — read from the shared catalog, so a reworded string
// never breaks a journey and a removed key fails typecheck. A journey run in
// another language (smoke's signed-in pages, OQ-259) reads that one's catalog.

/** Renders one catalog message, as the web app shows it. */
export type TextOf = <Section extends keyof Catalog>(
  section: Section,
  key: keyof Catalog[Section] & string,
  params?: Record<string, string | number | Date>,
) => string;

/**
 * Makes the message renderer for one language.
 *
 * @param locale - The language the web app shows.
 * @returns A renderer taking the catalog section, the message key within it
 *   and the values for its ICU placeholders.
 */
export const textIn = (locale: Locale): TextOf => (section, key, params) => {
  const message = (catalogs[locale][section] as Readonly<Record<string, string>>)[key];
  if (message === undefined) throw new Error(`No ${locale} message ${section}.${key}`);
  return String(new IntlMessageFormat(message, locale).format(params));
};

/** Renders one en-US catalog message, the language the journeys run in. */
const text = textIn('en-US');

export default text;
