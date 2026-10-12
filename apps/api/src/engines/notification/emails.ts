import { catalogs, type EmailType, type Locale } from '@financas/i18n';
import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat';

// Email rendering (U7, OQ-84): an email is requested as type + parameters +
// language; its subject and body come from the shared i18n catalog, so the web
// app and the emails say the same things in the same words.

/**
 * The parameters each email type's template uses — its ICU arguments. The
 * constraint fails to compile when the catalog gains an email type missing here.
 */
type Exhaustive<T extends Record<EmailType, Readonly<Record<string, PrimitiveType>>>> = T;

export type EmailParams = Exhaustive<{
  'password.reset': { readonly resetLink: string; readonly expiresInMinutes: number };
}>;

/** A rendered email, ready for a provider. */
export interface RenderedEmail {
  readonly subject: string;
  readonly body: string;
}

/**
 * Renders an email from the catalog in the recipient's language.
 *
 * @param type - The email type, e.g. `password.reset`.
 * @param params - Its template arguments.
 * @param locale - The recipient's language.
 * @returns Subject and plain-text body.
 * @throws {Error} When a template argument is missing.
 */
export const renderEmail = <T extends EmailType>(
  type: T,
  params: EmailParams[T],
  locale: Locale,
): RenderedEmail => {
  const templates = catalogs[locale].emails as Readonly<Record<string, string>>;
  const fill = (part: 'subject' | 'body') => String(
    new IntlMessageFormat(templates[`${type}.${part}`]!, locale).format(params),
  );
  return { subject: fill('subject'), body: fill('body') };
};
