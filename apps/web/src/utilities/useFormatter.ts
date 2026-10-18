import { useMemo } from 'react';
import { createFormatter, type Formatter } from './formatting';
import { useI18n } from './I18nProvider';

/**
 * The formatters for the page's current interface locale (FU6), rebuilt
 * when the locale changes.
 *
 * @returns The bound formatters.
 */
export default function useFormatter(): Formatter {
  const { locale } = useI18n();
  return useMemo(() => createFormatter(locale), [locale]);
}
