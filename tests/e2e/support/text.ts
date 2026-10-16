import { catalogs, type Catalog } from '@financas/i18n';
import { IntlMessageFormat } from 'intl-messageformat';

// E2E runs the web app in en-US (playwright.config.ts) and finds elements by
// the text a user sees — read from the shared catalog, so a reworded string
// never breaks a journey and a removed key fails typecheck.

const LOCALE = 'en-US';

/**
 * Renders one en-US catalog message, as the web app shows it.
 *
 * @param section - The catalog section, e.g. `signIn`.
 * @param key - The message key within it.
 * @param params - Values for the message's ICU placeholders.
 * @returns The rendered text.
 */
const text = <Section extends keyof Catalog>(
  section: Section,
  key: keyof Catalog[Section] & string,
  params?: Record<string, string | number | Date>,
): string => {
  const message = (catalogs[LOCALE][section] as Readonly<Record<string, string>>)[key];
  if (message === undefined) throw new Error(`No ${LOCALE} message ${section}.${key}`);
  return String(new IntlMessageFormat(message, LOCALE).format(params));
};

export default text;
