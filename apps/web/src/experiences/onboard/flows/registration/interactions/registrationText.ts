import type { Catalog } from '@financas/i18n';
import { useI18n } from '../../../../../utilities/I18nProvider';

// The Registration entry's texts: the catalog's `registration` section.

/** A key of the catalog's `registration` section. */
export type RegistrationTextKey = keyof Catalog['registration'];

/**
 * The `registration` section of the current locale's catalog.
 *
 * @returns A function from a `registration` key to its text.
 */
export const useRegistrationText = () => {
  const translator = useI18n();
  return (key: RegistrationTextKey) => translator.text('registration', key);
};
