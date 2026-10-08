import type { Catalog } from './catalog';
import enUS from './catalogs/en-US';
import ptBR from './catalogs/pt-BR';
import type { Locale } from './locales';

export {
  DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES, type Locale,
} from './locales';
export type {
  Catalog, EmailType, ErrorCode, FieldCode, NotificationType,
} from './catalog';

/** The shared ICU message catalog, one complete `Catalog` per supported locale. */
export const catalogs: Readonly<Record<Locale, Catalog>> = { 'pt-BR': ptBR, 'en-US': enUS };
