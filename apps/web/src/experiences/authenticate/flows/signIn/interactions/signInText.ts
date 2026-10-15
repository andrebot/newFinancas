import type { Catalog } from '@financas/i18n';
import { useI18n } from '../../../../../utilities/I18nProvider';

// The Sign In entries' texts: the catalog's `signIn` section.

/** A key of the catalog's `signIn` section. */
export type SignInTextKey = keyof Catalog['signIn'];

/**
 * The `signIn` section of the current locale's catalog.
 *
 * @returns A function from a `signIn` key to its text.
 */
export const useSignInText = () => {
  const translator = useI18n();
  return (key: SignInTextKey) => translator.text('signIn', key);
};
